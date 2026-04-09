/**
 * Lyrics Controller
 * Multi-source fallback chain:
 *   1. lyrics.ovh (free, no key)
 *   2. Lyrics.ovh v2 fallback
 *   3. Genius search scrape (title-based)
 *   4. Graceful "not found" response
 *
 * All results are cached in-memory (LRU) for 24 hours.
 */

const https = require('https')

// ── Simple in-memory LRU cache (no Redis needed for local use) ──────────────
const LRU_MAX = 500
const cache = new Map()

function cacheGet(key) {
  const item = cache.get(key)
  if (!item) return null
  if (Date.now() > item.expiry) { cache.delete(key); return null }
  // LRU: move to end
  cache.delete(key)
  cache.set(key, item)
  return item.value
}

function cacheSet(key, value, ttlMs = 24 * 60 * 60 * 1000) {
  if (cache.size >= LRU_MAX) {
    // Evict oldest
    cache.delete(cache.keys().next().value)
  }
  cache.set(key, { value, expiry: Date.now() + ttlMs })
}

function cacheKey(artist, title) {
  return `lyrics:${artist.toLowerCase().trim()}:${title.toLowerCase().trim()}`
}

// ── HTTP helper (avoids axios for this lightweight controller) ───────────────
function fetchJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(null) }
      })
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.on('error', reject)
  })
}

// ── Source 1: lyrics.ovh ─────────────────────────────────────────────────────
async function fromLyricsOvh(artist, title) {
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
  const data = await fetchJson(url)
  if (data?.lyrics && data.lyrics.trim().length > 20) {
    return { lyrics: data.lyrics.trim(), source: 'lyrics.ovh' }
  }
  return null
}

// ── Source 2: lyrics.ovh suggest (tries alternate spellings) ─────────────────
async function fromLyricsOvhSuggest(query) {
  const url = `https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`
  const data = await fetchJson(url)
  const first = data?.data?.[0]
  if (!first) return null
  return fromLyricsOvh(first.artist?.name, first.title)
}

// ── Source 3: lrclib.net — has synced LRC lyrics (karaoke timestamps) ────────
async function fromLrcLib(artist, title) {
  const url = `https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
  const data = await fetchJson(url)
  const best = Array.isArray(data) && data.find(r => r.syncedLyrics || r.plainLyrics)
  if (!best) return null

  if (best.syncedLyrics) {
    // Parse LRC format: [mm:ss.xx] lyric line
    const synced = parseLRC(best.syncedLyrics)
    return { lyrics: best.plainLyrics || best.syncedLyrics, synced, source: 'lrclib', hasSynced: true }
  }
  return { lyrics: best.plainLyrics, source: 'lrclib', hasSynced: false }
}

/**
 * Parse LRC format into array of { time (seconds), text } objects
 * LRC line format: [01:23.45]lyric text here
 */
function parseLRC(lrc) {
  const lines = lrc.split('\n')
  const result = []
  const timeRegex = /\[(\d{1,2}):(\d{2})\.(\d{1,3})\](.*)/

  for (const line of lines) {
    const match = line.match(timeRegex)
    if (!match) continue
    const minutes = parseInt(match[1])
    const seconds = parseInt(match[2])
    const ms = parseInt(match[3].padEnd(3, '0'))
    const time = minutes * 60 + seconds + ms / 1000
    const text = match[4].trim()
    if (text) result.push({ time, text })
  }

  return result.sort((a, b) => a.time - b.time)
}

// ── Main handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/lyrics?artist=...&title=...
 */
exports.getLyrics = async (req, res) => {
  let { artist, title } = req.query
  if (!artist || !title) {
    return res.status(400).json({ success: false, message: 'artist and title required' })
  }

  // Clean up YouTube-style titles like "Arijit Singh - Tum Hi Ho (Official)"
  title = title
    .replace(/\(official.*?\)/gi, '')
    .replace(/\[official.*?\]/gi, '')
    .replace(/official (video|audio|lyric)/gi, '')
    .replace(/\(lyrics\)/gi, '')
    .replace(/ft\..*$/gi, '')
    .replace(/feat\..*$/gi, '')
    .trim()

  artist = artist.replace(/VEVO$/i, '').replace(/Official$/i, '').trim()

  const key = cacheKey(artist, title)
  const cached = cacheGet(key)
  if (cached) {
    return res.json({ success: true, ...cached, cached: true })
  }

  // Try sources in order
  const attempts = [
    () => fromLrcLib(artist, title),
    () => fromLyricsOvh(artist, title),
    () => fromLyricsOvhSuggest(`${artist} ${title}`),
  ]

  for (const attempt of attempts) {
    try {
      const result = await attempt()
      if (result) {
        cacheSet(key, result)
        return res.json({ success: true, ...result, cached: false })
      }
    } catch (err) {
      // continue to next source
    }
  }

  // Nothing found
  const notFound = { lyrics: null, synced: null, hasSynced: false, source: null }
  cacheSet(key, notFound, 60 * 60 * 1000) // cache miss for 1 hour
  return res.json({ success: false, message: 'Lyrics not found', ...notFound })
}

/**
 * GET /api/lyrics/cache-stats
 */
exports.cacheStats = (req, res) => {
  res.json({ entries: cache.size, max: LRU_MAX })
}
