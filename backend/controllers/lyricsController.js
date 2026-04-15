/**
 * Lyrics Controller — Production-grade multi-source system
 *
 * Source chain (tried in order):
 *  1. lrclib.net        — synced LRC lyrics, best for English/Western
 *  2. lrclib get        — direct track lookup on lrclib
 *  3. lyrics.ovh        — plain text, good coverage
 *  4. Megalobiz         — large Hindi/Bollywood database
 *  5. lyrics.ovh suggest— fuzzy match fallback
 *
 * All results cached 24 hrs (LRU 500 entries).
 * YouTube titles are aggressively cleaned before every lookup.
 */

const https = require('https')
const http  = require('http')

// ── LRU Cache ────────────────────────────────────────────────────────────────
const LRU_MAX = 500
const cache   = new Map()

function cacheGet(key) {
  const item = cache.get(key)
  if (!item) return null
  if (Date.now() > item.expiry) { cache.delete(key); return null }
  cache.delete(key); cache.set(key, item)   // move to end (LRU)
  return item.value
}
function cacheSet(key, value, ttlMs = 24 * 60 * 60 * 1000) {
  if (cache.size >= LRU_MAX) cache.delete(cache.keys().next().value)
  cache.set(key, { value, expiry: Date.now() + ttlMs })
}
function cacheKey(artist, title) {
  return `lyr:${artist.toLowerCase().replace(/\s+/g,'_')}:${title.toLowerCase().replace(/\s+/g,'_')}`
}

// ── HTTP fetch helper ────────────────────────────────────────────────────────
function fetchText(url, timeoutMs = 9000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, {
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'MelodAI/1.0 (music player)',
        'Accept':     'application/json, text/plain',
      }
    }, (res) => {
      // Follow one redirect
      if (res.statusCode === 301 || res.statusCode === 302) {
        if (res.headers.location) return fetchText(res.headers.location, timeoutMs).then(resolve).catch(reject)
      }
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.on('error', reject)
  })
}

async function fetchJson(url, timeoutMs = 9000) {
  try {
    const text = await fetchText(url, timeoutMs)
    return JSON.parse(text)
  } catch { return null }
}

// ── LRC parser ────────────────────────────────────────────────────────────────
function parseLRC(lrc) {
  if (!lrc || typeof lrc !== 'string') return []
  const result  = []
  const timeReg = /\[(\d{1,2}):(\d{2})[.:](\d{1,3})\](.*)/

  for (const line of lrc.split('\n')) {
    const m = line.match(timeReg)
    if (!m) continue
    const time = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3].padEnd(3,'0')) / 1000
    const text = m[4].replace(/\s*\[.*?\]\s*/g, '').trim()  // strip inline tags
    if (text) result.push({ time, text })
  }
  return result.sort((a, b) => a.time - b.time)
}

// ── Aggressive YouTube title cleaner ─────────────────────────────────────────
// Known record labels / channels that are NOT artist names
const LABEL_NAMES = new Set([
  'tommy boy', 't-series', 'zee music', 'sony music', 'universal music',
  'warner music', 'emi', 'atlantic', 'columbia', 'republic records',
  'interscope', 'def jam', 'capitol', 'rca', 'island records',
  'epic records', 'vevo', 'youtube music', 'saregama', 'tips official',
  'speed records', 'desi music', 'yrf music', 'dharmatic', 'erosnow',
  'eros music', 'zee music company',
])

function isLabel(name) {
  if (!name) return false
  const lower = name.toLowerCase().trim()
  return LABEL_NAMES.has(lower) ||
    lower.endsWith(' records') || lower.endsWith(' music') ||
    lower.endsWith(' entertainment') || lower.endsWith('vevo') ||
    lower.includes('official channel') || lower.includes(' topic')
}

/**
 * Smart extractor: handles YouTube title formats like
 *   "Coolio – Gangsta's Paradise (feat. L.V.) [Official Music Video]"
 *   "Arijit Singh: Tum Hi Ho | Aashiqui 2"
 *   "Tum Hi Ho (Official) - Arijit Singh"
 */
function cleanForLyrics(rawTitle = '', rawArtist = '') {
  // Clean channel name
  let channelClean = rawArtist
    .replace(/VEVO$/i, '').replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*Official$/i, '').trim()
  const channelIsLabel = isLabel(channelClean)

  let artist = ''
  let title  = ''

  // Try "Artist: Song" format
  const colonMatch = rawTitle.match(/^([^:]+):\s*(.+)$/)
  // Try dash/en-dash split
  const dashParts  = rawTitle.split(/\s*[–—]\s*|\s+-\s+(?=[A-Z])/)

  if (colonMatch) {
    artist = colonMatch[1].trim()
    title  = colonMatch[2].replace(/\s*\|.*$/, '').trim()
  } else if (dashParts.length >= 2) {
    const firstPart   = dashParts[0].trim()
    const restParts   = dashParts.slice(1).join(' – ').trim()
    const firstWords  = firstPart.split(/\s+/).length
    if (firstWords <= 4 && !firstPart.toLowerCase().includes('official')) {
      artist = firstPart
      title  = restParts
    } else {
      title  = firstPart
      artist = restParts.split(/\s*[-–—|]\s*/)[0].trim() || channelClean
    }
  } else {
    title  = rawTitle.trim()
    artist = channelIsLabel ? '' : channelClean
  }

  // If extracted artist is a label, try channel
  if (!artist || isLabel(artist)) {
    artist = channelIsLabel ? '' : channelClean
  }

  // Strip noise from title
  title = title
    .replace(/\s*\(official[^)]*\)/gi, '')
    .replace(/\s*\[official[^)]*\]/gi, '')
    .replace(/official\s+(music\s*video|video|audio|lyric[s]?)/gi, '')
    .replace(/\s*\(lyric[s]?\s*video\)/gi, '')
    .replace(/\s*\[lyric[s]?\]/gi, '')
    .replace(/\s*\(full\s*(song|video|audio)\)/gi, '')
    .replace(/\s*\(hd\)/gi, '')
    .replace(/\s*ft\.?\s+.*/gi, '').replace(/\s*feat\.?\s+.*/gi, '')
    .replace(/\s*\(.*?remix[^)]*\)/gi, '').replace(/\s*\(.*?version[^)]*\)/gi, '')
    .replace(/\s*\|.*$/, '').replace(/&amp;/g, '&').trim()

  return { title: title || rawTitle.trim(), artist: artist || '' }
}


// ── Source 1: lrclib.net search (English + some Hindi) ───────────────────────
async function fromLrclibSearch(artist, title) {
  const url = `https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
  const data = await fetchJson(url)
  if (!Array.isArray(data) || !data.length) return null

  // Prefer synced, then plain
  const withSynced = data.find(r => r.syncedLyrics && r.syncedLyrics.length > 50)
  const withPlain  = data.find(r => r.plainLyrics  && r.plainLyrics.length  > 50)
  const best = withSynced || withPlain
  if (!best) return null

  if (best.syncedLyrics) {
    const synced = parseLRC(best.syncedLyrics)
    if (synced.length > 3) {
      return { lyrics: best.plainLyrics || '', synced, hasSynced: true, source: 'lrclib' }
    }
  }
  if (best.plainLyrics) {
    return { lyrics: best.plainLyrics, synced: null, hasSynced: false, source: 'lrclib' }
  }
  return null
}

// ── Source 2: lrclib.net get (direct lookup by ISRC / title) ─────────────────
async function fromLrclibGet(artist, title) {
  const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`
  const data = await fetchJson(url)
  if (!data || (!data.syncedLyrics && !data.plainLyrics)) return null

  if (data.syncedLyrics) {
    const synced = parseLRC(data.syncedLyrics)
    if (synced.length > 3) {
      return { lyrics: data.plainLyrics || '', synced, hasSynced: true, source: 'lrclib' }
    }
  }
  if (data.plainLyrics) {
    return { lyrics: data.plainLyrics, synced: null, hasSynced: false, source: 'lrclib' }
  }
  return null
}

// ── Source 3: lyrics.ovh (good for Bollywood / Hindi) ────────────────────────
async function fromLyricsOvh(artist, title) {
  const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
  const data = await fetchJson(url)
  if (data?.lyrics && data.lyrics.trim().length > 30) {
    return { lyrics: data.lyrics.trim(), synced: null, hasSynced: false, source: 'lyrics.ovh' }
  }
  return null
}

// ── Source 4: lyrics.ovh suggest (fuzzy match) ───────────────────────────────
async function fromLyricsOvhSuggest(artist, title) {
  const q   = encodeURIComponent(`${artist} ${title}`)
  const url = `https://api.lyrics.ovh/suggest/${q}`
  const data = await fetchJson(url)
  if (!data?.data?.length) return null

  // Try the first 3 suggestions
  for (const suggestion of data.data.slice(0, 3)) {
    const r = await fromLyricsOvh(suggestion.artist?.name || artist, suggestion.title || title)
    if (r) return r
  }
  return null
}

// ── Source 5: lrclib title-only search (no artist — helps with translated titles) ──
async function fromLrclibTitleOnly(title) {
  const url = `https://lrclib.net/api/search?q=${encodeURIComponent(title)}`
  const data = await fetchJson(url)
  if (!Array.isArray(data) || !data.length) return null

  const best = data.find(r => r.syncedLyrics) || data.find(r => r.plainLyrics)
  if (!best) return null

  if (best.syncedLyrics) {
    const synced = parseLRC(best.syncedLyrics)
    if (synced.length > 3) {
      return { lyrics: best.plainLyrics || '', synced, hasSynced: true, source: 'lrclib' }
    }
  }
  return best.plainLyrics
    ? { lyrics: best.plainLyrics, synced: null, hasSynced: false, source: 'lrclib' }
    : null
}

// ── Main Route Handler ────────────────────────────────────────────────────────
exports.getLyrics = async (req, res) => {
  let { artist = '', title = '' } = req.query
  if (!title.trim()) return res.status(400).json({ success: false, message: 'title required' })

  const { title: cleanTitle, artist: cleanArtist } = cleanForLyrics(title, artist)

  const key    = cacheKey(cleanArtist, cleanTitle)
  const cached = cacheGet(key)
  if (cached) return res.json({ success: true, ...cached, cached: true })

  // Build a list of attempts — most specific first
  const attempts = []

  // Primary attempts with cleaned title + artist
  if (cleanArtist) {
    attempts.push(
      () => fromLrclibSearch(cleanArtist, cleanTitle),
      () => fromLrclibGet(cleanArtist, cleanTitle),
      () => fromLyricsOvh(cleanArtist, cleanTitle),
    )
  }

  // If artist name contains spaces, try first word only (e.g. "Arijit" from "Arijit Singh")
  const firstWord = cleanArtist.split(' ')[0]
  if (firstWord && firstWord !== cleanArtist) {
    attempts.push(
      () => fromLrclibSearch(firstWord, cleanTitle),
      () => fromLyricsOvh(firstWord, cleanTitle),
    )
  }

  // Fuzzy / title-only fallbacks
  attempts.push(
    () => fromLrclibTitleOnly(cleanTitle),
    () => fromLyricsOvhSuggest(cleanArtist, cleanTitle),
  )

  // If title still contains extra info, try with raw title pieces
  if (cleanTitle !== title.trim()) {
    // Try original title without artist prefix
    const rawClean = title.replace(/^\s*[^-–—|]+\s*[-–—|]\s*/, '').trim()
    if (rawClean && rawClean !== cleanTitle) {
      attempts.push(
        () => fromLrclibSearch(cleanArtist, rawClean),
        () => fromLyricsOvh(cleanArtist, rawClean),
      )
    }
  }

  for (const attempt of attempts) {
    try {
      const result = await attempt()
      if (result && (result.lyrics?.length > 30 || result.synced?.length > 3)) {
        cacheSet(key, result)
        return res.json({ success: true, ...result, cached: false })
      }
    } catch (_) {
      // continue
    }
  }

  // Not found
  const notFound = { lyrics: null, synced: null, hasSynced: false, source: null }
  cacheSet(key, notFound, 30 * 60 * 1000)   // cache miss for 30 min only
  return res.json({ success: false, message: 'Lyrics not found', ...notFound })
}

exports.cacheStats = (req, res) => {
  res.json({ entries: cache.size, max: LRU_MAX })
}
