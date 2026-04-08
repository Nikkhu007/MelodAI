import { useEffect, useRef } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Shuffle, Repeat, Repeat1, Heart, ListMusic
} from 'lucide-react'
import usePlayerStore from '../../store/playerStore'
import useAuthStore from '../../store/authStore'
import useUIStore from '../../store/uiStore'
import { songsAPI } from '../../services/api'

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function PlayingBars() {
  return (
    <span className="playing-bars flex gap-0.5 items-end h-4">
      <span /><span /><span />
    </span>
  )
}

export default function Player() {
  const {
    currentSong, isPlaying, volume, isMuted, currentTime, duration,
    isShuffled, repeatMode, isLoading,
    togglePlay, next, prev, seek, setVolume, toggleMute,
    toggleShuffle, cycleRepeat,
  } = usePlayerStore()

  const { user } = useAuthStore()
  const { openModal, toast } = useUIStore()
  const progressRef = useRef(null)

  // Dynamic progress bar fill
  useEffect(() => {
    if (progressRef.current && duration > 0) {
      const pct = (currentTime / duration) * 100
      progressRef.current.style.background =
        `linear-gradient(to right, #6c47ff ${pct}%, #2d2d3d ${pct}%)`
    }
  }, [currentTime, duration])

  const handleLike = async () => {
    if (!currentSong || !user) return
    const isLiked = user.likedSongs?.includes(currentSong._id)
    const event = isLiked ? 'unlike' : 'like'
    try {
      await songsAPI.trackEvent(currentSong._id, { event, progress: 0, listenDuration: 0 })
      toast(isLiked ? 'Removed from liked songs' : 'Added to liked songs', 'success')
    } catch (err) {
      toast('Failed to update likes', 'error')
    }
  }

  const isLiked = user?.likedSongs?.includes(currentSong?._id)

  if (!currentSong) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 bg-[#0d0d14]/95 backdrop-blur-xl border-t border-surface-border/40 flex items-center justify-center z-50">
        <p className="text-text-muted text-sm">Select a song to start playing</p>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Progress bar — thin strip at top */}
      <div className="h-0.5 bg-surface-border/40 cursor-pointer group" onClick={(e) => {
        if (!duration) return
        const rect = e.currentTarget.getBoundingClientRect()
        seek(((e.clientX - rect.left) / rect.width) * duration)
      }}>
        <div
          className="h-full bg-brand transition-all duration-100"
          style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
        />
      </div>

      <div className="bg-[#0d0d14]/95 backdrop-blur-xl border-t border-surface-border/40 px-4 py-3">
        <div className="max-w-screen-xl mx-auto flex items-center gap-4">

          {/* Song info */}
          <div className="flex items-center gap-3 w-56 min-w-0">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-surface-overlay">
              {currentSong.coverUrl
                ? <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-brand"><ListMusic size={20} /></div>
              }
              {isPlaying && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <PlayingBars />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{currentSong.title}</p>
              <p className="text-xs text-text-muted truncate">{currentSong.artist}</p>
            </div>
            <button
              onClick={handleLike}
              className={`ml-1 shrink-0 transition-colors ${isLiked ? 'text-brand' : 'text-text-muted hover:text-text-primary'}`}
            >
              <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
            </button>
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center flex-1 gap-2">
            <div className="flex items-center gap-4">
              <button
                onClick={toggleShuffle}
                className={`transition-colors ${isShuffled ? 'text-brand' : 'text-text-muted hover:text-text-primary'}`}
              >
                <Shuffle size={16} />
              </button>

              <button onClick={prev} className="text-text-secondary hover:text-text-primary transition-colors">
                <SkipBack size={22} fill="currentColor" />
              </button>

              <button
                onClick={togglePlay}
                disabled={isLoading}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-60"
              >
                {isLoading
                  ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  : isPlaying
                    ? <Pause size={18} fill="black" className="text-black" />
                    : <Play size={18} fill="black" className="text-black ml-0.5" />
                }
              </button>

              <button onClick={next} className="text-text-secondary hover:text-text-primary transition-colors">
                <SkipForward size={22} fill="currentColor" />
              </button>

              <button
                onClick={cycleRepeat}
                className={`transition-colors ${repeatMode !== 'none' ? 'text-brand' : 'text-text-muted hover:text-text-primary'}`}
              >
                {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
              </button>
            </div>

            {/* Seek bar */}
            <div className="flex items-center gap-2 w-full max-w-md">
              <span className="text-xs text-text-muted w-8 text-right">{formatTime(currentTime)}</span>
              <input
                ref={progressRef}
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                className="flex-1 h-1 rounded-full cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #6c47ff ${duration > 0 ? (currentTime/duration)*100 : 0}%, #2d2d3d ${duration > 0 ? (currentTime/duration)*100 : 0}%)`
                }}
              />
              <span className="text-xs text-text-muted w-8">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Volume */}
          <div className="hidden md:flex items-center gap-2 w-32 justify-end">
            <button onClick={toggleMute} className="text-text-muted hover:text-text-primary transition-colors">
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20 h-1 cursor-pointer rounded-full"
              style={{
                background: `linear-gradient(to right, #6c47ff ${(isMuted ? 0 : volume) * 100}%, #2d2d3d ${(isMuted ? 0 : volume) * 100}%)`
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
