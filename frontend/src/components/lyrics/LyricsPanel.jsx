import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic2, Loader2, AlertCircle, RefreshCw, Languages } from 'lucide-react'
import usePlayerStore from '../../store/playerStore'
import { lyricsAPI } from '../../services/api'

// ── In-component cache to avoid re-fetching on song change ──────────────────
const lyricsCache = new Map()

export default function LyricsPanel({ className = '' }) {
  const { currentSong, currentTime } = usePlayerStore()
  const [lyrics, setLyrics] = useState(null)      // plain text
  const [synced, setSynced] = useState(null)       // [{ time, text }]
  const [hasSynced, setHasSynced] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [status, setStatus] = useState('idle')     // idle | loading | found | notfound | error
  const [source, setSource] = useState(null)
  const activeRef = useRef(null)
  const containerRef = useRef(null)

  // ── Fetch lyrics when song changes ────────────────────────────────────────
  const fetchLyrics = useCallback(async (song) => {
    if (!song) return
    const key = `${song.artist}::${song.title}`

    if (lyricsCache.has(key)) {
      const cached = lyricsCache.get(key)
      applyResult(cached)
      return
    }

    setStatus('loading')
    setLyrics(null)
    setSynced(null)

    try {
      const { data } = await lyricsAPI.get(song.artist, song.title)
      const result = {
        lyrics:    data.lyrics,
        synced:    data.synced,
        hasSynced: data.hasSynced,
        source:    data.source,
        found:     data.success,
      }
      lyricsCache.set(key, result)
      applyResult(result)
    } catch {
      setStatus('error')
    }
  }, [])

  function applyResult(r) {
    setLyrics(r.lyrics)
    setSynced(r.synced || null)
    setHasSynced(r.hasSynced || false)
    setSource(r.source)
    setStatus(r.found ? 'found' : 'notfound')
    setActiveIdx(0)
  }

  useEffect(() => {
    if (currentSong) fetchLyrics(currentSong)
  }, [currentSong?._id])

  // ── Sync active lyric line to current playback time ───────────────────────
  useEffect(() => {
    if (!hasSynced || !synced?.length) return
    // Find the last line whose timestamp is ≤ currentTime
    let idx = 0
    for (let i = 0; i < synced.length; i++) {
      if (synced[i].time <= currentTime) idx = i
      else break
    }
    if (idx !== activeIdx) setActiveIdx(idx)
  }, [currentTime, synced, hasSynced])

  // ── Auto-scroll active line into view ─────────────────────────────────────
  useEffect(() => {
    if (!activeRef.current || !containerRef.current) return
    activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeIdx])

  // ── Render states ─────────────────────────────────────────────────────────
  if (!currentSong) {
    return (
      <div className={`flex flex-col items-center justify-center h-full text-text-muted p-8 ${className}`}>
        <Mic2 size={32} className="mb-3 opacity-30" />
        <p className="text-sm">Play a song to see lyrics</p>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-3 ${className}`}>
        <Loader2 size={24} className="animate-spin text-brand" />
        <p className="text-sm text-text-muted">Loading lyrics…</p>
      </div>
    )
  }

  if (status === 'notfound' || status === 'error') {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-3 p-6 text-center ${className}`}>
        <AlertCircle size={28} className="text-text-muted opacity-40" />
        <p className="text-text-muted text-sm font-medium">
          {status === 'error' ? 'Could not load lyrics' : 'Lyrics not available'}
        </p>
        <p className="text-text-muted text-xs">for "{currentSong.title}" by {currentSong.artist}</p>
        <button onClick={() => fetchLyrics(currentSong)} className="btn-ghost text-xs flex items-center gap-1.5 mt-2">
          <RefreshCw size={12} /> Try again
        </button>
      </div>
    )
  }

  // ── Synced (karaoke) mode ─────────────────────────────────────────────────
  if (hasSynced && synced?.length) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border/30 shrink-0">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <Mic2 size={12} className="text-brand" /> Synced Lyrics
          </p>
          {source && <span className="text-[10px] text-text-muted">{source}</span>}
        </div>

        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-2 scrollbar-hide"
        >
          {synced.map((line, i) => (
            <motion.div
              key={i}
              ref={i === activeIdx ? activeRef : null}
              animate={{
                opacity: i === activeIdx ? 1 : 0.35,
                scale:   i === activeIdx ? 1.02 : 1,
              }}
              transition={{ duration: 0.25 }}
              className={`text-center leading-relaxed cursor-pointer transition-all
                ${i === activeIdx
                  ? 'text-text-primary text-lg font-semibold'
                  : 'text-text-muted text-base'
                }`}
              onClick={() => {/* Could seek to this line: seek(line.time) */}}
            >
              {line.text}
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  // ── Plain lyrics mode ─────────────────────────────────────────────────────
  if (lyrics) {
    const lines = lyrics.split('\n')
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border/30 shrink-0">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <Mic2 size={12} /> Lyrics
          </p>
          {source && <span className="text-[10px] text-text-muted">{source}</span>}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide">
          <div className="space-y-1">
            {lines.map((line, i) => (
              <p
                key={i}
                className={`leading-relaxed ${
                  line.trim() === ''
                    ? 'h-3'
                    : 'text-text-secondary text-sm'
                }`}
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return null
}
