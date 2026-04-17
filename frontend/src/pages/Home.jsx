import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, TrendingUp, Smile, RefreshCw, Clock, ChevronRight } from 'lucide-react'
import { recommendAPI, songsAPI, playlistsAPI, usersAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import useUIStore from '../store/uiStore'
import usePlayerStore from '../store/playerStore'
import SongCard from '../components/songs/SongCard'
import SongRow from '../components/songs/SongRow'
import PlaylistCard from '../components/playlists/PlaylistCard'
import { SkeletonCard, SkeletonRow } from '../components/ui/Skeleton'
import QuickPicks from '../components/ui/QuickPicks'

const MOOD_EMOJI = { happy:'😄', sad:'😢', energetic:'⚡', focus:'🎯', chill:'😌', gym:'💪', romance:'💜' }

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } }
const fadeUp  = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } } }

function HScroll({ children }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show"
      className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
      {children}
    </motion.div>
  )
}

function SectionHeader({ title, icon, onRefresh, refreshing, onSeeAll }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button onClick={onRefresh} className="text-text-muted hover:text-brand transition-colors p-1" title="Refresh">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
        {onSeeAll && (
          <button onClick={onSeeAll} className="text-xs text-text-muted hover:text-brand flex items-center gap-0.5 transition-colors">
            See all <ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const { user }          = useAuthStore()
  const { openModal, toast } = useUIStore()
  const { playSong }      = usePlayerStore()

  const [feed, setFeed]               = useState([])
  const [trending, setTrending]       = useState([])
  const [playlists, setPlaylists]     = useState([])
  const [moodSongs, setMoodSongs]     = useState([])
  const [recentSongs, setRecentSongs] = useState([])

  const [loadingFeed,  setLoadingFeed]  = useState(true)
  const [loadingTrend, setLoadingTrend] = useState(true)
  const [feedSource,   setFeedSource]   = useState('')
  const [generatingPl, setGeneratingPl] = useState(false)
  const [refreshingFeed, setRefreshingFeed] = useState(false)

  // Track if we've loaded once to avoid re-fetch on re-renders
  const loaded = useRef(false)

  const loadFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshingFeed(true)
    else setLoadingFeed(true)
    try {
      const { data } = await recommendAPI.getHome()
      setFeed(data.songs || [])
      setFeedSource(data.source || '')
    } catch {
      try {
        const { data } = await songsAPI.getTrending()
        setFeed(data.songs || [])
        setFeedSource('trending')
      } catch {}
    } finally {
      setLoadingFeed(false)
      setRefreshingFeed(false)
    }
  }, [])

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    loadFeed()

    // Trending
    songsAPI.getTrending()
      .then(({ data }) => setTrending(data.songs || []))
      .finally(() => setLoadingTrend(false))

    // Featured playlists
    playlistsAPI.getAll()
      .then(({ data }) => setPlaylists(data.playlists?.slice(0, 8) || []))
      .catch(() => {})

    // Continue listening — unique songs from recent history
    usersAPI.getHistory()
      .then(({ data }) => {
        const seen = new Set()
        const unique = (data.events || [])
          .filter(e => e.song && e.event === 'play')
          .filter(e => { if (seen.has(e.song._id)) return false; seen.add(e.song._id); return true })
          .map(e => e.song)
          .slice(0, 10)
        setRecentSongs(unique)
      })
      .catch(() => {})
  }, [])

  // Load mood songs when mood changes
  useEffect(() => {
    if (!user?.currentMood) { setMoodSongs([]); return }
    recommendAPI.getMood(user.currentMood)
      .then(({ data }) => setMoodSongs(data.songs?.slice(0, 8) || []))
      .catch(() => {})
  }, [user?.currentMood])

  const handleGeneratePlaylist = async () => {
    setGeneratingPl(true)
    try {
      const { data } = await playlistsAPI.generateAI({ mood: user?.currentMood })
      toast('AI playlist created! 🎵')
      setPlaylists(p => [data.playlist, ...p.slice(0, 7)])
    } catch (err) {
      toast(err.response?.data?.message || 'Could not generate playlist', 'error')
    } finally {
      setGeneratingPl(false)
    }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="pt-6 pb-4 space-y-8 animate-fade-in">

      {/* Hero */}
      <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {greeting()}, <span className="text-gradient">{user?.username}</span> 👋
            </h1>
            <p className="text-text-muted mt-1 text-sm">
              {user?.currentMood
                ? `AI tuned to your ${user.currentMood} mood ${MOOD_EMOJI[user.currentMood]}`
                : 'Set your mood for a personalized experience'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => openModal('moodPicker')}
              className="btn-ghost flex items-center gap-2 text-sm border border-surface-border py-2">
              <Smile size={14} />
              {user?.currentMood ? `${MOOD_EMOJI[user.currentMood]} ${user.currentMood}` : 'Set mood'}
            </button>
            <button onClick={handleGeneratePlaylist} disabled={generatingPl}
              className="btn-primary flex items-center gap-2 text-sm py-2">
              {generatingPl ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              AI Playlist
            </button>
          </div>
        </div>
      </motion.section>

      {/* Quick Picks */}
      <QuickPicks />

      {/* Continue Listening */}
      {recentSongs.length > 0 && (
        <section>
          <SectionHeader title="Continue Listening" icon={<Clock size={15} className="text-text-muted" />} />
          <HScroll>
            {recentSongs.map(song => (
              <motion.div key={song._id} variants={fadeUp} className="w-40 shrink-0">
                <SongCard song={song} queue={recentSongs} />
              </motion.div>
            ))}
          </HScroll>
        </section>
      )}

      {/* AI Picks */}
      <section>
        <SectionHeader
          title={feedSource === 'ai-hybrid' ? 'Picked For You' : feedSource === 'db-personalised' ? 'Based on Your Taste' : 'Recommended'}
          icon={<Sparkles size={15} className="text-brand" />}
          onRefresh={() => loadFeed(true)}
          refreshing={refreshingFeed}
        />
        {loadingFeed ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array(6).fill(0).map((_,i) => <div key={i} className="w-40 shrink-0"><SkeletonCard /></div>)}
          </div>
        ) : feed.length === 0 ? (
          <p className="text-text-muted text-sm py-4">No recommendations yet — play some songs first!</p>
        ) : (
          <HScroll>
            {feed.slice(0, 12).map(song => (
              <motion.div key={song._id} variants={fadeUp} className="w-40 shrink-0">
                <SongCard song={song} queue={feed} />
              </motion.div>
            ))}
          </HScroll>
        )}
      </section>

      {/* Mood Vibes */}
      {user?.currentMood && moodSongs.length > 0 && (
        <section>
          <SectionHeader
            title={`${MOOD_EMOJI[user.currentMood]} ${user.currentMood.charAt(0).toUpperCase() + user.currentMood.slice(1)} Vibes`}
            icon={null}
          />
          <div className="space-y-0.5">
            {moodSongs.map((song, i) => (
              <SongRow key={song._id} song={song} index={i} queue={moodSongs} showIndex />
            ))}
          </div>
        </section>
      )}

      {/* Featured Playlists */}
      {playlists.length > 0 && (
        <section>
          <SectionHeader title="Featured Playlists" icon={<TrendingUp size={15} className="text-text-muted" />} />
          <HScroll>
            {playlists.map(pl => (
              <motion.div key={pl._id} variants={fadeUp} className="w-40 shrink-0">
                <PlaylistCard playlist={pl} />
              </motion.div>
            ))}
          </HScroll>
        </section>
      )}

      {/* Trending */}
      <section>
        <SectionHeader title="Trending Now" icon={<TrendingUp size={15} className="text-orange-400" />} />
        {loadingTrend
          ? <div className="space-y-1">{Array(8).fill(0).map((_,i) => <SkeletonRow key={i} />)}</div>
          : <div className="space-y-0.5">
              {trending.slice(0, 10).map((song, i) => (
                <SongRow key={song._id} song={song} index={i} queue={trending} showIndex />
              ))}
            </div>
        }
      </section>
    </div>
  )
}
