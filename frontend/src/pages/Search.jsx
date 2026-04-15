import { useState, useRef, useEffect } from 'react'
import {
  Search as SearchIcon, X, Loader2, Music, Play, Pause,
  Youtube, ExternalLink, Radio, Heart, ListPlus, Plus
} from 'lucide-react'
import usePlayerStore from '../store/playerStore'
import useAuthStore from '../store/authStore'
import useUIStore from '../store/uiStore'
import { youtubeAPI, songsAPI } from '../services/api'
import { SkeletonRow } from '../components/ui/Skeleton'

// ── Jamendo ────────────────────────────────────────────────────────────────
const JAMENDO_ID   = import.meta.env.VITE_JAMENDO_CLIENT_ID || 'b6747d04'
const JAMENDO_BASE = 'https://api.jamendo.com/v3.0'

async function jamendoSearch(q, limit = 20) {
  try {
    const p1 = new URLSearchParams({ client_id: JAMENDO_ID, format: 'json', limit, namesearch: q, include: 'musicinfo', audioformat: 'mp32', imagesize: 500 })
    const j1 = await fetch(`${JAMENDO_BASE}/tracks/?${p1}`).then(r => r.json())
    if (j1.results?.length) return j1.results.map(toJamendoSong)
    const p2 = new URLSearchParams({ client_id: JAMENDO_ID, format: 'json', limit, search: q, include: 'musicinfo', audioformat: 'mp32', imagesize: 500 })
    const j2 = await fetch(`${JAMENDO_BASE}/tracks/?${p2}`).then(r => r.json())
    return (j2.results || []).map(toJamendoSong)
  } catch { return [] }
}

async function jamendoByTag(tags, limit = 25) {
  try {
    const p = new URLSearchParams({ client_id: JAMENDO_ID, format: 'json', limit, tags, include: 'musicinfo', audioformat: 'mp32', imagesize: 500, order: 'popularity_week' })
    const j = await fetch(`${JAMENDO_BASE}/tracks/?${p}`).then(r => r.json())
    return (j.results || []).map(toJamendoSong)
  } catch { return [] }
}

function toJamendoSong(t) {
  return {
    _id: `jamendo_${t.id}`, title: t.name, artist: t.artist_name,
    album: t.album_name || '', duration: t.duration || 0,
    audioUrl: t.audio, coverUrl: t.image || '',
    genre: (t.musicinfo?.tags?.genres?.[0] || 'other').toLowerCase(),
    mood: (t.musicinfo?.tags?.vartags?.[0] || 'chill').toLowerCase(),
    isJamendo: true, jamendoUrl: t.shareurl,
  }
}

// YouTube search — pass type='none' to avoid "official audio" being appended
// for discover chips (trending/artist chips work better without it)
async function ytSearch(q, limit = 20, raw = false) {
  try {
    const { data } = await youtubeAPI.search(q, limit, raw)
    return (data.songs || []).map(s => ({
      ...s,
      audioUrl: youtubeAPI.streamUrl(s.ytId),
    }))
  } catch { return [] }
}

// ── Chip definitions ──────────────────────────────────────────────────────
// useYT: true → YouTube  |  false → Jamendo tag
// raw: true → don't append "official audio" to query
const CHIPS = [
  { label: '🔥 Trending',     q: 'trending bollywood songs 2024', useYT: true,  raw: true  },
  { label: '💜 Arijit Singh', q: 'arijit singh',                  useYT: true,  raw: false },
  { label: '🎤 AP Dhillon',   q: 'ap dhillon',                    useYT: true,  raw: false },
  { label: '⚡ Punjabi',      q: 'new punjabi songs 2024',        useYT: true,  raw: true  },
  { label: '🌙 Bollywood',    q: 'bollywood hits 2024',           useYT: true,  raw: true  },
  { label: '🌿 Lofi',         q: 'lofi hip hop beats',            useYT: true,  raw: false },
  { label: '😌 Chill',        q: 'chill+relax',                   useYT: false, raw: false },
  { label: '💪 Gym',          q: 'workout+sport+powerful',        useYT: false, raw: false },
  { label: '🎯 Focus',        q: 'focus+concentration+study',     useYT: false, raw: false },
  { label: '🎸 Rock',         q: 'rock',                          useYT: false, raw: false },
]

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtDur(s) {
  if (!s) return '—'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}
function fmtViews(n) {
  if (!n) return ''
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`
  if (n >= 1e3) return `${Math.floor(n/1e3)}K`
  return `${n}`
}

// ── Song Row ──────────────────────────────────────────────────────────────
function SongRow({ song, index, queue }) {
  const { currentSong, isPlaying, playSong, togglePlay, addToQueue } = usePlayerStore()
  const { user } = useAuthStore()
  const { openModal, toast } = useUIStore()
  const [liked,  setLiked]  = useState(false)
  const [imgErr, setImgErr] = useState(false)
  const isActive = currentSong?._id === song._id

  const handlePlay = () => { isActive ? togglePlay() : playSong(song, queue) }

  const handleLike = async (e) => {
    e.stopPropagation()
    if (!user) { toast('Login to like songs', 'error'); return }
    try {
      await songsAPI.trackEvent(song._id, {
        event: liked ? 'unlike' : 'like', progress: 0, listenDuration: 0,
        songMeta: { genre: song.genre, mood: song.mood },
      })
      setLiked(!liked)
      toast(liked ? 'Removed' : '❤️ Liked')
    } catch { toast('Failed', 'error') }
  }

  return (
    <div
      onClick={handlePlay}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group cursor-pointer
        ${isActive ? (song.isYouTube ? 'bg-red-500/10' : 'bg-brand/10') : 'hover:bg-surface-overlay'}`}
    >
      {/* Index / play */}
      <div className="w-7 flex items-center justify-center shrink-0">
        {isActive && isPlaying
          ? <span className="playing-bars flex gap-0.5 items-end h-4"><span /><span /><span /></span>
          : <>
              <span className="text-text-muted text-sm group-hover:hidden">{index + 1}</span>
              <button className="hidden group-hover:flex text-text-primary">
                {isActive ? <Pause size={15} fill="currentColor"/> : <Play size={15} fill="currentColor"/>}
              </button>
            </>
        }
      </div>

      {/* Thumbnail */}
      <div className="w-12 h-9 rounded-lg overflow-hidden bg-surface-overlay shrink-0 relative">
        {!imgErr && song.coverUrl
          ? <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" loading="lazy" onError={() => setImgErr(true)} />
          : <div className="w-full h-full flex items-center justify-center">
              {song.isYouTube ? <Youtube size={14} className="text-red-400"/> : <Music size={14} className="text-text-muted"/>}
            </div>
        }
        {song.duration > 0 && (
          <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[8px] text-white px-1 rounded">{fmtDur(song.duration)}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isActive ? (song.isYouTube ? 'text-red-400' : 'text-brand') : 'text-text-primary'}`}>
          {song.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-text-muted truncate">{song.artist}</p>
          {song.views > 0 && <span className="text-[10px] text-text-muted hidden md:inline shrink-0">{fmtViews(song.views)} views</span>}
        </div>
      </div>

      {/* Source badge */}
      {song.isYouTube
        ? <span className="hidden md:flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/15 shrink-0"><Youtube size={9}/> YT</span>
        : song.isJamendo
          ? <span className="hidden md:flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/15 shrink-0"><Radio size={9}/> Free</span>
          : null
      }

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
        <button onClick={handleLike} className={`p-1.5 rounded-lg transition-colors ${liked ? 'text-brand' : 'text-text-muted hover:text-brand'}`}>
          <Heart size={13} fill={liked ? 'currentColor' : 'none'}/>
        </button>
        <button onClick={() => { addToQueue(song); toast('Added to queue') }} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary">
          <ListPlus size={13}/>
        </button>
        <button onClick={() => openModal('addToPlaylist', { selectedSongForPlaylist: song })} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary">
          <Plus size={13}/>
        </button>
        {(song.ytUrl || song.jamendoUrl) && (
          <a href={song.ytUrl || song.jamendoUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-text-muted hover:text-text-primary">
            <ExternalLink size={13}/>
          </a>
        )}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Search() {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [discover, setDiscover] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const debounceRef = useRef(null)
  const mountedRef  = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    // Load first chip on mount
    loadChip(0)
    return () => { mountedRef.current = false }
  }, [])

  const loadChip = async (idx) => {
    const chip = CHIPS[idx]
    setActiveIdx(idx)
    setDiscoverLoading(true)
    setDiscover([]) // clear immediately so skeleton shows

    try {
      let songs = []
      if (chip.useYT) {
        // Always show Jamendo immediately while YouTube loads (it's faster)
        // Run both in parallel
        const [ytRes, jRes] = await Promise.allSettled([
          ytSearch(chip.q, 20, chip.raw),
          jamendoSearch(chip.q, 10),
        ])
        const yt = ytRes.status === 'fulfilled' ? ytRes.value : []
        const jm = jRes.status  === 'fulfilled' ? jRes.value  : []

        // YouTube results first, then fill with Jamendo if YT is empty
        const seen = new Set()
        for (const s of yt) { seen.add(s._id); songs.push(s) }
        // Only add Jamendo if YouTube returned nothing
        if (!yt.length) {
          for (const s of jm) { if (!seen.has(s._id)) { seen.add(s._id); songs.push(s) } }
        }
      } else {
        songs = await jamendoByTag(chip.q, 25)
      }
      if (mountedRef.current) setDiscover(songs)
    } catch {
      if (mountedRef.current) setDiscover([])
    } finally {
      if (mountedRef.current) setDiscoverLoading(false)
    }
  }

  // Live search
  const doSearch = async (q) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const [ytRes, jRes, dbRes] = await Promise.allSettled([
        ytSearch(q.trim(), 20, false),
        jamendoSearch(q.trim(), 15),
        songsAPI.getAll({ search: q.trim(), limit: 5 }).then(r => r.data.songs || []),
      ])
      const yt = ytRes.status === 'fulfilled' ? ytRes.value : []
      const jm = jRes.status  === 'fulfilled' ? jRes.value  : []
      const db = dbRes.status === 'fulfilled' ? dbRes.value : []

      const seen = new Set()
      const merged = []
      for (const s of [...db, ...yt, ...jm]) {
        if (!seen.has(s._id)) { seen.add(s._id); merged.push(s) }
      }
      if (mountedRef.current) setResults(merged)
    } catch {
      if (mountedRef.current) setResults([])
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(() => doSearch(query), 500)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const displaySongs = query ? results : discover
  const activeChip   = CHIPS[activeIdx]

  return (
    <div className="pt-6 space-y-5 animate-fade-in">

      {/* Search bar */}
      <div className="relative">
        <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"/>
        <input
          autoFocus value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search any song, artist, album…"
          className="input-field pl-11 pr-10 py-4 text-base"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
            <X size={16}/>
          </button>
        )}
      </div>

      {/* Chips */}
      {!query && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          {CHIPS.map((chip, i) => (
            <button
              key={chip.label}
              onClick={() => loadChip(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0
                ${activeIdx === i
                  ? chip.useYT ? 'bg-red-500 text-white shadow-md' : 'bg-brand text-white shadow-md'
                  : 'bg-surface-raised border border-surface-border text-text-muted hover:text-text-primary hover:border-brand/40'
                }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-2 min-h-5">
        {(loading || discoverLoading) && <Loader2 size={14} className="animate-spin text-brand shrink-0"/>}
        <span className="text-sm text-text-muted">
          {loading
            ? `Searching YouTube & Jamendo for "${query}"…`
            : discoverLoading
              ? `Loading ${activeChip?.label}… (YouTube may take a few seconds)`
              : query
                ? `${results.length} results for "${query}"`
                : `${discover.length} songs — ${activeChip?.label || ''}`
          }
        </span>
        {!loading && !discoverLoading && (
          <span className="ml-auto flex items-center gap-2 text-[10px] shrink-0">
            <span className="flex items-center gap-1 text-red-400"><Youtube size={10}/> YouTube</span>
            <span className="flex items-center gap-1 text-green-400"><Radio size={10}/> Jamendo</span>
          </span>
        )}
      </div>

      {/* Song list */}
      <div className="space-y-0.5">
        {loading || discoverLoading
          ? Array(10).fill(0).map((_, i) => <SkeletonRow key={i}/>)
          : displaySongs.length === 0 && !discoverLoading
            ? (
              <div className="text-center py-20">
                <Music size={40} className="text-text-muted mx-auto mb-3 opacity-30"/>
                {query
                  ? <><p className="text-text-muted font-medium">No results for "{query}"</p>
                      <p className="text-text-muted text-sm mt-1">Try a different spelling</p></>
                  : <><p className="text-text-muted font-medium">No songs loaded yet</p>
                      <p className="text-text-muted text-sm mt-1">Make sure yt-dlp is installed and the backend is running</p>
                      <button onClick={() => loadChip(activeIdx)} className="btn-primary mt-4 text-sm">Retry</button></>
                }
              </div>
            )
            : displaySongs.map((song, i) => (
              <SongRow key={song._id + i} song={song} index={i} queue={displaySongs}/>
            ))
        }
      </div>

      {!query && discover.some(s => s.jamendoUrl) && (
        <p className="text-[11px] text-text-muted text-center py-2 border-t border-surface-border/30">
          Jamendo tracks are free & legally licensed ·{' '}
          <a href="https://www.jamendo.com" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">jamendo.com</a>
        </p>
      )}
    </div>
  )
}
