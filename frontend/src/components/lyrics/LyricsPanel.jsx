import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic2, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import usePlayerStore from '../../store/playerStore'
import { lyricsAPI } from '../../services/api'

const lyricsCache = new Map()

// Clean YouTube-style titles for better lyrics matching
function cleanTitle(title = '', artist = '') {
  let t = title
    .replace(/\(official.*?\)/gi, '').replace(/\[official.*?\]/gi, '')
    .replace(/official\s+(video|audio|lyric|music video)/gi, '')
    .replace(/\(lyrics?\)/gi, '').replace(/\[lyrics?\]/gi, '')
    .replace(/ft\..*$/gi, '').replace(/feat\..*$/gi, '')
    .replace(/\(.*?remix.*?\)/gi, '').replace(/\|.*$/g, '')
    .replace(/[-–—].*$/, '').trim()

  let a = artist
    .replace(/VEVO$/i, '').replace(/Official$/i, '')
    .replace(/ - Topic$/i, '').trim()

  return { title: t || title, artist: a || artist }
}

export default function LyricsPanel({ className = '' }) {
  const { currentSong, currentTime, seek } = usePlayerStore()
  const [lyrics,    setLyrics]    = useState(null)
  const [synced,    setSynced]    = useState(null)
  const [hasSynced, setHasSynced] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [status,    setStatus]    = useState('idle')
  const [source,    setSource]    = useState(null)
  const activeRef   = useRef(null)
  const containerRef = useRef(null)
  const isScrolling  = useRef(false)

  const fetchLyrics = useCallback(async (song) => {
    if (!song) return
    const { title, artist } = cleanTitle(song.title, song.artist)
    const key = `${artist}::${title}`

    if (lyricsCache.has(key)) {
      applyResult(lyricsCache.get(key))
      return
    }

    setStatus('loading')
    setLyrics(null)
    setSynced(null)
    setActiveIdx(0)

    try {
      const { data } = await lyricsAPI.get(artist, title)
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

  // Sync active line to playback time
  useEffect(() => {
    if (!hasSynced || !synced?.length || isScrolling.current) return
    let idx = 0
    for (let i = 0; i < synced.length; i++) {
      if (synced[i].time <= currentTime + 0.3) idx = i
      else break
    }
    if (idx !== activeIdx) setActiveIdx(idx)
  }, [currentTime, synced, hasSynced])

  // Auto-scroll active line into view
  useEffect(() => {
    if (!activeRef.current || !containerRef.current) return
    isScrolling.current = true
    activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => { isScrolling.current = false }, 600)
  }, [activeIdx])

  // Click on a synced line → seek to that time
  const handleLineClick = (time) => {
    if (typeof seek === 'function') seek(time)
  }

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
        <p className="text-text-muted text-[11px] px-4">
          Lyrics for YouTube songs may not be available due to title format.
        </p>
        <button onClick={() => fetchLyrics(currentSong)}
          className="btn-ghost text-xs flex items-center gap-1.5 mt-2">
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    )
  }

  // Synced karaoke mode
  if (hasSynced && synced?.length) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border/30 shrink-0">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <Mic2 size={11} className="text-brand" /> Synced
          </span>
          {source && <span className="text-[9px] text-text-muted">{source}</span>}
        </div>

        <div ref={containerRef} className="flex-1 overflow-y-auto px-5 py-8 space-y-3 scrollbar-hide">
          {synced.map((line, i) => (
            <motion.div
              key={i}
              ref={i === activeIdx ? activeRef : null}
              animate={{
                opacity: i === activeIdx ? 1 : i === activeIdx - 1 || i === activeIdx + 1 ? 0.5 : 0.25,
                scale:   i === activeIdx ? 1.04 : 1,
                y:       0,
              }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              onClick={() => handleLineClick(line.time)}
              title={`Seek to ${Math.floor(line.time/60)}:${String(Math.floor(line.time%60)).padStart(2,'0')}`}
              className={`text-center leading-relaxed cursor-pointer select-none transition-colors
                ${i === activeIdx
                  ? 'text-text-primary text-lg font-bold'
                  : 'text-text-muted text-base hover:text-text-secondary'
                }`}
            >
              {line.text}
            </motion.div>
          ))}
          {/* Bottom padding so last line can scroll to center */}
          <div className="h-40" />
        </div>
      </div>
    )
  }

  // Plain lyrics
  if (lyrics) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border/30 shrink-0">
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <Mic2 size={11} /> Lyrics
          </span>
          {source && <span className="text-[9px] text-text-muted">{source}</span>}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-hide">
          {lyrics.split('\n').map((line, i) => (
            <p key={i} className={`leading-relaxed ${line.trim() === '' ? 'h-4' : 'text-text-secondary text-sm'}`}>
              {line}
            </p>
          ))}
          <div className="h-20" />
        </div>
      </div>
    )
  }

  return null
}
