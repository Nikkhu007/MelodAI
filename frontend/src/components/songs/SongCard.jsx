import { Play, Pause, ListMusic, Heart, Plus } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import usePlayerStore from '../../store/playerStore'
import useUIStore from '../../store/uiStore'
import useAuthStore from '../../store/authStore'
import { songsAPI } from '../../services/api'

const MOOD_GRADIENT = {
  happy:     'from-yellow-500/20 to-orange-500/10',
  sad:       'from-blue-500/20 to-indigo-500/10',
  energetic: 'from-orange-500/20 to-red-500/10',
  focus:     'from-green-500/20 to-teal-500/10',
  chill:     'from-cyan-500/20 to-blue-500/10',
  gym:       'from-red-500/20 to-orange-500/10',
  romance:   'from-pink-500/20 to-purple-500/10',
}

export default function SongCard({ song, queue = [] }) {
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayerStore()
  const { openModal, toast } = useUIStore()
  const { user } = useAuthStore()
  const [liked,  setLiked]  = useState(user?.likedSongs?.includes(song._id))
  const [imgErr, setImgErr] = useState(false)
  const isActive = currentSong?._id === song._id

  const handlePlay = (e) => {
    e.stopPropagation()
    if (isActive) togglePlay()
    else playSong(song, queue)
  }

  const handleLike = async (e) => {
    e.stopPropagation()
    if (!user) { toast('Login to like songs', 'error'); return }
    const event = liked ? 'unlike' : 'like'
    try {
      await songsAPI.trackEvent(song._id, { event, progress: 0, listenDuration: 0 })
      setLiked(!liked)
      toast(liked ? 'Removed from liked' : '❤️ Liked')
    } catch {}
  }

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`group relative rounded-2xl overflow-hidden cursor-pointer
        bg-gradient-to-br ${MOOD_GRADIENT[song.mood] || 'from-surface-raised to-surface-overlay'}
        border border-surface-border/40 hover:border-brand/30 transition-colors`}
      onClick={handlePlay}
    >
      {/* Cover art */}
      <div className="relative w-full aspect-square overflow-hidden bg-surface-overlay">
        {!imgErr && song.coverUrl
          ? <img src={song.coverUrl} alt={song.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center bg-surface-raised">
              <ListMusic size={32} className="text-text-muted opacity-40" />
            </div>
        }

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Play button */}
        <motion.button
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
          onClick={handlePlay}
          className="absolute bottom-3 right-3 w-11 h-11 rounded-full bg-brand shadow-xl shadow-brand/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0"
        >
          {isActive && isPlaying
            ? <Pause size={20} fill="white" className="text-white" />
            : <Play size={20} fill="white" className="text-white ml-0.5" />
          }
        </motion.button>

        {/* Active indicator */}
        {isActive && isPlaying && (
          <div className="absolute bottom-3 right-3 bg-brand rounded-full w-11 h-11 flex items-center justify-center shadow-lg">
            <span className="playing-bars flex gap-0.5 items-end h-4"><span /><span /><span /></span>
          </div>
        )}

        {/* Like button */}
        <button
          onClick={handleLike}
          className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-all
            opacity-0 group-hover:opacity-100 hover:bg-black/60
            ${liked ? 'text-red-400 opacity-100' : 'text-white'}`}
        >
          <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className={`text-sm font-semibold truncate ${isActive ? 'text-brand' : 'text-text-primary'}`}>
          {song.title}
        </p>
        <p className="text-xs text-text-muted truncate mt-0.5">{song.artist}</p>
        {song.genre && (
          <span className="inline-block mt-2 text-[9px] px-2 py-0.5 rounded-full bg-surface-border/50 text-text-muted capitalize tracking-wide">
            {song.genre}
          </span>
        )}
      </div>
    </motion.div>
  )
}
