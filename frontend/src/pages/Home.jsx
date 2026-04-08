import { useEffect, useState, useCallback } from 'react'
import { Sparkles, TrendingUp, Smile, Zap, RefreshCw } from 'lucide-react'
import { recommendAPI, songsAPI, playlistsAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import useUIStore from '../store/uiStore'
import usePlayerStore from '../store/playerStore'
import SongCard from '../components/songs/SongCard'
import SongRow from '../components/songs/SongRow'
import PlaylistCard from '../components/playlists/PlaylistCard'
import { SkeletonCard, SkeletonRow } from '../components/ui/Skeleton'

const MOOD_EMOJI = { happy:'😄', sad:'😢', energetic:'⚡', focus:'🎯', chill:'😌', gym:'💪', romance:'💜' }

function HorizontalScroll({ children }) {
  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
      {children}
    </div>
  )
}

export default function Home() {
  const { user } = useAuthStore()
  const { openModal, toast } = useUIStore()
  const { playSong } = usePlayerStore()

  const [feed, setFeed] = useState([])
  const [trending, setTrending] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [moodSongs, setMoodSongs] = useState([])
  const [loadingFeed, setLoadingFeed] = useState(true)
  const [loadingTrending, setLoadingTrending] = useState(true)
  const [generatingPlaylist, setGeneratingPlaylist] = useState(false)
  const [feedSource, setFeedSource] = useState('')

  const loadFeed = useCallback(async () => {
    setLoadingFeed(true)
    try {
      const { data } = await recommendAPI.getHome()
      setFeed(data.songs || [])
      setFeedSource(data.source)
    } catch {
      // fallback to trending
      const { data } = await songsAPI.getTrending()
      setFeed(data.songs || [])
    } finally {
      setLoadingFeed(false)
    }
  }, [])

  useEffect(() => {
    loadFeed()

    songsAPI.getTrending()
      .then(({ data }) => setTrending(data.songs || []))
      .finally(() => setLoadingTrending(false))

    playlistsAPI.getAll()
      .then(({ data }) => setPlaylists(data.playlists?.slice(0, 6) || []))

    if (user?.currentMood) {
      recommendAPI.getMood(user.currentMood)
        .then(({ data }) => setMoodSongs(data.songs?.slice(0, 8) || []))
    }
  }, [user?.currentMood])

  const handleGeneratePlaylist = async () => {
    setGeneratingPlaylist(true)
    try {
      const { data } = await playlistsAPI.generateAI({ mood: user?.currentMood })
      toast('AI playlist created! 🎵')
      setPlaylists((p) => [data.playlist, ...p])
    } catch {
      toast('Could not generate playlist', 'error')
    } finally {
      setGeneratingPlaylist(false)
    }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="pt-6 pb-4 space-y-10 animate-fade-in">
      {/* Hero greeting */}
      <section>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">
              {greeting()}, <span className="text-gradient">{user?.username}</span> 👋
            </h1>
            <p className="text-text-muted mt-1 text-sm">
              {user?.currentMood
                ? `AI is tuned to your ${user.currentMood} mood ${MOOD_EMOJI[user.currentMood]}`
                : 'Set your mood for a personalized experience'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => openModal('moodPicker')}
              className="btn-ghost flex items-center gap-2 text-sm border border-surface-border"
            >
              <Smile size={15} />
              {user?.currentMood ? `Mood: ${user.currentMood}` : 'Set mood'}
            </button>
            <button
              onClick={handleGeneratePlaylist}
              disabled={generatingPlaylist}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {generatingPlaylist
                ? <RefreshCw size={15} className="animate-spin" />
                : <Sparkles size={15} />
              }
              AI Playlist
            </button>
          </div>
        </div>
      </section>

      {/* AI-Personalized Feed */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md bg-brand/20 flex items-center justify-center">
            <Sparkles size={14} className="text-brand" />
          </div>
          <h2 className="section-title mb-0">
            {feedSource === 'ai-hybrid' ? 'Picked For You' : feedSource === 'content-only' ? 'Based on Your Taste' : 'Recommended'}
          </h2>
          <button onClick={loadFeed} className="ml-auto text-text-muted hover:text-brand transition-colors" title="Refresh">
            <RefreshCw size={15} className={loadingFeed ? 'animate-spin' : ''} />
          </button>
        </div>
        <HorizontalScroll>
          {loadingFeed
            ? Array(6).fill(0).map((_, i) => <div key={i} className="w-44 shrink-0"><SkeletonCard /></div>)
            : feed.slice(0, 12).map((song) => (
              <div key={song._id} className="w-44 shrink-0">
                <SongCard song={song} queue={feed} />
              </div>
            ))
          }
        </HorizontalScroll>
      </section>

      {/* Mood radio (if mood set) */}
      {user?.currentMood && moodSongs.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">{MOOD_EMOJI[user.currentMood]}</span>
            <h2 className="section-title mb-0 capitalize">{user.currentMood} Vibes</h2>
          </div>
          <div className="space-y-1">
            {moodSongs.map((song, i) => (
              <SongRow key={song._id} song={song} index={i} queue={moodSongs} showIndex />
            ))}
          </div>
        </section>
      )}

      {/* Featured Playlists */}
      {playlists.length > 0 && (
        <section>
          <h2 className="section-title">Featured Playlists</h2>
          <HorizontalScroll>
            {playlists.map((pl) => (
              <div key={pl._id} className="w-44 shrink-0">
                <PlaylistCard playlist={pl} />
              </div>
            ))}
          </HorizontalScroll>
        </section>
      )}

      {/* Trending */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-orange-400" />
          <h2 className="section-title mb-0">Trending Now</h2>
        </div>
        <div className="space-y-1">
          {loadingTrending
            ? Array(8).fill(0).map((_, i) => <SkeletonRow key={i} />)
            : trending.slice(0, 10).map((song, i) => (
              <SongRow key={song._id} song={song} index={i} queue={trending} showIndex />
            ))
          }
        </div>
      </section>
    </div>
  )
}
