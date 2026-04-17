import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Sparkles, RefreshCw, Search, Grid, List, SortAsc, SortDesc, Shuffle } from 'lucide-react'
import { playlistsAPI } from '../services/api'
import useUIStore from '../store/uiStore'
import useAuthStore from '../store/authStore'
import usePlayerStore from '../store/playerStore'
import PlaylistCard from '../components/playlists/PlaylistCard'
import { SkeletonCard } from '../components/ui/Skeleton'

const SORT_OPTIONS = [
  { value: 'newest',   label: 'Recently created' },
  { value: 'oldest',   label: 'Oldest first' },
  { value: 'name',     label: 'Name A–Z' },
  { value: 'songs',    label: 'Most songs' },
]

export default function Library() {
  const [playlists,  setPlaylists]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
  const [search,     setSearch]     = useState('')
  const [view,       setView]       = useState(() => localStorage.getItem('melodai_library_view') || 'grid')
  const [sort,       setSort]       = useState('newest')
  const { openModal, toast } = useUIStore()
  const { user }             = useAuthStore()
  const { playSong }         = usePlayerStore()

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await playlistsAPI.getAll({ myPlaylists: true })
      setPlaylists(data.playlists || [])
    } catch {
      toast('Could not load library', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const setViewMode = (mode) => {
    setView(mode)
    localStorage.setItem('melodai_library_view', mode)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const { data } = await playlistsAPI.generateAI({ mood: user?.currentMood })
      setPlaylists(p => [data.playlist, ...p])
      toast('AI playlist generated! 🎵')
    } catch { toast('Could not generate playlist', 'error') }
    finally   { setGenerating(false) }
  }

  const handlePlayAll = () => {
    const allSongs = playlists.flatMap(pl => pl.songs || []).filter(Boolean)
    const shuffled = [...allSongs].sort(() => Math.random() - 0.5)
    if (shuffled.length) playSong(shuffled[0], shuffled)
    else toast('No songs in library', 'info')
  }

  // Filter + sort
  const filtered = useMemo(() => {
    let list = playlists.filter(pl =>
      !search || pl.name.toLowerCase().includes(search.toLowerCase())
    )
    switch (sort) {
      case 'oldest': return [...list].reverse()
      case 'name':   return [...list].sort((a,b) => a.name.localeCompare(b.name))
      case 'songs':  return [...list].sort((a,b) => (b.songs?.length||0) - (a.songs?.length||0))
      default:       return list
    }
  }, [playlists, search, sort])

  const totalSongs = playlists.reduce((acc, pl) => acc + (pl.songs?.length || 0), 0)

  return (
    <div className="pt-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Your Library</h1>
          <p className="text-text-muted text-sm mt-0.5">
            {playlists.length} playlists · {totalSongs} songs
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {totalSongs > 0 && (
            <button onClick={handlePlayAll} className="btn-ghost flex items-center gap-1.5 text-sm border border-surface-border">
              <Shuffle size={14} /> Shuffle All
            </button>
          )}
          <button onClick={handleGenerate} disabled={generating}
            className="btn-ghost flex items-center gap-1.5 text-sm border border-surface-border">
            {generating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
            AI Generate
          </button>
          <button onClick={() => openModal('createPlaylist')} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={14} /> New Playlist
          </button>
        </div>
      </div>

      {/* Controls bar */}
      {!loading && playlists.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              className="input-field pl-8 py-2 text-sm"
              placeholder="Search playlists…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="input-field py-2 text-sm w-auto pr-8 cursor-pointer"
            style={{ width: 'auto' }}
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-surface-border">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${view === 'grid' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'}`}
            >
              <Grid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${view === 'list' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'}`}
            >
              <List size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array(8).fill(0).map((_,i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
          {search ? (
            <>
              <p className="text-text-muted mb-2">No playlists matching "{search}"</p>
              <button onClick={() => setSearch('')} className="text-brand text-sm hover:underline">Clear search</button>
            </>
          ) : (
            <>
              <p className="text-text-muted mb-4">No playlists yet — create your first!</p>
              <button onClick={() => openModal('createPlaylist')} className="btn-primary">Create Playlist</button>
            </>
          )}
        </motion.div>
      ) : view === 'grid' ? (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
        >
          {filtered.map((pl, i) => (
            <motion.div key={pl._id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.03 }}>
              <PlaylistCard playlist={pl} onDelete={() => setPlaylists(p => p.filter(x => x._id !== pl._id))} />
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
          {filtered.map((pl, i) => (
            <motion.div
              key={pl._id}
              initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }} transition={{ delay: i*0.02 }}
              className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-surface-overlay transition-all cursor-pointer group"
              onClick={() => window.location.href = `/playlist/${pl._id}`}
            >
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-overlay shrink-0">
                {pl.coverUrl
                  ? <img src={pl.coverUrl} alt={pl.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-text-muted text-xl">🎵</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-primary truncate">{pl.name}</p>
                <p className="text-xs text-text-muted">{pl.songs?.length || 0} songs{pl.isAIGenerated ? ' · AI Generated' : ''}</p>
              </div>
              {pl.isAIGenerated && <Sparkles size={14} className="text-brand shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
