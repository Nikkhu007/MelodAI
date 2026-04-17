/**
 * QuickPicks — 6 colorful gradient tiles for instant access to common moods/genres
 * Shown at top of Home page. Clicking navigates to mood/search.
 */
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import useAuthStore from '../../store/authStore'
import { youtubeAPI } from '../../services/api'
import usePlayerStore from '../../store/playerStore'
import useUIStore from '../../store/uiStore'
import { useState } from 'react'

const TILES = [
  { emoji: '🔥', title: 'Trending',  subtitle: 'Hot right now',      gradient: 'from-red-500 to-orange-500',     q: 'trending hindi songs 2024', useYT: true,  raw: true  },
  { emoji: '💪', title: 'Workout',   subtitle: 'High-energy beats',  gradient: 'from-orange-500 to-pink-500',    mood: 'gym' },
  { emoji: '🎯', title: 'Focus',     subtitle: 'Deep work zone',     gradient: 'from-green-500 to-teal-500',     mood: 'focus' },
  { emoji: '😌', title: 'Chill',     subtitle: 'Wind down',          gradient: 'from-cyan-500 to-blue-500',      mood: 'chill' },
  { emoji: '💜', title: 'Love',      subtitle: 'Romance vibes',      gradient: 'from-pink-500 to-purple-500',    mood: 'romance' },
  { emoji: '😄', title: 'Happy',     subtitle: 'Mood boosters',      gradient: 'from-yellow-500 to-orange-400',  mood: 'happy' },
]

export default function QuickPicks() {
  const navigate           = useNavigate()
  const { setMood }        = useAuthStore()
  const { playSong }       = usePlayerStore()
  const { toast }          = useUIStore()
  const [loading, setLoading] = useState(null)

  const handleClick = async (tile, idx) => {
    if (tile.mood) {
      // Set mood and go to mood page
      await setMood(tile.mood)
      navigate('/mood')
      return
    }

    // Trending → YouTube load
    setLoading(idx)
    try {
      const { data } = await youtubeAPI.search(tile.q, 20, tile.raw)
      const songs = (data.songs || []).map(s => ({ ...s, audioUrl: youtubeAPI.streamUrl(s.ytId) }))
      if (songs.length) {
        playSong(songs[0], songs)
        toast(`Playing ${tile.title.toLowerCase()}`)
      } else {
        toast('No songs found', 'error')
      }
    } catch {
      toast('Could not load', 'error')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {TILES.map((tile, i) => (
        <motion.button
          key={tile.title}
          onClick={() => handleClick(tile, i)}
          whileHover={{ y: -3, scale: 1.01 }}
          whileTap={{ scale: 0.97 }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className={`relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br ${tile.gradient} text-left group`}
          disabled={loading === i}
        >
          <div className="relative z-10">
            <div className="text-3xl mb-2">{tile.emoji}</div>
            <p className="text-sm font-bold text-white">{tile.title}</p>
            <p className="text-[10px] text-white/80 mt-0.5">{tile.subtitle}</p>
          </div>

          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          {loading === i && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </motion.button>
      ))}
    </div>
  )
}
