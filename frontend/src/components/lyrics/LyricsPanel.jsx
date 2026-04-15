/**
 * LyricsPanel — Fixed artist/title extraction for YouTube songs
 *
 * Key fix: YouTube titles often follow "Artist – Song Title (extra)" format.
 * We now SPLIT on the dash to extract both artist and title correctly,
 * instead of stripping everything after the dash.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { Mic2, Loader2, MicOff, RefreshCw } from 'lucide-react'
import usePlayerStore from '../../store/playerStore'
import { lyricsAPI } from '../../services/api'

const MEM = new Map()

// Known record labels / channels that are NOT artist names
const LABEL_NAMES = new Set([
  'tommy boy', 't-series', 'zee music', 'sony music', 'universal music',
  'warner music', 'emi', 'atlantic', 'columbia', 'republic records',
  'interscope', 'def jam', 'capitol', 'rca', 'island records',
  'epic records', 'vevo', 'youtube music', 'music video',
  'official channel', 'records', 'entertainment', 'music india',
  'saregama', 'tips official', 'speed records', 'desi music',
  'yrf music', 'dharmatic', 'erosnow', 'eros music',
])

function isLabel(name) {
  if (!name) return false
  const lower = name.toLowerCase().trim()
  return LABEL_NAMES.has(lower) ||
    lower.endsWith(' records') ||
    lower.endsWith(' music') ||
    lower.endsWith(' entertainment') ||
    lower.endsWith('vevo') ||
    lower.includes('official channel') ||
    lower.includes(' topic')
}

/**
 * Smart extractor for YouTube song titles.
 *
 * Handles formats like:
 *   "Coolio – Gangsta's Paradise (feat. L.V.) [Official Music Video]"
 *   "Arijit Singh: Tum Hi Ho | Aashiqui 2"
 *   "Tum Hi Ho (Official Video) - Arijit Singh"
 *   "Bohemian Rhapsody (Official Video) - Queen"
 *   "Gangsta's Paradise" by channel "Tommy Boy" → label, so artist from title
 */
function extractArtistTitle(rawTitle = '', rawArtist = '') {
  // Step 1: clean the channel/uploader name
  let channelClean = rawArtist
    .replace(/VEVO$/i, '')
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*Official$/i, '')
    .trim()

  // Step 2: check if channel is a label (not a real artist)
  const channelIsLabel = isLabel(channelClean)

  // Step 3: try to split the raw YouTube title into artist + song
  // Common separators: –  —  -  :  |
  // Pattern: "Artist – Song Title (garbage)"
  // Pattern: "Song Title - Artist" (reversed, less common)

  const separatorRegex = /\s*[–—]\s*|\s+-\s+(?=[A-Z])/  // en-dash, em-dash, or " - " before capital
  const colonRegex     = /^([^:]+):\s*(.+)$/              // "Artist: Song"

  let artist = ''
  let title  = ''

  const colonMatch = rawTitle.match(colonRegex)
  const dashParts  = rawTitle.split(separatorRegex)

  if (colonMatch) {
    // "Arijit Singh: Tum Hi Ho | ..."
    artist = colonMatch[1].trim()
    title  = colonMatch[2].replace(/\s*\|.*$/, '').trim()
  } else if (dashParts.length >= 2) {
    // "Coolio – Gangsta's Paradise (feat. L.V.) [Official...]"
    // First part before dash = artist, rest = title
    const firstPart = dashParts[0].trim()
    const restParts = dashParts.slice(1).join(' – ').trim()

    // Heuristic: if first part is short (≤ 4 words) and looks like a name → artist
    const firstWordCount = firstPart.split(/\s+/).length
    if (firstWordCount <= 4 && !firstPart.toLowerCase().includes('official')) {
      artist = firstPart
      title  = restParts
    } else {
      // Reversed: "Song Title - Artist" or whole thing is the title
      title  = firstPart
      artist = restParts.split(/\s*[-–—|]\s*/)[0].trim() || channelClean
    }
  } else {
    // No separator found — use the whole thing as title
    title  = rawTitle.trim()
    artist = channelIsLabel ? '' : channelClean
  }

  // Step 4: if we extracted no artist, or it's a label, fall back to channel
  if (!artist || isLabel(artist)) {
    artist = channelIsLabel ? '' : channelClean
  }

  // Step 5: strip noise from the title part
  title = title
    .replace(/\s*\(official[^)]*\)/gi, '')
    .replace(/\s*\[official[^)]*\]/gi, '')
    .replace(/official\s+(music\s*video|video|audio|lyric[s]?)/gi, '')
    .replace(/\s*\(lyric[s]?\s*video\)/gi, '')
    .replace(/\s*\[lyric[s]?\]/gi, '')
    .replace(/\s*\(full\s*(song|video|audio)\)/gi, '')
    .replace(/\s*ft\.?\s+.*/gi, '')
    .replace(/\s*feat\.?\s+.*/gi, '')
    .replace(/\s*\(.*?remix[^)]*\)/gi, '')
    .replace(/\s*\(.*?version[^)]*\)/gi, '')
    .replace(/\s*\|.*$/, '')   // strip "| Channel name" suffix
    .replace(/&amp;/g, '&')
    .trim()

  // Step 6: strip noise from artist too
  artist = artist
    .replace(/\s*\|.*$/, '')
    .replace(/&amp;/g, '&')
    .trim()

  return {
    title:  title  || rawTitle.trim(),
    artist: artist || '',
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LyricsPanel({ className = '' }) {
  const { currentSong, currentTime, seek, duration } = usePlayerStore()

  const [lyricsData, setLyricsData] = useState(null)
  const [status,     setStatus]     = useState('idle')
  const [activeIdx,  setActiveIdx]  = useState(0)
  const [searchInfo, setSearchInfo] = useState({ title: '', artist: '' })

  const containerRef = useRef(null)
  const lineRefs     = useRef([])
  const animFrameRef = useRef(null)

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchLyrics = useCallback(async (song) => {
    if (!song) return

    const { title, artist } = extractArtistTitle(song.title || '', song.artist || '')
    const key = `${artist.toLowerCase()}|${title.toLowerCase()}`

    setSearchInfo({ title, artist })

    if (MEM.has(key)) {
      const cached = MEM.get(key)
      setLyricsData(cached)
      setStatus(cached ? 'found' : 'notfound')
      setActiveIdx(0)
      lineRefs.current = []
      return
    }

    setStatus('loading')
    setLyricsData(null)
    setActiveIdx(0)
    lineRefs.current = []

    try {
      const { data } = await lyricsAPI.get(artist, title)
      const result = data.success ? {
        lyrics:    data.lyrics    || '',
        synced:    data.synced    || null,
        hasSynced: data.hasSynced || false,
        source:    data.source    || '',
      } : null

      MEM.set(key, result)
      setLyricsData(result)
      setStatus(result ? 'found' : 'notfound')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (currentSong) fetchLyrics(currentSong)
  }, [currentSong?._id])

  // ── Sync active line ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!lyricsData?.hasSynced || !lyricsData.synced?.length) return
    const lines = lyricsData.synced
    let idx = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime + 0.15) idx = i
      else break
    }
    setActiveIdx(prev => prev === idx ? prev : idx)
  }, [currentTime, lyricsData])

  // ── Scroll active line to center ────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    const lineEl    = lineRefs.current[activeIdx]
    if (!container || !lineEl) return

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect()
      const lineRect      = lineEl.getBoundingClientRect()
      const target = container.scrollTop
        + (lineRect.top - containerRect.top)
        - (container.clientHeight / 2)
        + (lineEl.offsetHeight / 2)
      container.scrollTo({ top: target, behavior: 'smooth' })
    })
  }, [activeIdx])

  // ── States ──────────────────────────────────────────────────────────────────
  if (!currentSong) {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-3 p-6 text-center ${className}`}>
        <Mic2 size={32} className="opacity-20 text-text-muted" />
        <p className="text-sm text-text-muted">Play a song to see lyrics</p>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-3 ${className}`}>
        <Loader2 size={22} className="animate-spin text-brand" />
        <p className="text-sm text-text-muted">Fetching lyrics…</p>
        {searchInfo.title && (
          <p className="text-[10px] text-text-muted opacity-60 text-center px-4">
            "{searchInfo.title}"
            {searchInfo.artist && <> by "{searchInfo.artist}"</>}
          </p>
        )}
      </div>
    )
  }

  if (status === 'notfound' || status === 'error' || !lyricsData) {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-3 p-6 text-center ${className}`}>
        <MicOff size={28} className="opacity-30 text-text-muted" />
        <p className="text-sm font-medium text-text-muted">Lyrics not available</p>
        <p className="text-[10px] text-text-muted opacity-60 leading-relaxed">
          Searched for:<br />
          <span className="text-text-secondary">"{searchInfo.title}"</span>
          {searchInfo.artist && (
            <> by <span className="text-text-secondary">"{searchInfo.artist}"</span></>
          )}
        </p>
        <button
          onClick={() => {
            const k = `${searchInfo.artist.toLowerCase()}|${searchInfo.title.toLowerCase()}`
            MEM.delete(k)
            fetchLyrics(currentSong)
          }}
          className="btn-ghost text-xs flex items-center gap-1.5 mt-1 border border-surface-border"
        >
          <RefreshCw size={11} /> Retry
        </button>
      </div>
    )
  }

  // ── Synced / karaoke ────────────────────────────────────────────────────────
  if (lyricsData.hasSynced && lyricsData.synced?.length > 0) {
    return (
      <div className={`flex flex-col h-full overflow-hidden ${className}`}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border/30 shrink-0">
          <span className="text-[10px] font-bold text-brand uppercase tracking-widest flex items-center gap-1.5">
            <Mic2 size={11} /> Karaoke · click line to seek
          </span>
          <span className="text-[9px] text-text-muted">{lyricsData.source}</span>
        </div>

        <div
          ref={containerRef}
          className="flex-1 scrollbar-hide"
          style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
        >
          <div style={{ height: '45%' }} />

          {lyricsData.synced.map((line, i) => {
            const isActive = i === activeIdx
            const isNear   = Math.abs(i - activeIdx) <= 1
            const isPast   = i < activeIdx
            return (
              <div
                key={i}
                ref={el => { lineRefs.current[i] = el }}
                onClick={() => seek(line.time)}
                style={{
                  textAlign:   'center',
                  padding:     '7px 20px',
                  cursor:      'pointer',
                  userSelect:  'none',
                  transition:  'all 0.3s ease',
                  opacity:     isActive ? 1 : isNear ? 0.5 : isPast ? 0.28 : 0.22,
                  transform:   isActive ? 'scale(1.06)' : 'scale(1)',
                  fontWeight:  isActive ? 700 : 400,
                  fontSize:    isActive ? '1.05rem' : '0.875rem',
                  lineHeight:  1.55,
                  color:       isActive
                    ? 'var(--color-text-primary)'
                    : isPast ? 'var(--color-text-muted)'
                    : 'var(--color-text-secondary)',
                  background:  isActive
                    ? 'linear-gradient(to right,transparent,rgba(108,71,255,0.07),transparent)'
                    : 'transparent',
                  borderRadius: '8px',
                }}
              >
                {line.text}
              </div>
            )
          })}

          <div style={{ height: '50%' }} />
        </div>

        {/* Mini progress strip */}
        <div className="px-4 py-1.5 border-t border-surface-border/20 shrink-0">
          <div className="h-0.5 bg-surface-border rounded-full overflow-hidden">
            <div
              className="h-full bg-brand"
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                transition: 'width 1s linear',
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Plain text lyrics ───────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border/30 shrink-0">
        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-1.5">
          <Mic2 size={11} /> Lyrics
        </span>
        <span className="text-[9px] text-text-muted">{lyricsData.source}</span>
      </div>
      <div
        ref={containerRef}
        className="flex-1 scrollbar-hide px-5 py-4"
        style={{ overflowY: 'auto' }}
      >
        {lyricsData.lyrics.split('\n').map((line, i) => (
          <p key={i} style={{
            lineHeight:   1.75,
            marginBottom: line.trim() === '' ? '0.5rem' : '0',
            fontSize:     '0.875rem',
            color:        line.trim() ? 'var(--color-text-secondary)' : 'transparent',
          }}>
            {line || '\u00A0'}
          </p>
        ))}
        <div style={{ height: '4rem' }} />
      </div>
    </div>
  )
}
