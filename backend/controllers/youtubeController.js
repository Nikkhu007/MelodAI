/**
 * YouTube Controller — LOCAL USE ONLY via yt-dlp
 * Features: smart search, audio piping with range support, URL caching
 */
const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

// ── URL cache (5-hour TTL, YouTube CDN URLs expire ~6hrs) ───────────────────
const urlCache = new Map()

async function getCachedAudioUrl(videoId) {
  const cached = urlCache.get(videoId)
  if (cached && cached.expiry > Date.now()) return cached.url

  const cmd = `yt-dlp "https://www.youtube.com/watch?v=${videoId}" --get-url --format "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best" --no-playlist --no-warnings --quiet`
  const { stdout } = await execAsync(cmd, { timeout: 25000 })
  const url = stdout.trim().split('\n')[0]
  if (!url) throw new Error('No audio URL returned')
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

// ── Improved search: adds "official audio" suffix for better music results ──
exports.search = async (req, res) => {
  const { q, limit = 20, type = 'music' } = req.query
  if (!q?.trim()) return res.status(400).json({ success: false, message: 'Query required' })

  // Append context hint for better music results
  const query = type === 'music' ? `${q.trim()} official audio` : q.trim()

  const cmd = `yt-dlp "ytsearch${parseInt(limit)}:${query}" --dump-json --flat-playlist --no-warnings --quiet`
  try {
    const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 35000 })
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
 * Pipes audio through the backend so HTML5 <audio> can play it.
 * Supports HTTP Range requests for seeking.
 */
exports.stream = async (req, res) => {
  const { videoId } = req.params
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({ success: false, message: 'Invalid video ID' })
  }

  const tryStream = async (bust = false) => {
    if (bust) urlCache.delete(videoId)
    const audioUrl = await getCachedAudioUrl(videoId)
    const rangeHeader = req.headers['range']
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com',
    }
    if (rangeHeader) headers['Range'] = rangeHeader
    return { audioUrl, headers, rangeHeader }
  }

  try {
    let { audioUrl, headers, rangeHeader } = await tryStream()
    let upstream = await fetch(audioUrl, { headers })

    // Retry with fresh URL if CDN rejects
    if (!upstream.ok && upstream.status !== 206) {
      const retry = await tryStream(true)
      upstream = await fetch(retry.audioUrl, { headers: retry.headers })
      if (!upstream.ok && upstream.status !== 206) {
        return res.status(502).json({ success: false, message: 'Audio stream unavailable, try again' })
      }
    }

    // Forward headers
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/webm')
    res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Access-Control-Allow-Origin', '*')
    const cl = upstream.headers.get('content-length')
    const cr = upstream.headers.get('content-range')
    if (cl) res.setHeader('Content-Length', cl)
    if (cr) res.setHeader('Content-Range', cr)
    res.status(rangeHeader ? 206 : 200)

    // Pipe bytes
    const reader = upstream.body.getReader()
    const pump = () => reader.read().then(({ done, value }) => {
      if (done) { res.end(); return }
      if (!res.writableEnded) { res.write(Buffer.from(value)); pump() }
    }).catch(() => { if (!res.writableEnded) res.end() })
    pump()

    req.on('close', () => reader.cancel().catch(() => {}))
  } catch (err) {
    console.error('Stream error:', err.message)
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Stream failed: ' + err.message })
  }
}

exports.trending = async (req, res) => {
  req.query.q = 'trending songs 2024'
  req.query.limit = 20
  req.query.type = 'none' // don't add "official audio" to trending query
  return exports.search(req, res)
}

exports.check = async (req, res) => {
  try {
    const { stdout } = await execAsync('yt-dlp --version', { timeout: 5000 })
    res.json({ success: true, version: stdout.trim(), installed: true })
  } catch {
    res.json({ success: false, installed: false, message: 'yt-dlp not found',
      install: { windows: 'pip install yt-dlp  OR  winget install yt-dlp', mac: 'brew install yt-dlp', linux: 'pip install yt-dlp' }
    })
  }
}

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
