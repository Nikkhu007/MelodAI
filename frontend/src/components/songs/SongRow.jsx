import { Play, Pause, MoreHorizontal, Heart, Plus, ListMusic } from 'lucide-react'
import usePlayerStore from '../../store/playerStore'
import useUIStore from '../../store/uiStore'
import useAuthStore from '../../store/authStore'
import { songsAPI } from '../../services/api'
import { useState } from 'react'

function formatDuration(s) {
  if (!s) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const MOOD_COLOR = {
  happy: 'bg-yellow-500/20 text-yellow-400',
  sad: 'bg-blue-500/20 text-blue-400',
  energetic: 'bg-orange-500/20 text-orange-400',
  focus: 'bg-green-500/20 text-green-400',
  chill: 'bg-cyan-500/20 text-cyan-400',
  gym: 'bg-red-500/20 text-red-400',
  romance: 'bg-pink-500/20 text-pink-400',
}

export default function SongRow({ song, index, queue = [], showIndex = false }) {
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayerStore()
  const { openModal, toast } = useUIStore()
  const { user } = useAuthStore()
  const [liked, setLiked] = useState(user?.likedSongs?.includes(song._id))
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = currentSong?._id === song._id

  const handlePlay = () => {
    if (isActive) {
      togglePlay()
    } else {
      playSong(song, queue)
    }
  }

  const handleLike = async (e) => {
    e.stopPropagation()
    if (!user) return
    const event = liked ? 'unlike' : 'like'
    try {
      await songsAPI.trackEvent(song._id, { event, progress: 0, listenDuration: 0 })
      setLiked(!liked)
      toast(liked ? 'Removed from liked songs' : 'Saved to liked songs')
    } catch {
      toast('Failed', 'error')
    }
  }

  return (
    <div
      className={`song-row ${isActive ? 'bg-brand/10' : ''}`}
      onClick={handlePlay}
    >
      {/* Index or play icon */}
      <div className="w-8 flex items-center justify-center shrink-0">
        {isActive && isPlaying ? (
          <span className="playing-bars flex gap-0.5 items-end h-4">
            <span /><span /><span />
          </span>
        ) : (
          <span className="text-text-muted text-sm group-hover:hidden">
            {showIndex ? index + 1 : null}
          </span>
        )}
        <button className="hidden group-hover:flex text-text-primary">
          {isActive && isPlaying
            ? <Pause size={16} fill="currentColor" />
            : <Play size={16} fill="currentColor" />}
        </button>
      </div>

      {/* Cover */}
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-overlay shrink-0">
        {song.thumbnail
  ? <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-text-muted"><ListMusic size={16} /></div>
        }
      </div>

      {/* Title + artist */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? 'text-brand' : 'text-text-primary'}`}>
          {song.title}
        </p>
        <p className="text-xs text-text-muted truncate">{song.artist}</p>
      </div>

      {/* Mood tag */}
      {song.mood && (
        <span className={`hidden md:inline-flex text-xs px-2 py-0.5 rounded-full ${MOOD_COLOR[song.mood] || 'bg-surface-overlay text-text-muted'}`}>
          {song.mood}
        </span>
      )}

      {/* Duration */}
      <span className="text-xs text-text-muted w-10 text-right">{formatDuration(song.duration)}</span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleLike}
          className={`p-1.5 rounded-lg transition-colors ${liked ? 'text-brand' : 'text-text-muted hover:text-text-primary'}`}
        >
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <button
          onClick={() => openModal('addToPlaylist', { selectedSongForPlaylist: song })}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary transition-colors"
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  )
}
