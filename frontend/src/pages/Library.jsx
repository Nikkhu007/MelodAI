import { useEffect, useState } from 'react'
import { Plus, Sparkles, RefreshCw } from 'lucide-react'
import { playlistsAPI } from '../services/api'
import useUIStore from '../store/uiStore'
import useAuthStore from '../store/authStore'
import PlaylistCard from '../components/playlists/PlaylistCard'
import { SkeletonCard } from '../components/ui/Skeleton'

export default function Library() {
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const { openModal, toast } = useUIStore()
  const { user } = useAuthStore()

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await playlistsAPI.getAll({ myPlaylists: true })
      setPlaylists(data.playlists || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const { data } = await playlistsAPI.generateAI({ mood: user?.currentMood })
      setPlaylists((p) => [data.playlist, ...p])
      toast('AI playlist generated! 🎵')
    } catch {
      toast('Could not generate playlist', 'error')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="pt-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Your Library</h1>
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-ghost flex items-center gap-1.5 text-sm border border-surface-border"
          >
            {generating ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
            AI Generate
          </button>
          <button
            onClick={() => openModal('createPlaylist')}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Plus size={15} />
            New Playlist
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array(8).fill(0).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : playlists.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted mb-4">No playlists yet.</p>
          <button onClick={() => openModal('createPlaylist')} className="btn-primary">
            Create your first playlist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {playlists.map((pl) => <PlaylistCard key={pl._id} playlist={pl} />)}
        </div>
      )}
    </div>
  )
}
