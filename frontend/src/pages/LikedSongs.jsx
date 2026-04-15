import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, Play, Shuffle } from 'lucide-react'
import { usersAPI } from '../services/api'
import usePlayerStore from '../store/playerStore'
import SongRow from '../components/songs/SongRow'
import { SkeletonRow } from '../components/ui/Skeleton'

function fmtTotal(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

export default function LikedSongs() {
  const [songs,   setSongs]   = useState([])
  const [loading, setLoading] = useState(true)
  const { playSong } = usePlayerStore()

  useEffect(() => {
    usersAPI.getLiked()
      .then(({ data }) => setSongs(data.songs || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleShuffle = () => {
    const shuffled = [...songs].sort(() => Math.random() - 0.5)
    if (shuffled.length) playSong(shuffled[0], shuffled)
  }

  const totalDuration = songs.reduce((acc, s) => acc + (s.duration || 0), 0)

  return (
    <div className="pt-6 animate-fade-in">
      {/* Header */}
      <div className="flex gap-5 mb-8 flex-wrap">
        <div className="w-36 h-36 rounded-2xl bg-gradient-to-br from-brand/40 to-pink-600/30 flex items-center justify-center shadow-xl shrink-0">
          <Heart size={48} className="text-white" fill="currentColor" />
        </div>
        <div className="flex flex-col justify-end">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Playlist</p>
          <h1 className="text-3xl font-bold text-text-primary">Liked Songs</h1>
          <p className="text-text-muted text-sm mt-1">
            {songs.length} songs
            {totalDuration > 0 && ` · ${fmtTotal(totalDuration)}`}
          </p>
          {songs.length > 0 && (
            <div className="flex gap-2 mt-4">
              <button onClick={() => playSong(songs[0], songs)} className="btn-primary flex items-center gap-2 text-sm">
                <Play size={14} fill="currentColor" /> Play All
              </button>
              <button onClick={handleShuffle} className="btn-ghost flex items-center gap-2 text-sm border border-surface-border">
                <Shuffle size={14} /> Shuffle
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-1">{Array(8).fill(0).map((_,i) => <SkeletonRow key={i} />)}</div>
      ) : songs.length === 0 ? (
        <div className="text-center py-20">
          <Heart size={40} className="text-text-muted mx-auto mb-4 opacity-30" />
          <p className="text-text-muted font-medium">No liked songs yet</p>
          <p className="text-text-muted text-sm mt-1">Tap ♥ on any song to save it here</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {songs.map((song, i) => (
            <SongRow key={song._id} song={song} index={i} queue={songs} showIndex />
          ))}
        </div>
      )}
    </div>
  )
}
