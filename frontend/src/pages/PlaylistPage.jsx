import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Play, Shuffle, Trash2, Sparkles, ListMusic, ArrowLeft } from 'lucide-react'
import { playlistsAPI, recommendAPI } from '../services/api'
import usePlayerStore from '../store/playerStore'
import useAuthStore from '../store/authStore'
import useUIStore from '../store/uiStore'
import SongRow from '../components/songs/SongRow'
import SongCard from '../components/songs/SongCard'
import { SkeletonRow } from '../components/ui/Skeleton'

export default function PlaylistPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { playSong } = usePlayerStore()
  const { user } = useAuthStore()
  const { toast } = useUIStore()

  const [playlist, setPlaylist] = useState(null)
  const [similar, setSimilar] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    playlistsAPI.getOne(id)
      .then(({ data }) => {
        setPlaylist(data.playlist)
        // Load similar songs based on first track
        const firstSong = data.playlist?.songs?.[0]
        if (firstSong?._id) {
          recommendAPI.getSimilar(firstSong._id)
            .then(({ data: simData }) => setSimilar(simData.songs || []))
            .catch(() => {})
        }
      })
      .catch(() => navigate('/library'))
      .finally(() => setLoading(false))
  }, [id])

  const handlePlayAll = () => {
    const songs = playlist?.songs || []
    if (songs.length) playSong(songs[0], songs)
  }

  const handleShuffle = () => {
    const songs = [...(playlist?.songs || [])]
    if (!songs.length) return
    const shuffled = songs.sort(() => Math.random() - 0.5)
    playSong(shuffled[0], shuffled)
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this playlist?')) return
    try {
      await playlistsAPI.delete(id)
      toast('Playlist deleted')
      navigate('/library')
    } catch {
      toast('Failed to delete', 'error')
    }
  }

  const handleRemoveSong = async (songId) => {
    try {
      await playlistsAPI.removeSong(id, songId)
      setPlaylist((p) => ({ ...p, songs: p.songs.filter((s) => s._id !== songId) }))
      toast('Removed from playlist')
    } catch {
      toast('Failed', 'error')
    }
  }

  const isOwner = playlist?.owner?._id === user?._id || playlist?.owner === user?._id

  const totalDuration = playlist?.songs?.reduce((acc, s) => acc + (s.duration || 0), 0) || 0
  const formatTotal = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m} min`
  }

  if (loading) return (
    <div className="pt-6 space-y-2">
      {Array(10).fill(0).map((_, i) => <SkeletonRow key={i} />)}
    </div>
  )

  if (!playlist) return null

  return (
    <div className="pt-6 animate-fade-in">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="btn-ghost mb-4 flex items-center gap-2 text-sm">
        <ArrowLeft size={16} /> Back
      </button>

      {/* Header */}
      <div className="flex gap-6 mb-8 flex-wrap">
        <div className="w-44 h-44 rounded-2xl overflow-hidden bg-surface-overlay shrink-0 shadow-xl shadow-black/40">
          {playlist.coverUrl
            ? <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
            : (
              <div className="w-full h-full grid grid-cols-2 gap-0.5">
                {playlist.songs?.slice(0, 4).map((s, i) =>
                  s?.coverUrl
                    ? <img key={i} src={s.coverUrl} alt="" className="w-full h-full object-cover" />
                    : <div key={i} className="bg-surface-border flex items-center justify-center"><ListMusic size={14} className="text-text-muted" /></div>
                )}
                {!playlist.songs?.length && (
                  <div className="col-span-2 row-span-2 flex items-center justify-center"><ListMusic size={32} className="text-text-muted" /></div>
                )}
              </div>
            )
          }
        </div>
        <div className="flex flex-col justify-end">
          {playlist.isAIGenerated && (
            <span className="inline-flex items-center gap-1 text-xs text-brand mb-2">
              <Sparkles size={12} /> AI Generated
            </span>
          )}
          <h1 className="text-3xl font-bold text-text-primary mb-1">{playlist.name}</h1>
          {playlist.description && <p className="text-text-muted text-sm mb-2">{playlist.description}</p>}
          {playlist.aiGeneratedReason && <p className="text-brand/70 text-xs mb-2">{playlist.aiGeneratedReason}</p>}
          <p className="text-text-muted text-sm">
            {playlist.owner?.username} · {playlist.songs?.length || 0} songs · {formatTotal(totalDuration)}
          </p>
          <div className="flex gap-3 mt-5">
            <button onClick={handlePlayAll} className="btn-primary flex items-center gap-2">
              <Play size={16} fill="currentColor" /> Play All
            </button>
            <button onClick={handleShuffle} className="btn-ghost flex items-center gap-2 border border-surface-border">
              <Shuffle size={15} /> Shuffle
            </button>
            {isOwner && (
              <button onClick={handleDelete} className="btn-ghost text-red-400 hover:text-red-300 flex items-center gap-2">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Song list */}
      {playlist.songs?.length === 0 ? (
        <p className="text-text-muted text-center py-12">No songs in this playlist yet.</p>
      ) : (
        <div className="space-y-1">
          {playlist.songs.map((song, i) => (
            <div key={song._id} className="group relative">
              <SongRow song={song} index={i} queue={playlist.songs} showIndex />
              {isOwner && (
                <button
                  onClick={() => handleRemoveSong(song._id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-text-muted hover:text-red-400 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Similar songs section */}
      {similar.length > 0 && (
        <div className="mt-10">
          <h2 className="section-title flex items-center gap-2">
            <Sparkles size={16} className="text-brand" /> You might also like
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {similar.slice(0, 8).map((song) => (
              <SongCard key={song._id} song={song} queue={similar} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
