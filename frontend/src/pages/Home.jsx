import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, TrendingUp, Smile, RefreshCw, Clock, Play, ChevronRight } from 'lucide-react'
import { recommendAPI, songsAPI, playlistsAPI, usersAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import useUIStore from '../store/uiStore'
import usePlayerStore from '../store/playerStore'
import SongCard from '../components/songs/SongCard'
import SongRow from '../components/songs/SongRow'
import PlaylistCard from '../components/playlists/PlaylistCard'
import { SkeletonCard, SkeletonRow } from '../components/ui/Skeleton'

const MOOD_EMOJI = { happy:'😄', sad:'😢', energetic:'⚡', focus:'🎯', chill:'😌', gym:'💪', romance:'💜' }

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } } }

function Section({ title, icon, children, onSeeAll, loading, skeletonType = 'card', skeletonCount = 6 }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        </div>
        {onSeeAll && (
          <button onClick={onSeeAll} className="text-xs text-text-muted hover:text-brand flex items-center gap-0.5 transition-colors">
            See all <ChevronRight size={14} />
          </button>
        )}
      </div>
      {loading ? (
        skeletonType === 'card'
          ? <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">{Array(skeletonCount).fill(0).map((_,i)=><div key={i} className="w-44 shrink-0"><SkeletonCard /></div>)}</div>
          : <div className="space-y-1">{Array(skeletonCount).fill(0).map((_,i)=><SkeletonRow key={i}/>)}</div>
      ) : children}
    </section>
  )
}

function HScroll({ children }) {
  return (
    <motion.div
      variants={container} initial="hidden" animate="show"
      className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1"
    >
      {children}
    </motion.div>
  )
}

export default function Home() {
  const { user } = useAuthStore()
  const { openModal, toast } = useUIStore()
  const { playSong } = usePlayerStore()

  const [feed, setFeed]               = useState([])
  const [trending, setTrending]       = useState([])
  const [playlists, setPlaylists]     = useState([])
  const [moodSongs, setMoodSongs]     = useState([])
  const [recentSongs, setRecentSongs] = useState([])
  const [loadingFeed, setLoadingFeed]     = useState(true)
  const [loadingTrend, setLoadingTrend]   = useState(true)
  const [feedSource, setFeedSource]       = useState('')
  const [generatingPl, setGeneratingPl]   = useState(false)

  const loadFeed = useCallback(async () => {
    setLoadingFeed(true)
    try {
      const { data } = await recommendAPI.getHome()
      setFeed(data.songs || [])
      setFeedSource(data.source)
    } catch {
      try { const { data } = await songsAPI.getTrending(); setFeed(data.songs || []) } catch {}
    } finally { setLoadingFeed(false) }
  }, [])

  useEffect(() => {
    loadFeed()

    songsAPI.getTrending()
      .then(({ data }) => setTrending(data.songs || []))
      .finally(() => setLoadingTrend(false))

    playlistsAPI.getAll()
      .then(({ data }) => setPlaylists(data.playlists?.slice(0, 6) || []))

    usersAPI.getHistory()
      .then(({ data }) => {
        const seen = new Set()
        const unique = (data.events || [])
          .filter(e => e.song && e.event === 'play')
          .filter(e => { if (seen.has(e.song._id)) return false; seen.add(e.song._id); return true })
          .map(e => e.song)
          .slice(0, 8)
        setRecentSongs(unique)
      })
      .catch(() => {})

    if (user?.currentMood) {
      recommendAPI.getMood(user.currentMood)
        .then(({ data }) => setMoodSongs(data.songs?.slice(0, 8) || []))
        .catch(() => {})
    }
  }, [user?.currentMood])

  const handleGeneratePlaylist = async () => {
    setGeneratingPl(true)
    try {
      const { data } = await playlistsAPI.generateAI({ mood: user?.currentMood })
      toast('AI playlist created! 🎵')
      setPlaylists(p => [data.playlist, ...p])
    } catch { toast('Could not generate playlist', 'error') }
    finally { setGeneratingPl(false) }
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="pt-6 pb-4 space-y-10 animate-fade-in">
      {/* Hero */}
      <motion.section initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary">
              {greeting()}, <span className="text-gradient">{user?.username}</span> 👋
            </h1>
            <p className="text-text-muted mt-1 text-sm">
              {user?.currentMood
                ? `AI tuned to your ${user.currentMood} mood ${MOOD_EMOJI[user.currentMood]}`
                : 'Set your mood for a personalized experience'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => openModal('moodPicker')} className="btn-ghost flex items-center gap-2 text-sm border border-surface-border">
              <Smile size={15} />
              {user?.currentMood ? `Mood: ${user.currentMood}` : 'Set mood'}
            </button>
            <button onClick={handleGeneratePlaylist} disabled={generatingPl} className="btn-primary flex items-center gap-2 text-sm">
              {generatingPl ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
              AI Playlist
            </button>
          </div>
        </div>
      </motion.section>

      {/* Continue Listening */}
      {recentSongs.length > 0 && (
        <Section title="Continue Listening" icon={<Clock size={16} className="text-text-muted" />} skeletonType="card">
          <HScroll>
            {recentSongs.map(song => (
              <motion.div key={song._id} variants={item} className="w-44 shrink-0">
                <SongCard song={song} queue={recentSongs} />
              </motion.div>
            ))}
          </HScroll>
        </Section>
      )}

      {/* AI Picks */}
      <Section
        title={feedSource === 'ai-hybrid' ? 'Picked For You' : feedSource === 'content-only' ? 'Based on Your Taste' : 'Recommended'}
        icon={<Sparkles size={16} className="text-brand" />}
        loading={loadingFeed}
      >
        <HScroll>
          {feed.slice(0, 12).map(song => (
            <motion.div key={song._id} variants={item} className="w-44 shrink-0">
              <SongCard song={song} queue={feed} />
            </motion.div>
          ))}
        </HScroll>
        <button onClick={loadFeed} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-brand mt-3 transition-colors">
          <RefreshCw size={12} className={loadingFeed ? 'animate-spin' : ''} /> Refresh recommendations
        </button>
      </Section>

      {/* Mood Radio */}
      {user?.currentMood && moodSongs.length > 0 && (
        <Section
          title={`${MOOD_EMOJI[user.currentMood]} ${user.currentMood.charAt(0).toUpperCase() + user.currentMood.slice(1)} Vibes`}
          icon={null}
          skeletonType="row"
        >
          <div className="space-y-1">
            {moodSongs.map((song, i) => (
              <SongRow key={song._id} song={song} index={i} queue={moodSongs} showIndex />
            ))}
          </div>
        </Section>
      )}

      {/* Featured Playlists */}
      {playlists.length > 0 && (
        <Section title="Featured Playlists" icon={<TrendingUp size={16} className="text-text-muted" />}>
          <HScroll>
            {playlists.map(pl => (
              <motion.div key={pl._id} variants={item} className="w-44 shrink-0">
                <PlaylistCard playlist={pl} />
              </motion.div>
            ))}
          </HScroll>
        </Section>
      )}

      {/* Trending */}
      <Section title="Trending Now" icon={<TrendingUp size={16} className="text-orange-400" />} loading={loadingTrend} skeletonType="row" skeletonCount={8}>
        <div className="space-y-1">
          {trending.slice(0, 10).map((song, i) => (
            <SongRow key={song._id} song={song} index={i} queue={trending} showIndex />
          ))}
        </div>
      </Section>
    </div>
  )
}
