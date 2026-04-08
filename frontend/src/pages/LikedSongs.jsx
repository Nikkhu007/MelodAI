import { useEffect, useState } from 'react'
import { Heart, Play, Shuffle } from 'lucide-react'
import { usersAPI } from '../services/api'
import usePlayerStore from '../store/playerStore'
import SongRow from '../components/songs/SongRow'
import { SkeletonRow } from '../components/ui/Skeleton'

export default function LikedSongs() {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const { playSong } = usePlayerStore()

  useEffect(() => {
    usersAPI.getLiked()
      .then(({ data }) => setSongs(data.songs || []))
      .finally(() => setLoading(false))
  }, [])

  const handleShuffle = () => {
    const shuffled = [...songs].sort(() => Math.random() - 0.5)
    if (shuffled.length) playSong(shuffled[0], shuffled)
  }

  const totalDuration = songs.reduce((acc, s) => acc + (s.duration || 0), 0)
  const fmt = (s) => { const m = Math.floor(s / 60); return `${m} min` }

  return (
    <div className="pt-6 animate-fade-in">
      {/* Header */}
      <div className="flex gap-6 mb-8">
        <div className="w-40 h-40 rounded-2xl bg-gradient-to-br from-brand/40 to-pink-500/30 flex items-center justify-center shrink-0 shadow-xl">
          <Heart size={52} className="text-brand" fill="currentColor" />
        </div>
        <div className="flex flex-col justify-end">
          <p className="text-xs text-text-muted uppercase tracking-widest mb-1">Playlist</p>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Liked Songs</h1>
          <p className="text-text-muted text-sm">{songs.length} songs · {fmt(totalDuration)}</p>
          {songs.length > 0 && (
            <div className="flex gap-3 mt-4">
              <button onClick={() => playSong(songs[0], songs)} className="btn-primary flex items-center gap-2">
                <Play size={16} fill="currentColor" /> Play All
              </button>
              <button onClick={handleShuffle} className="btn-ghost flex items-center gap-2 border border-surface-border">
                <Shuffle size={15} /> Shuffle
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-1">{Array(8).fill(0).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : songs.length === 0 ? (
        <div className="text-center py-20">
          <Heart size={40} className="text-text-muted mx-auto mb-4" />
          <p className="text-text-muted">No liked songs yet.</p>
          <p className="text-text-muted text-sm mt-1">Like songs to see them here.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {songs.map((song, i) => (
            <SongRow key={song._id} song={song} index={i} queue={songs} showIndex />
          ))}
        </div>
      )}
    </div>
  )
}
