import { useEffect, useState } from 'react'
import { X, Plus, Check, ListMusic } from 'lucide-react'
import useUIStore from '../../store/uiStore'
import { playlistsAPI } from '../../services/api'

export default function AddToPlaylistModal() {
  const { closeModal, selectedSongForPlaylist, toast } = useUIStore()
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [added, setAdded] = useState({})

  useEffect(() => {
    playlistsAPI.getAll({ myPlaylists: true })
      .then(({ data }) => setPlaylists(data.playlists || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async (playlistId) => {
    try {
      await playlistsAPI.addSong(playlistId, selectedSongForPlaylist._id)
      setAdded((prev) => ({ ...prev, [playlistId]: true }))
      toast('Added to playlist!')
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to add', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-text-primary">Add to Playlist</h2>
          <button onClick={() => closeModal('addToPlaylist')} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
        ) : playlists.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-8">No playlists yet. Create one first!</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {playlists.map((pl) => (
              <button
                key={pl._id}
                onClick={() => handleAdd(pl._id)}
                disabled={added[pl._id]}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-overlay transition-all text-left disabled:opacity-60"
              >
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-overlay shrink-0">
                  {pl.coverUrl
                    ? <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-text-muted"><ListMusic size={16} /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{pl.name}</p>
                  <p className="text-xs text-text-muted">{pl.songs?.length || 0} songs</p>
                </div>
                {added[pl._id]
                  ? <Check size={16} className="text-brand shrink-0" />
                  : <Plus size={16} className="text-text-muted shrink-0" />
                }
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
