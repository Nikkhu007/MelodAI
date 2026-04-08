import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Search as SearchIcon, X, Loader2, Music, Play, Pause,
  Youtube, TrendingUp, AlertTriangle, ExternalLink,
} from 'lucide-react'
import usePlayerStore from '../store/playerStore'
import { youtubeAPI, songsAPI } from '../services/api'
import { SkeletonRow } from '../components/ui/Skeleton'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(s) {
  if (!s) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(Math.floor(s % 60)).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

function formatViews(n) {
  if (!n) return ''
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B views`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M views`
  if (n >= 1e3) return `${(Math.floor(n / 1e3))}K views`
  return `${n} views`
}

// Attach the backend stream URL to a YouTube song object
function withStreamUrl(song) {
  if (!song.ytId) return song
  return {
    ...song,
    // This hits our Express backend which pipes the audio — HTML5 <audio> can play it
    audioUrl: youtubeAPI.streamUrl(song.ytId),
  }
}

const QUICK_SEARCHES = [
  { label: '🔥 Trending India',   q: 'trending bollywood songs 2024' },
  { label: '💜 Arijit Singh',     q: 'arijit singh hits' },
  { label: '🎤 AP Dhillon',       q: 'ap dhillon songs' },
  { label: '⚡ Punjabi Hits',     q: 'new punjabi songs 2024' },
  { label: '🎵 Lofi Study',       q: 'lofi hip hop study beats' },
  { label: '💪 Gym Hits',         q: 'best gym workout music' },
  { label: '🌟 English Top Hits', q: 'top english songs 2024' },
  { label: '😌 Chill Vibes',      q: 'chill relaxing music' },
  { label: '🎸 Rock Classics',    q: 'best rock songs ever' },
  { label: '🌙 Late Night',       q: 'late night hindi sad songs' },
]

// ─── Song Row ─────────────────────────────────────────────────────────────────

function YTSongRow({ song, index, queue }) {
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayerStore()
  const isActive = currentSong?._id === song._id
  const [imgErr, setImgErr] = useState(false)

  const handlePlay = () => {
    if (isActive) {
      togglePlay()
    } else {
      // Attach stream URLs to entire queue so Next/Prev also work
      const playableQueue = queue.map(withStreamUrl)
      const playableSong = withStreamUrl(song)
      playSong(playableSong, playableQueue)
    }
  }

  return (
    <div
      onClick={handlePlay}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group cursor-pointer
        ${isActive ? 'bg-red-500/10 border border-red-500/20' : 'hover:bg-surface-overlay'}`}
    >
      {/* Index / play indicator */}
      <div className="w-7 flex items-center justify-center shrink-0">
        {isActive && isPlaying ? (
          <span className="playing-bars flex gap-0.5 items-end h-4"><span /><span /><span /></span>
        ) : (
          <>
            <span className="text-text-muted text-sm group-hover:hidden">{index + 1}</span>
            <button className="hidden group-hover:flex text-text-primary">
              {isActive ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
            </button>
          </>
        )}
      </div>

      {/* YouTube thumbnail */}
      <div className="w-14 h-10 rounded-lg overflow-hidden bg-surface-overlay shrink-0 relative">
        {!imgErr && song.coverUrl ? (
          <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" loading="lazy" onError={() => setImgErr(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-red-500/10">
            <Youtube size={16} className="text-red-400" />
          </div>
        )}
        {song.duration > 0 && (
          <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[9px] px-1 rounded leading-tight">
            {formatDuration(song.duration)}
          </span>
        )}
      </div>

      {/* Title + artist + views */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate leading-tight ${isActive ? 'text-red-400' : 'text-text-primary'}`}>
          {song.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-text-muted truncate">{song.artist}</p>
          {song.views > 0 && (
            <span className="text-[10px] text-text-muted hidden md:inline shrink-0">{formatViews(song.views)}</span>
          )}
        </div>
      </div>

      {/* YouTube badge */}
      <span className="hidden md:flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
        <Youtube size={10} /> Full
      </span>

      {/* Open in YouTube */}
      {song.ytUrl && (
        <a
          href={song.ytUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all p-1 shrink-0"
          title="Watch on YouTube"
        >
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  )
}

// ─── yt-dlp Missing Banner ────────────────────────────────────────────────────

function MissingBanner() {
  return (
    <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm">
      <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-red-300 font-semibold">yt-dlp not installed</p>
        <p className="text-text-muted text-xs">Install it then restart your backend:</p>
        <div className="bg-black/30 rounded-lg p-2 mt-1 space-y-1 font-mono text-xs text-text-secondary">
          <p><span className="text-text-muted">Windows:</span>  pip install yt-dlp</p>
          <p><span className="text-text-muted">Mac:</span>      brew install yt-dlp</p>
          <p><span className="text-text-muted">Linux:</span>    pip install yt-dlp</p>
        </div>
        <p className="text-text-muted text-xs pt-1">After installing, restart the backend and refresh this page.</p>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Search() {
  const [query, setQuery]                   = useState('')
  const [results, setResults]               = useState([])
  const [discoverSongs, setDiscoverSongs]   = useState([])
  const [activeLabel, setActiveLabel]       = useState('🔥 Trending India')
  const [loading, setLoading]               = useState(false)
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [ytStatus, setYtStatus]             = useState('checking') // checking | ok | missing
  const debounceRef = useRef(null)

  // 1. Check yt-dlp on mount
  useEffect(() => {
    youtubeAPI.check()
      .then(({ data }) => {
        if (data.installed) {
          setYtStatus('ok')
          loadQuickSearch(QUICK_SEARCHES[0])
        } else {
          setYtStatus('missing')
        }
      })
      .catch(() => setYtStatus('missing'))
  }, [])

  // 2. Load a quick-search tab
  const loadQuickSearch = async ({ label, q }) => {
    setActiveLabel(label)
    setDiscoverLoading(true)
    try {
      const { data } = await youtubeAPI.search(q, 20)
      setDiscoverSongs(data.songs || [])
    } catch {
      setDiscoverSongs([])
    } finally {
      setDiscoverLoading(false)
    }
  }

  // 3. Live search with debounce
  const handleSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const { data } = await youtubeAPI.search(q.trim(), 25)
      let ytSongs = data.songs || []

      // Also pull any matching local DB songs
      let local = []
      try {
        const { data: d } = await songsAPI.getAll({ search: q, limit: 5 })
        local = d.songs || []
      } catch {}

      const localIds = new Set(local.map(s => s._id))
      setResults([...local, ...ytSongs.filter(s => !localIds.has(s._id))])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => handleSearch(query), 500)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  const displaySongs = query ? results : discoverSongs

  return (
    <div className="pt-6 space-y-5 animate-fade-in">

      {/* yt-dlp missing warning */}
      {ytStatus === 'missing' && <MissingBanner />}

      {/* Search bar */}
      <div className="relative">
        <Youtube size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400 pointer-events-none" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={ytStatus === 'missing' ? 'Install yt-dlp to enable YouTube search…' : 'Search any song, artist, album on YouTube…'}
          className="input-field pl-11 pr-10 py-4 text-base"
          disabled={ytStatus === 'missing'}
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Quick-search chips */}
      {!query && ytStatus === 'ok' && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
          {QUICK_SEARCHES.map((item) => (
            <button
              key={item.q}
              onClick={() => loadQuickSearch(item)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0
                ${activeLabel === item.label
                  ? 'bg-red-500 text-white shadow-md'
                  : 'bg-surface-raised border border-surface-border text-text-muted hover:border-red-500/40 hover:text-text-primary'
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Status line */}
      {ytStatus === 'ok' && (
        <div className="flex items-center gap-2 min-h-5">
          {(loading || discoverLoading || ytStatus === 'checking') && (
            <Loader2 size={14} className="animate-spin text-red-400 shrink-0" />
          )}
          <span className="text-sm text-text-muted">
            {loading          ? `Searching YouTube for "${query}"…`
              : discoverLoading ? `Loading ${activeLabel}…`
              : query           ? `${results.length} results for "${query}"`
              : `${discoverSongs.length} songs — ${activeLabel}`
            }
          </span>
          {!loading && !discoverLoading && (
            <span className="ml-auto flex items-center gap-1 text-[11px] text-red-400 shrink-0">
              <Youtube size={11} /> YouTube · Full Songs
            </span>
          )}
        </div>
      )}

      {/* Song list */}
      {ytStatus === 'ok' && (
        <div className="space-y-0.5">
          {loading || discoverLoading
            ? Array(10).fill(0).map((_, i) => <SkeletonRow key={i} />)
            : displaySongs.length === 0 && query
              ? (
                <div className="text-center py-20">
                  <Youtube size={40} className="text-red-400/20 mx-auto mb-3" />
                  <p className="text-text-muted font-medium">No results for "{query}"</p>
                  <p className="text-text-muted text-sm mt-1">Try different keywords</p>
                </div>
              )
              : displaySongs.map((song, i) => (
                <YTSongRow key={song._id} song={song} index={i} queue={displaySongs} />
              ))
          }
        </div>
      )}

      {ytStatus === 'ok' && displaySongs.length > 0 && (
        <p className="text-[11px] text-text-muted text-center py-2 border-t border-surface-border/30">
          ⚠️ Personal local use only — audio streams via your local backend
        </p>
      )}
    </div>
  )
}
