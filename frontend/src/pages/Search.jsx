import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search as SearchIcon, X, Loader2, Music, Play, Pause,
  Youtube, ExternalLink, Radio, Heart, ListPlus, Plus, AlertTriangle
} from 'lucide-react'
import usePlayerStore from '../store/playerStore'
import useAuthStore from '../store/authStore'
import useUIStore from '../store/uiStore'
import { youtubeAPI, songsAPI } from '../services/api'
import { SkeletonRow } from '../components/ui/Skeleton'

// ── Jamendo (free full songs, works on Vercel) ────────────────────────────
const JAMENDO_ID  = import.meta.env.VITE_JAMENDO_CLIENT_ID || 'b6747d04'
const JAMENDO_URL = 'https://api.jamendo.com/v3.0'

async function jamendoSearch(q, limit = 20) {
  const p = new URLSearchParams({
    client_id: JAMENDO_ID, format: 'json', limit,
    namesearch: q, include: 'musicinfo', audioformat: 'mp32', imagesize: 500,
  })
  const r = await fetch(`${JAMENDO_URL}/tracks/?${p}`)
  const j = await r.json()
  if (j.results?.length) return j.results.map(toJamendoSong)

  // Fallback: broader search
  const p2 = new URLSearchParams({
    client_id: JAMENDO_ID, format: 'json', limit,
    search: q, include: 'musicinfo', audioformat: 'mp32', imagesize: 500,
  })
  const r2 = await fetch(`${JAMENDO_URL}/tracks/?${p2}`)
  const j2 = await r2.json()
  return (j2.results || []).map(toJamendoSong)
}

async function jamendoByTag(tags, limit = 25) {
  const p = new URLSearchParams({
    client_id: JAMENDO_ID, format: 'json', limit,
    tags, include: 'musicinfo', audioformat: 'mp32', imagesize: 500, order: 'popularity_week',
  })
  const r = await fetch(`${JAMENDO_URL}/tracks/?${p}`)
  const j = await r.json()
  return (j.results || []).map(toJamendoSong)
}

function toJamendoSong(t) {
  return {
    _id: `jamendo_${t.id}`, title: t.name, artist: t.artist_name,
    album: t.album_name || 'Single', duration: t.duration || 0,
    audioUrl: t.audio, coverUrl: t.image || '',
    genre: (t.musicinfo?.tags?.genres?.[0] || 'other').toLowerCase(),
    mood: (t.musicinfo?.tags?.vartags?.[0] || 'chill').toLowerCase(),
    isFullSong: true, jamendoUrl: t.shareurl, isJamendo: true,
  }
}

const QUICK_SEARCHES = [
  { label: '🔥 Trending',    ytq: 'trending songs 2024',      jTag: null,              isYt: true },
  { label: '💜 Arijit Singh', ytq: 'arijit singh official audio', jTag: null,           isYt: true },
  { label: '🎤 AP Dhillon',  ytq: 'ap dhillon songs',         jTag: null,              isYt: true },
  { label: '⚡ Punjabi',     ytq: 'new punjabi songs 2024',   jTag: null,              isYt: true },
  { label: '😌 Chill',       ytq: null,                        jTag: 'chill+relax',     isYt: false },
  { label: '💪 Gym',         ytq: null,                        jTag: 'workout+sport',   isYt: false },
  { label: '🎯 Focus',       ytq: null,                        jTag: 'focus+study',     isYt: false },
  { label: '🎸 Rock',        ytq: null,                        jTag: 'rock',            isYt: false },
  { label: '🎵 Jazz',        ytq: null,                        jTag: 'jazz',            isYt: false },
  { label: '🌿 Lofi',        ytq: 'lofi hip hop beats',        jTag: null,              isYt: true  },
]

function fmtDur(s) {
  if (!s) return '—'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(Math.floor(s % 60)).padStart(2,'0')
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${sec}` : `${m}:${sec}`
}
function fmtViews(n) {
  if (!n) return ''
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`
  if (n >= 1e3) return `${Math.floor(n/1e3)}K`
  return `${n}`
}

function withStream(song) {
  if (!song.ytId) return song
  return { ...song, audioUrl: youtubeAPI.streamUrl(song.ytId) }
}

// ── Song Row with like + add-to-playlist + add-to-queue ──────────────────
function SearchSongRow({ song, index, queue }) {
  const { currentSong, isPlaying, playSong, togglePlay, addToQueue } = usePlayerStore()
  const { user } = useAuthStore()
  const { openModal, toast } = useUIStore()
  const [liked, setLiked] = useState(false)
  const [imgErr, setImgErr] = useState(false)
  const isActive = currentSong?._id === song._id

  const handlePlay = () => {
    const playable = song.ytId ? withStream(song) : song
    const playableQueue = queue.map(s => s.ytId ? withStream(s) : s)
    if (isActive) togglePlay()
    else playSong(playable, playableQueue)
  }

  const handleLike = async (e) => {
    e.stopPropagation()
    if (!user) { toast('Login to like songs', 'error'); return }
    const event = liked ? 'unlike' : 'like'
    try {
      await songsAPI.trackEvent(song._id, {
        event, progress: 0, listenDuration: 0,
        songMeta: { genre: song.genre, mood: song.mood, tempo: song.tempo || 120 },
      })
      setLiked(!liked)
      toast(liked ? 'Removed from liked' : '❤️ Added to liked songs')
    } catch { toast('Failed', 'error') }
  }

  const handleAddQueue = (e) => {
    e.stopPropagation()
    addToQueue(song.ytId ? withStream(song) : song)
    toast(`"${song.title}" added to queue`)
  }

  const handleAddPlaylist = (e) => {
    e.stopPropagation()
    openModal('addToPlaylist', { selectedSongForPlaylist: song.ytId ? withStream(song) : song })
  }

  return (
    <div
      onClick={handlePlay}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group cursor-pointer
        ${isActive
          ? song.isYouTube ? 'bg-red-500/10 border border-red-500/15' : 'bg-brand/10 border border-brand/15'
          : 'hover:bg-surface-overlay'}`}
    >
      {/* Index / play */}
      <div className="w-7 flex items-center justify-center shrink-0">
        {isActive && isPlaying
          ? <span className="playing-bars flex gap-0.5 items-end h-4"><span /><span /><span /></span>
          : <>
              <span className="text-text-muted text-sm group-hover:hidden">{index + 1}</span>
              <button className="hidden group-hover:flex">
                {isActive ? <Pause size={15} fill="currentColor" className="text-text-primary" /> : <Play size={15} fill="currentColor" className="text-text-primary" />}
              </button>
            </>
        }
      </div>

      {/* Thumbnail */}
      <div className="w-12 h-9 rounded-lg overflow-hidden bg-surface-overlay shrink-0 relative">
        {!imgErr && song.coverUrl
          ? <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" loading="lazy" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center bg-surface-raised">
              {song.isYouTube ? <Youtube size={14} className="text-red-400" /> : <Music size={14} className="text-text-muted" />}
            </div>
        }
        {song.duration > 0 && (
          <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[8px] px-1 rounded leading-tight">{fmtDur(song.duration)}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate leading-tight ${isActive ? (song.isYouTube ? 'text-red-400' : 'text-brand') : 'text-text-primary'}`}>
          {song.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-text-muted truncate">{song.artist}</p>
          {song.views > 0 && <span className="text-[10px] text-text-muted hidden md:inline shrink-0">{fmtViews(song.views)} views</span>}
        </div>
      </div>

      {/* Source badge */}
      {song.isYouTube
        ? <span className="hidden md:flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/15 shrink-0"><Youtube size={9} /> YT</span>
        : song.isJamendo
          ? <span className="hidden md:flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/15 shrink-0"><Radio size={9} /> Free</span>
          : null
      }

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={handleLike} className={`p-1.5 rounded-lg transition-colors ${liked ? 'text-brand' : 'text-text-muted hover:text-brand'}`} title="Like">
          <Heart size={13} fill={liked ? 'currentColor' : 'none'} />
        </button>
        <button onClick={handleAddQueue} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary transition-colors" title="Add to queue">
          <ListPlus size={13} />
        </button>
        <button onClick={handleAddPlaylist} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary transition-colors" title="Add to playlist">
          <Plus size={13} />
        </button>
        {(song.ytUrl || song.jamendoUrl) && (
          <a href={song.ytUrl || song.jamendoUrl} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary" title="Open original">
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function Search() {
  const [query, setQuery]               = useState('')
  const [results, setResults]           = useState([])
  const [discover, setDiscover]         = useState([])
  const [activeLabel, setActiveLabel]   = useState('')
  const [loading, setLoading]           = useState(false)
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [ytAvailable, setYtAvailable]   = useState(null) // null=checking, true, false
  const debounceRef = useRef(null)

  // Check YouTube availability + load default discover
  useEffect(() => {
    youtubeAPI.check()
      .then(({ data }) => {
        setYtAvailable(data.installed === true)
        // Load first quick search
        const first = QUICK_SEARCHES[0]
        if (data.installed) loadQuickSearch(first)
        else loadQuickSearch(QUICK_SEARCHES[4]) // fallback to Chill (Jamendo)
      })
      .catch(() => {
        setYtAvailable(false)
        loadQuickSearch(QUICK_SEARCHES[4])
      })
  }, [])

  const loadQuickSearch = async (item) => {
    setActiveLabel(item.label)
    setDiscoverLoading(true)
    try {
      if (item.isYt && ytAvailable !== false && item.ytq) {
        const { data } = await youtubeAPI.search(item.ytq, 20)
        setDiscover(data.songs || [])
      } else if (item.jTag) {
        const songs = await jamendoByTag(item.jTag, 25)
        setDiscover(songs)
      } else if (item.ytq) {
        // Fallback YT query → try Jamendo search instead
        const songs = await jamendoSearch(item.ytq, 20)
        setDiscover(songs)
      }
    } catch { setDiscover([]) }
    finally { setDiscoverLoading(false) }
  }

  const handleSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      let songs = []

      // Try YouTube first if available
      if (ytAvailable) {
        try {
          const { data } = await youtubeAPI.search(q.trim(), 20)
          songs = data.songs || []
        } catch {}
      }

      // Always add Jamendo results
      try {
        const jamendo = await jamendoSearch(q.trim(), 15)
        const existingIds = new Set(songs.map(s => s._id))
        songs = [...songs, ...jamendo.filter(s => !existingIds.has(s._id))]
      } catch {}

      // Also search local DB songs
      try {
        const { data } = await songsAPI.getAll({ search: q, limit: 5 })
        const dbSongs = data.songs || []
        const existingIds = new Set(songs.map(s => s._id))
        songs = [...dbSongs.filter(s => !existingIds.has(s._id)), ...songs]
      } catch {}

      setResults(songs)
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [ytAvailable])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleSearch(query), 450)
    return () => clearTimeout(debounceRef.current)
  }, [query, ytAvailable])

  const displaySongs = query ? results : discover

  return (
    <div className="pt-6 space-y-5 animate-fade-in">
      {/* Search bar */}
      <div className="relative">
        <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          autoFocus value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search any song, artist, album…"
          className="input-field pl-11 pr-10 py-4 text-base"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Quick search chips */}
      {!query && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          {QUICK_SEARCHES.filter(item => !item.isYt || ytAvailable).map(item => (
            <button key={item.label} onClick={() => loadQuickSearch(item)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0
                ${activeLabel === item.label
                  ? (item.isYt ? 'bg-red-500 text-white' : 'bg-brand text-white')
                  : 'bg-surface-raised border border-surface-border text-text-muted hover:text-text-primary hover:border-brand/40'
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-2 min-h-5">
        {(loading || discoverLoading) && <Loader2 size={14} className="animate-spin text-brand shrink-0" />}
        <span className="text-sm text-text-muted">
          {loading ? `Searching for "${query}"…`
            : discoverLoading ? `Loading ${activeLabel}…`
            : query ? `${results.length} results for "${query}"`
            : `${discover.length} songs — ${activeLabel}`}
        </span>
        {!loading && !discoverLoading && (
          <span className="ml-auto flex items-center gap-2 text-[11px] text-text-muted shrink-0">
            {ytAvailable && <span className="flex items-center gap-1 text-red-400"><Youtube size={10} /> YT</span>}
            <span className="flex items-center gap-1 text-green-400"><Radio size={10} /> Jamendo</span>
          </span>
        )}
      </div>

      {/* Results */}
      <div className="space-y-0.5">
        {loading || discoverLoading
          ? Array(10).fill(0).map((_, i) => <SkeletonRow key={i} />)
          : displaySongs.length === 0 && query
            ? (
              <div className="text-center py-20">
                <Music size={40} className="text-text-muted mx-auto mb-3 opacity-30" />
                <p className="text-text-muted font-medium">No results for "{query}"</p>
                <p className="text-text-muted text-sm mt-1">Try a different spelling or artist name</p>
              </div>
            )
            : displaySongs.map((song, i) => (
              <SearchSongRow key={song._id + i} song={song} index={i} queue={displaySongs} />
            ))
        }
      </div>

      {!query && discover.some(s => s.jamendoUrl) && (
        <p className="text-[11px] text-text-muted text-center py-2 border-t border-surface-border/30">
          Jamendo tracks are free & legally licensed · <a href="https://www.jamendo.com" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">jamendo.com</a>
        </p>
      )}
    </div>
  )
}
