import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Shuffle, Repeat, Repeat1, Heart, ListMusic, Maximize2, Minimize2,
  Mic2, List, Gauge, ChevronDown, Youtube, ExternalLink,
} from 'lucide-react'
import usePlayerStore from '../../store/playerStore'
import useAuthStore from '../../store/authStore'
import useUIStore from '../../store/uiStore'
import { songsAPI } from '../../services/api'
import LyricsPanel from '../lyrics/LyricsPanel'
import QueuePanel from './QueuePanel'

function fmt(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2,'0')}`
}

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]

function SeekBar({ currentTime, duration, buffered, onSeek }) {
  const [dragging, setDragging] = useState(false)
  const [hoverTime, setHoverTime] = useState(null)
  const barRef = useRef(null)

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0
  const bufPct = (buffered || 0) * 100

  const getTimeFromEvent = e => {
    const rect = barRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(((e.clientX - rect.left) / rect.width) * duration, duration))
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-xs text-text-muted w-9 text-right tabular-nums">{fmt(currentTime)}</span>
      <div
        ref={barRef}
        className="relative flex-1 h-1 group cursor-pointer"
        onMouseMove={e => setHoverTime(getTimeFromEvent(e))}
        onMouseLeave={() => setHoverTime(null)}
        onClick={e => onSeek(getTimeFromEvent(e))}
      >
        {/* Track */}
        <div className="absolute inset-0 rounded-full bg-surface-border group-hover:h-1.5 transition-all" />
        {/* Buffered */}
        <div className="absolute inset-y-0 left-0 rounded-full bg-surface-border/80" style={{ width: `${bufPct}%` }} />
        {/* Played */}
        <div className="absolute inset-y-0 left-0 rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
        {/* Hover time tooltip */}
        {hoverTime !== null && (
          <div
            className="absolute -top-7 bg-surface-overlay text-text-primary text-[10px] px-1.5 py-0.5 rounded pointer-events-none"
            style={{ left: `calc(${(hoverTime / duration) * 100}% - 16px)` }}
          >
            {fmt(hoverTime)}
          </div>
        )}
      </div>
      <span className="text-xs text-text-muted w-9 tabular-nums">{fmt(duration)}</span>
    </div>
  )
}

function VolumeControl({ volume, isMuted, onVolumeChange, onToggleMute }) {
  const pct = isMuted ? 0 : volume * 100
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={onToggleMute} className="text-text-muted hover:text-text-primary transition-colors">
        {isMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </button>
      <div className="relative w-20">
        <input
          type="range" min={0} max={1} step={0.01} value={isMuted ? 0 : volume}
          onChange={e => onVolumeChange(Number(e.target.value))}
          className="w-full h-1 cursor-pointer rounded-full"
          style={{ background: `linear-gradient(to right, #6c47ff ${pct}%, #2d2d3d ${pct}%)` }}
        />
      </div>
    </div>
  )
}

// ── Mini player (compact floating) ───────────────────────────────────────────
function MiniPlayer({ song, isPlaying, onTogglePlay, onExpand }) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-4 right-4 z-50 glass-card flex items-center gap-3 px-3 py-2 shadow-2xl cursor-pointer w-72"
      onClick={onExpand}
    >
      <img src={song.coverUrl} alt={song.title} className="w-9 h-9 rounded-lg object-cover shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">{song.title}</p>
        <p className="text-[10px] text-text-muted truncate">{song.artist}</p>
      </div>
      <button onClick={e => { e.stopPropagation(); onTogglePlay() }}
        className="w-7 h-7 rounded-full bg-brand flex items-center justify-center shrink-0">
        {isPlaying ? <Pause size={13} fill="white" className="text-white" /> : <Play size={13} fill="white" className="text-white ml-0.5" />}
      </button>
    </motion.div>
  )
}

// ── Full-screen player ────────────────────────────────────────────────────────
function FullPlayer({ onClose }) {
  const {
    currentSong, isPlaying, volume, isMuted, currentTime, duration, buffered,
    isShuffled, repeatMode, isLoading, playbackSpeed, showLyrics, showQueue,
    togglePlay, next, prev, seek, setVolume, toggleMute, toggleShuffle,
    cycleRepeat, setPlaybackSpeed, setPlayerMode, toggleLyrics, toggleQueue,
  } = usePlayerStore()
  const { user } = useAuthStore()
  const { toast } = useUIStore()
  const [speedOpen, setSpeedOpen] = useState(false)
  const [liked, setLiked] = useState(user?.likedSongs?.includes(currentSong?._id))

  if (!currentSong) return null

  const handleLike = async () => {
    if (!user) return
    const event = liked ? 'unlike' : 'like'
    try {
      await songsAPI.trackEvent(currentSong._id, { event, progress: 0, listenDuration: 0 })
      setLiked(!liked)
      toast(liked ? 'Removed from liked' : 'Added to liked')
    } catch { toast('Failed', 'error') }
  }

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-[60] flex flex-col"
      style={{
        background: currentSong.coverUrl
          ? `linear-gradient(180deg, rgba(10,10,15,0.85) 0%, #0a0a0f 60%)`
          : '#0a0a0f',
      }}
    >
      {/* Background art blur */}
      {currentSong.coverUrl && (
        <div className="absolute inset-0 overflow-hidden -z-10">
          <img src={currentSong.coverUrl} alt="" className="w-full h-full object-cover blur-3xl scale-110 opacity-30" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-safe pt-4 pb-2 shrink-0">
        <button onClick={onClose} className="btn-ghost p-2"><ChevronDown size={22} /></button>
        <div className="text-center">
          <p className="text-xs text-text-muted">Now Playing</p>
          {currentSong.isYouTube && (
            <span className="flex items-center justify-center gap-1 text-[10px] text-red-400 mt-0.5">
              <Youtube size={10} /> YouTube
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={toggleQueue} className={`btn-ghost p-2 ${showQueue ? 'text-brand' : ''}`}><List size={18} /></button>
          <button onClick={toggleLyrics} className={`btn-ghost p-2 ${showLyrics ? 'text-brand' : ''}`}><Mic2 size={18} /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main column */}
        <div className="flex flex-col flex-1 px-8 pb-8 overflow-hidden">
          {/* Cover art */}
          <motion.div
            animate={{ scale: isPlaying ? 1 : 0.92 }}
            transition={{ type: 'spring', stiffness: 200 }}
            className="mx-auto my-6 rounded-2xl overflow-hidden shadow-2xl shadow-black/60"
            style={{ width: 'min(340px, 80vw)', aspectRatio: '1' }}
          >
            {currentSong.coverUrl
              ? <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-surface-raised flex items-center justify-center"><ListMusic size={64} className="text-text-muted" /></div>
            }
          </motion.div>

          {/* Song info */}
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-text-primary truncate">{currentSong.title}</h2>
              <p className="text-text-muted mt-0.5">{currentSong.artist}</p>
            </div>
            <div className="flex gap-2 shrink-0 ml-3">
              <button onClick={handleLike} className={`transition-colors ${liked ? 'text-brand' : 'text-text-muted hover:text-text-primary'}`}>
                <Heart size={22} fill={liked ? 'currentColor' : 'none'} />
              </button>
              {currentSong.ytUrl && (
                <a href={currentSong.ytUrl} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-red-400">
                  <ExternalLink size={18} />
                </a>
              )}
            </div>
          </div>

          {/* Seek bar */}
          <SeekBar currentTime={currentTime} duration={duration} buffered={buffered} onSeek={seek} />

          {/* Controls */}
          <div className="flex items-center justify-center gap-6 mt-5">
            <button onClick={toggleShuffle} className={isShuffled ? 'text-brand' : 'text-text-muted hover:text-text-primary'}>
              <Shuffle size={20} />
            </button>
            <button onClick={prev} className="text-text-secondary hover:text-text-primary transition-colors">
              <SkipBack size={28} fill="currentColor" />
            </button>
            <button
              onClick={togglePlay} disabled={isLoading}
              className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-60"
            >
              {isLoading
                ? <div className="w-6 h-6 border-3 border-black border-t-transparent rounded-full animate-spin" />
                : isPlaying
                  ? <Pause size={26} fill="black" className="text-black" />
                  : <Play size={26} fill="black" className="text-black ml-1" />
              }
            </button>
            <button onClick={next} className="text-text-secondary hover:text-text-primary transition-colors">
              <SkipForward size={28} fill="currentColor" />
            </button>
            <button onClick={cycleRepeat} className={repeatMode !== 'none' ? 'text-brand' : 'text-text-muted hover:text-text-primary'}>
              {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
            </button>
          </div>

          {/* Volume + Speed */}
          <div className="flex items-center justify-between mt-6">
            <VolumeControl volume={volume} isMuted={isMuted} onVolumeChange={setVolume} onToggleMute={toggleMute} />
            {/* Speed picker */}
            <div className="relative">
              <button
                onClick={() => setSpeedOpen(o => !o)}
                className="flex items-center gap-1 btn-ghost text-xs border border-surface-border px-2 py-1"
              >
                <Gauge size={13} />
                {playbackSpeed}×
              </button>
              <AnimatePresence>
                {speedOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 5 }}
                    className="absolute bottom-full right-0 mb-2 glass-card p-1 flex flex-col gap-0.5 min-w-[80px]"
                  >
                    {SPEEDS.map(s => (
                      <button
                        key={s}
                        onClick={() => { setPlaybackSpeed(s); setSpeedOpen(false) }}
                        className={`text-xs px-3 py-1.5 rounded-lg text-left transition-colors ${playbackSpeed === s ? 'bg-brand text-white' : 'hover:bg-surface-overlay text-text-secondary'}`}
                      >
                        {s}×
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Side panels */}
        <AnimatePresence>
          {showLyrics && (
            <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }}
              className="w-80 border-l border-surface-border/30 overflow-hidden shrink-0">
              <LyricsPanel />
            </motion.div>
          )}
          {showQueue && !showLyrics && (
            <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }}
              className="w-80 border-l border-surface-border/30 overflow-hidden shrink-0">
              <QueuePanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── Bar player (default bottom bar) ──────────────────────────────────────────
export default function Player() {
  const {
    currentSong, isPlaying, volume, isMuted, currentTime, duration, buffered,
    isShuffled, repeatMode, isLoading, playbackSpeed, playerMode, showLyrics,
    togglePlay, next, prev, seek, setVolume, toggleMute, toggleShuffle,
    cycleRepeat, setPlayerMode, toggleLyrics,
  } = usePlayerStore()

  const { user } = useAuthStore()
  const { toast } = useUIStore()
  const [liked, setLiked] = useState(false)
  const [showFull, setShowFull] = useState(false)

  useEffect(() => {
    setLiked(user?.likedSongs?.includes(currentSong?._id))
  }, [currentSong?._id, user?.likedSongs])

  const handleLike = async () => {
    if (!currentSong || !user) return
    const event = liked ? 'unlike' : 'like'
    try {
      await songsAPI.trackEvent(currentSong._id, { event, progress: 0, listenDuration: 0 })
      setLiked(!liked)
      toast(liked ? 'Removed from liked songs' : 'Added to liked songs')
    } catch { toast('Failed to update likes', 'error') }
  }

  if (!currentSong) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-18 bg-[#0d0d14]/95 backdrop-blur-xl border-t border-surface-border/40 flex items-center justify-center z-50 px-4">
        <p className="text-text-muted text-sm">Select a song to start playing 🎵</p>
      </div>
    )
  }

  if (playerMode === 'mini') {
    return <MiniPlayer song={currentSong} isPlaying={isPlaying} onTogglePlay={togglePlay} onExpand={() => setPlayerMode('bar')} />
  }

  return (
    <>
      <AnimatePresence>
        {showFull && <FullPlayer onClose={() => setShowFull(false)} />}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 z-50">
        {/* Top seek strip */}
        <div
          className="h-1 bg-surface-border/40 cursor-pointer group relative"
          onClick={e => {
            if (!duration) return
            const rect = e.currentTarget.getBoundingClientRect()
            seek(((e.clientX - rect.left) / rect.width) * duration)
          }}
        >
          {/* Buffered */}
          <div className="absolute inset-y-0 left-0 bg-surface-overlay/60" style={{ width: `${(buffered || 0) * 100}%` }} />
          {/* Played */}
          <div className="absolute inset-y-0 left-0 bg-brand transition-all duration-75" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
        </div>

        <div className="bg-[#0d0d14]/96 backdrop-blur-xl border-t border-surface-border/40 px-3 py-2.5">
          <div className="max-w-screen-xl mx-auto flex items-center gap-3 md:gap-5">

            {/* Song info — click to open full player */}
            <div
              className="flex items-center gap-2.5 w-48 md:w-56 min-w-0 cursor-pointer group"
              onClick={() => setShowFull(true)}
            >
              <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-surface-overlay">
                {currentSong.coverUrl
                  ? <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-brand"><ListMusic size={18} /></div>
                }
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Maximize2 size={14} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate leading-tight">{currentSong.title}</p>
                <p className="text-xs text-text-muted truncate">{currentSong.artist}</p>
              </div>
            </div>

            {/* Like */}
            <button
              onClick={handleLike}
              className={`shrink-0 transition-colors hidden sm:flex ${liked ? 'text-brand' : 'text-text-muted hover:text-text-primary'}`}
            >
              <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
            </button>

            {/* Controls */}
            <div className="flex flex-col items-center flex-1 gap-1.5">
              <div className="flex items-center gap-3 md:gap-4">
                <button onClick={toggleShuffle} className={`transition-colors hidden sm:flex ${isShuffled ? 'text-brand' : 'text-text-muted hover:text-text-primary'}`}>
                  <Shuffle size={15} />
                </button>
                <button onClick={prev} className="text-text-secondary hover:text-text-primary transition-colors">
                  <SkipBack size={20} fill="currentColor" />
                </button>
                <button
                  onClick={togglePlay} disabled={isLoading}
                  className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-60 shadow"
                >
                  {isLoading
                    ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    : isPlaying
                      ? <Pause size={16} fill="black" className="text-black" />
                      : <Play size={16} fill="black" className="text-black ml-0.5" />
                  }
                </button>
                <button onClick={next} className="text-text-secondary hover:text-text-primary transition-colors">
                  <SkipForward size={20} fill="currentColor" />
                </button>
                <button onClick={cycleRepeat} className={`transition-colors hidden sm:flex ${repeatMode !== 'none' ? 'text-brand' : 'text-text-muted hover:text-text-primary'}`}>
                  {repeatMode === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
                </button>
              </div>
              {/* Seek bar — hidden on mobile, visible md+ */}
              <div className="hidden md:flex items-center gap-2 w-full max-w-md">
                <span className="text-xs text-text-muted w-8 text-right tabular-nums">{fmt(currentTime)}</span>
                <SeekBar currentTime={currentTime} duration={duration} buffered={buffered} onSeek={seek} />
                <span className="text-xs text-text-muted w-8 tabular-nums">{fmt(duration)}</span>
              </div>
            </div>

            {/* Right controls */}
            <div className="hidden md:flex items-center gap-2">
              <button onClick={toggleLyrics} className={`btn-ghost p-1.5 ${showLyrics ? 'text-brand' : 'text-text-muted'}`} title="Lyrics">
                <Mic2 size={15} />
              </button>
              <VolumeControl volume={volume} isMuted={isMuted} onVolumeChange={setVolume} onToggleMute={toggleMute} />
              <button onClick={() => setShowFull(true)} className="btn-ghost p-1.5 text-text-muted hover:text-text-primary" title="Full player">
                <Maximize2 size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
