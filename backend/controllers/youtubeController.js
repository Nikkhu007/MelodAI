/**
 * YouTube Controller — LOCAL USE ONLY
 * yt-dlp pipes audio through the local Express server.
 * This makes HTML5 <audio> work perfectly including seeking.
 *
 * Install yt-dlp first:
 *   Windows:  pip install yt-dlp   or   winget install yt-dlp
 *   Mac:      brew install yt-dlp
 *   Linux:    pip install yt-dlp
 */

const { exec, spawn } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Cache: videoId → { url, expiry }  (YouTube CDN URLs expire ~6 hrs)
const urlCache = new Map()

async function getCachedAudioUrl(videoId) {
  const cached = urlCache.get(videoId)
  if (cached && cached.expiry > Date.now()) return cached.url

  const cmd = [
    'yt-dlp',
    `"https://www.youtube.com/watch?v=${videoId}"`,
    '--get-url',
    '--format', '"bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best"',
    '--no-playlist',
    '--no-warnings',
    '--quiet',
  ].join(' ')

  const { stdout } = await execAsync(cmd, { timeout: 25000 })
  const url = stdout.trim().split('\n')[0]
  if (!url) throw new Error('No audio URL returned')

  // Cache for 5 hours (YouTube URLs expire ~6 hrs)
  urlCache.set(videoId, { url, expiry: Date.now() + 5 * 60 * 60 * 1000 })
  return url
}

function videoToSong(v) {
  return {
    _id:       `yt_${v.id}`,
    ytId:      v.id,
    title:     v.title || 'Unknown',
    artist:    v.uploader || v.channel || 'Unknown Artist',
    album:     'YouTube',
    duration:  v.duration || 0,
    audioUrl:  null,
    coverUrl:  v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
    genre:     'other',
    mood:      'chill',
    isYouTube: true,
    views:     v.view_count || 0,
    ytUrl:     `https://www.youtube.com/watch?v=${v.id}`,
  }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/**
 * GET /api/youtube/search?q=...&limit=20
 */
exports.search = async (req, res) => {
  const { q, limit = 20 } = req.query
  if (!q?.trim()) return res.status(400).json({ success: false, message: 'Query required' })

  const cmd = [
    'yt-dlp',
    `"ytsearch${parseInt(limit)}:${q.trim()}"`,
    '--dump-json',
    '--flat-playlist',
    '--no-warnings',
    '--quiet',
  ].join(' ')

  try {
    const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 30000 })
    const songs = stdout.trim().split('\n')
      .filter(Boolean)
      .map(line => { try { return videoToSong(JSON.parse(line)) } catch { return null } })
      .filter(Boolean)
    res.json({ success: true, songs })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, hint: 'Is yt-dlp installed? Run: pip install yt-dlp' })
  }
}

/**
 * GET /api/youtube/stream/:videoId
 *
 * Pipes audio from YouTube's CDN through your local server to the browser.
 * Supports HTTP Range requests so the seek bar works.
 *
 * How it works:
 *   1. yt-dlp extracts the real CDN audio URL (cached 5 hrs)
 *   2. Node fetches that URL with the Range header forwarded
 *   3. The response bytes are piped straight to the browser
 *   → Browser sees it as a normal audio stream, seek works perfectly
 */
exports.stream = async (req, res) => {
  const { videoId } = req.params
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ success: false, message: 'Invalid video ID' })
  }

  try {
    const audioUrl = await getCachedAudioUrl(videoId)

    // Forward Range header from browser (needed for seeking)
    const rangeHeader = req.headers['range']
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://www.youtube.com',
      'Referer': 'https://www.youtube.com/',
    }
    if (rangeHeader) fetchHeaders['Range'] = rangeHeader

    const upstream = await fetch(audioUrl, { headers: fetchHeaders })

    if (!upstream.ok && upstream.status !== 206) {
      // CDN URL may have expired — bust cache and retry once
      urlCache.delete(videoId)
      const freshUrl = await getCachedAudioUrl(videoId)
      const retry = await fetch(freshUrl, { headers: fetchHeaders })
      if (!retry.ok && retry.status !== 206) {
        return res.status(502).json({ success: false, message: 'Audio stream unavailable' })
      }
      pipeResponse(retry, res, rangeHeader)
    } else {
      pipeResponse(upstream, res, rangeHeader)
    }
  } catch (err) {
    console.error('Stream error:', err.message)
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Stream failed: ' + err.message })
    }
  }
}

function pipeResponse(upstream, res, rangeHeader) {
  // Copy relevant headers from upstream to client
  const contentType = upstream.headers.get('content-type') || 'audio/webm'
  const contentLength = upstream.headers.get('content-length')
  const contentRange = upstream.headers.get('content-range')
  const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes'

  res.setHeader('Content-Type', contentType)
  res.setHeader('Accept-Ranges', acceptRanges)
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (contentLength) res.setHeader('Content-Length', contentLength)
  if (contentRange) res.setHeader('Content-Range', contentRange)

  // 206 Partial Content for range requests, 200 otherwise
  res.status(rangeHeader ? 206 : 200)

  // Pipe the audio bytes to the browser
  if (upstream.body) {
    const reader = upstream.body.getReader()
    const pump = () => reader.read().then(({ done, value }) => {
      if (done) { res.end(); return }
      res.write(Buffer.from(value))
      pump()
    }).catch(() => res.end())
    pump()
  } else {
    res.end()
  }
}

/**
 * GET /api/youtube/trending?region=IN
 */
exports.trending = async (req, res) => {
  const { region = 'IN' } = req.query
  // Fall back to a popular search since trending feed parsing is unreliable
  const queries = {
    IN: 'trending bollywood songs 2024',
    US: 'top hits usa 2024',
    GB: 'top uk songs 2024',
  }
  const q = queries[region] || 'trending music 2024'
  req.query.q = q
  req.query.limit = 20
  return exports.search(req, res)
}

/**
 * GET /api/youtube/check
 */
exports.check = async (req, res) => {
  try {
    const { stdout } = await execAsync('yt-dlp --version', { timeout: 5000 })
    res.json({ success: true, version: stdout.trim(), installed: true })
  } catch {
    res.json({
      success: false, installed: false, message: 'yt-dlp not found',
      install: {
        windows: 'pip install yt-dlp  OR  winget install yt-dlp',
        mac: 'brew install yt-dlp',
        linux: 'pip install yt-dlp',
      },
    })
  }
}

/**
 * GET /api/youtube/info/:videoId
 */
exports.getInfo = async (req, res) => {
  const { videoId } = req.params
  const cmd = `yt-dlp "https://www.youtube.com/watch?v=${videoId}" --dump-json --no-playlist --no-warnings --quiet`
  try {
    const { stdout } = await execAsync(cmd, { timeout: 20000 })
    res.json({ success: true, song: videoToSong(JSON.parse(stdout)) })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
}
