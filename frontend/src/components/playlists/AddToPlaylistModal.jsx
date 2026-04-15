import { useEffect, useState } from 'react'
import { X, Plus, Check, ListMusic, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import useUIStore from '../../store/uiStore'
import { playlistsAPI } from '../../services/api'

export default function AddToPlaylistModal() {
  const { closeModal, selectedSongForPlaylist: song, toast } = useUIStore()
  const [playlists, setPlaylists] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [added,     setAdded]     = useState({})
  const [creating,  setCreating]  = useState(false)
  const [newName,   setNewName]   = useState('')

  useEffect(() => {
    playlistsAPI.getAll({ myPlaylists: true })
      .then(({ data }) => setPlaylists(data.playlists || []))
      .catch(() => toast('Could not load playlists', 'error'))
      .finally(() => setLoading(false))
  }, [])

  if (!song) return null

  const handleAdd = async (playlistId) => {
    if (added[playlistId]) return
    try {
      // Pass full song metadata so the backend can store it even for
      // external songs (YouTube / Jamendo) that aren't in the DB
      await playlistsAPI.addSong(playlistId, song._id, song)
      setAdded(prev => ({ ...prev, [playlistId]: true }))
      toast('Added to playlist ✓')
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to add', 'error')
    }
  }

  const handleCreateAndAdd = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const { data } = await playlistsAPI.create({ name: newName.trim(), isPublic: false })
      const newPl = data.playlist
      setPlaylists(prev => [newPl, ...prev])
      // immediately add the song to the new playlist
      await playlistsAPI.addSong(newPl._id, song._id, song)
      setAdded(prev => ({ ...prev, [newPl._id]: true }))
      setNewName('')
      toast(`Added to "${newPl.name}" ✓`)
    } catch (err) {
      toast(err.response?.data?.message || 'Failed', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => closeModal('addToPlaylist')}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="glass-card w-full max-w-sm mx-4 mb-4 sm:mb-0 p-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0 flex-1 mr-3">
            <h2 className="font-semibold text-text-primary">Add to Playlist</h2>
            <p className="text-xs text-text-muted mt-0.5 truncate">
              {song.title} — {song.artist}
            </p>
          </div>
          <button onClick={() => closeModal('addToPlaylist')} className="text-text-muted hover:text-text-primary shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Quick-create new playlist */}
        <form onSubmit={handleCreateAndAdd} className="flex gap-2 mb-4">
          <input
            className="input-field py-2 text-sm flex-1 min-w-0"
            placeholder="New playlist name…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="btn-primary py-2 px-3 text-sm shrink-0"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          </button>
        </form>

        {/* Existing playlists */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-brand" />
          </div>
        ) : playlists.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-6">
            No playlists yet — create one above!
          </p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto scrollbar-hide">
            {playlists.map(pl => (
              <button
                key={pl._id}
                onClick={() => handleAdd(pl._id)}
                disabled={!!added[pl._id]}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-overlay transition-all text-left disabled:opacity-60"
              >
                {/* Cover */}
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-overlay shrink-0">
                  {pl.coverUrl
                    ? <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <ListMusic size={15} className="text-text-muted" />
                      </div>
                  }
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{pl.name}</p>
                  <p className="text-xs text-text-muted">
                    {(pl.songs?.length || 0) + (pl.externalSongs?.length || 0)} songs
                  </p>
                </div>
                {/* Status icon */}
                {added[pl._id]
                  ? <Check size={16} className="text-green-400 shrink-0" />
                  : <Plus size={15} className="text-text-muted shrink-0" />
                }
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
