import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart2, Clock, Music, Heart, Zap, TrendingUp, Headphones } from 'lucide-react'
import { usersAPI } from '../services/api'
import usePlayerStore from '../store/playerStore'
import { SkeletonRow } from '../components/ui/Skeleton'
import SongRow from '../components/songs/SongRow'

function StatCard({ icon: Icon, label, value, sub, color = 'text-brand', gradient }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-4 border border-surface-border/30 relative overflow-hidden ${gradient || 'bg-surface-raised'}`}
    >
      <div className="relative z-10">
        <Icon size={18} className={`${color} mb-3`} />
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        <p className="text-sm font-medium text-text-primary mt-0.5">{label}</p>
        {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
      </div>
      {gradient && <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />}
    </motion.div>
  )
}

function BarMini({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-muted w-20 shrink-0 capitalize">{label}</span>
      <div className="flex-1 h-2 bg-surface-border rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full" style={{ background: color }}
        />
      </div>
      <span className="text-xs text-text-muted w-8 text-right">{value}</span>
    </div>
  )
}

function fmtDuration(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m} min`
}

export default function Stats() {
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [serverStats, setServerStats] = useState(null)
  const { playSong } = usePlayerStore()

  useEffect(() => {
    // Try server-computed stats first (faster), fall back to raw events
    usersAPI.getStats()
      .then(({ data }) => {
        if (data.stats) {
          setServerStats(data.stats)
        }
      })
      .catch(() => {})

    usersAPI.getHistory()
      .then(({ data }) => setEvents(data.events || []))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="pt-6 space-y-2">{Array(8).fill(0).map((_,i)=><SkeletonRow key={i}/>)}</div>
  )

  // ── Compute stats ─────────────────────────────────────────────────────────
  const plays        = events.filter(e => e.event === 'play')
  const likes        = events.filter(e => e.event === 'like')
  const completes    = events.filter(e => e.event === 'complete')
  const totalListen  = events.reduce((acc,e) => acc + (e.listenDuration||0), 0)

  // Top songs
  const songPlays = {}
  for (const e of plays) {
    if (!e.song) continue
    const id = e.song._id
    if (!songPlays[id]) songPlays[id] = { song: e.song, count: 0 }
    songPlays[id].count++
  }
  const topSongs = Object.values(songPlays).sort((a,b)=>b.count-a.count).slice(0,5)

  // Genre breakdown
  const genreCounts = {}
  for (const e of plays) {
    if (!e.song?.genre) continue
    genreCounts[e.song.genre] = (genreCounts[e.song.genre]||0)+1
  }
  const topGenres = Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const maxGenre  = topGenres[0]?.[1] || 1

  // Daily activity
  const dayCounts = Array(7).fill(0)
  const dayNames  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  for (const e of plays) {
    const d = new Date(e.createdAt).getDay()
    dayCounts[d]++
  }
  const maxDay = Math.max(...dayCounts, 1)

  // Mood breakdown
  const moodCounts = {}
  for (const e of plays) {
    if (!e.mood) continue
    moodCounts[e.mood] = (moodCounts[e.mood]||0)+1
  }
  const topMoods = Object.entries(moodCounts).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const maxMood  = topMoods[0]?.[1]||1

  const MOOD_COLORS = { happy:'#facc15', sad:'#60a5fa', energetic:'#fb923c', focus:'#4ade80', chill:'#22d3ee', gym:'#f87171', romance:'#f472b6' }
  const GENRE_COLOR = '#6c47ff'

  const completionRate = plays.length > 0 ? Math.round((completes.length / plays.length)*100) : 0
  const streak = (() => {
    const days = [...new Set(plays.map(e => new Date(e.createdAt).toDateString()))].reverse()
    let s = 0; const today = new Date().toDateString()
    if (!days.includes(today) && !days.includes(new Date(Date.now()-86400000).toDateString())) return 0
    for (let i = 0; i < days.length; i++) {
      const d = new Date(days[i])
      const expected = new Date(Date.now() - i * 86400000)
      if (d.toDateString() === expected.toDateString()) s++
      else break
    }
    return s
  })()

  if (plays.length === 0) {
    return (
      <div className="pt-6 text-center py-20">
        <BarChart2 size={40} className="text-text-muted mx-auto mb-4 opacity-30" />
        <p className="text-text-muted font-medium">No stats yet</p>
        <p className="text-text-muted text-sm mt-1">Play some songs to see your listening stats</p>
      </div>
    )
  }

  const allUnique = [...new Map(plays.filter(e=>e.song).map(e=>[e.song._id,e.song])).values()]

  return (
    <div className="pt-6 pb-8 animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <BarChart2 className="text-brand" size={24} /> Your Listening Stats
        </h1>
        <p className="text-text-muted text-sm mt-1">Based on {events.length} events recorded</p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Headphones} label="Songs Played"   value={plays.length}         sub="total plays"                  color="text-brand"  gradient="bg-gradient-to-br from-brand/20 to-surface-raised" />
        <StatCard icon={Clock}      label="Time Listened"  value={fmtDuration(totalListen)} sub="total listening time"      color="text-blue-400"  gradient="bg-gradient-to-br from-blue-500/15 to-surface-raised" />
        <StatCard icon={Heart}      label="Liked"          value={likes.length}          sub="songs liked"                  color="text-red-400"   gradient="bg-gradient-to-br from-red-500/15 to-surface-raised" />
        <StatCard icon={Zap}        label="Day Streak"     value={`${streak}d`}          sub={streak>1?'keep it up!':'start your streak'} color="text-orange-400" gradient="bg-gradient-to-br from-orange-500/15 to-surface-raised" />
      </div>

      {/* Completion + unique songs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 border border-surface-border/30 bg-surface-raised">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">Completion Rate</p>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-3xl font-bold text-text-primary">{completionRate}%</span>
            <span className="text-text-muted text-sm mb-1">of songs finished</span>
          </div>
          <div className="h-2 bg-surface-border rounded-full overflow-hidden">
            <motion.div initial={{width:0}} animate={{width:`${completionRate}%`}} transition={{duration:0.8}}
              className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light" />
          </div>
        </div>
        <div className="rounded-2xl p-4 border border-surface-border/30 bg-surface-raised">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">Unique Songs</p>
          <p className="text-3xl font-bold text-text-primary">{allUnique.length}</p>
          <p className="text-text-muted text-sm mt-1">different tracks played</p>
        </div>
      </div>

      {/* Weekly activity */}
      <div className="rounded-2xl p-5 border border-surface-border/30 bg-surface-raised">
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-4">Weekly Activity</p>
        <div className="flex items-end justify-between gap-2 h-20">
          {dayCounts.map((count, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <motion.div
                initial={{ height: 0 }} animate={{ height: `${(count/maxDay)*100}%` }}
                transition={{ delay: i*0.06, duration: 0.5 }}
                className="w-full rounded-t-md min-h-[4px]"
                style={{ background: count > 0 ? `rgba(108,71,255,${0.3 + (count/maxDay)*0.7})` : 'var(--color-surface-border)' }}
              />
              <span className="text-[9px] text-text-muted">{dayNames[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Genre + Mood breakdown */}
      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-2xl p-5 border border-surface-border/30 bg-surface-raised">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-4">Top Genres</p>
          <div className="space-y-2.5">
            {topGenres.map(([genre, count]) => (
              <BarMini key={genre} label={genre} value={count} max={maxGenre} color={GENRE_COLOR} />
            ))}
            {topGenres.length === 0 && <p className="text-text-muted text-sm">No genre data yet</p>}
          </div>
        </div>
        <div className="rounded-2xl p-5 border border-surface-border/30 bg-surface-raised">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-4">Moods</p>
          <div className="space-y-2.5">
            {topMoods.map(([mood, count]) => (
              <BarMini key={mood} label={mood} value={count} max={maxMood} color={MOOD_COLORS[mood]||'#6c47ff'} />
            ))}
            {topMoods.length === 0 && <p className="text-text-muted text-sm">Set your mood to track it</p>}
          </div>
        </div>
      </div>

      {/* Top 5 most played songs */}
      {topSongs.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-3">Most Played</p>
          <div className="space-y-0.5">
            {topSongs.map(({ song, count }, i) => (
              <div key={song._id} className="flex items-center gap-2">
                <SongRow song={song} index={i} queue={topSongs.map(t=>t.song)} showIndex />
                <span className="text-xs text-text-muted shrink-0 pr-2">{count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
