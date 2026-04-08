import { useState } from 'react'
import { X } from 'lucide-react'
import useUIStore from '../../store/uiStore'
import { playlistsAPI } from '../../services/api'

export default function CreatePlaylistModal() {
  const { closeModal, toast } = useUIStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      await playlistsAPI.create({ name: name.trim(), description, isPublic })
      toast('Playlist created!')
      closeModal('createPlaylist')
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to create', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-text-primary">Create Playlist</h2>
          <button onClick={() => closeModal('createPlaylist')} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs text-text-muted mb-1.5 block">Name *</label>
            <input
              className="input-field"
              placeholder="My awesome playlist"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-text-muted mb-1.5 block">Description</label>
            <textarea
              className="input-field resize-none"
              placeholder="What's this playlist about?"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 accent-brand"
            />
            <span className="text-sm text-text-secondary">Make public</span>
          </label>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Creating...' : 'Create Playlist'}
          </button>
        </form>
      </div>
    </div>
  )
}
