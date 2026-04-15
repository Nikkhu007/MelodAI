import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, TrendingUp, Trash2 } from 'lucide-react'
import { usersAPI, youtubeAPI } from '../services/api'
import usePlayerStore from '../store/playerStore'
import { SkeletonRow } from '../components/ui/Skeleton'
import SongRow from '../components/songs/SongRow'

const EVENT_STYLE = {
  play:     { label: '▶',  cls: 'bg-surface-overlay text-text-muted' },
  like:     { label: '♥',  cls: 'bg-brand/20 text-brand' },
  unlike:   { label: '♡',  cls: 'bg-surface-overlay text-text-muted' },
  skip:     { label: '⏭',  cls: 'bg-red-500/10 text-red-400' },
  complete: { label: '✓',  cls: 'bg-green-500/10 text-green-400' },
  repeat:   { label: '↺',  cls: 'bg-blue-500/10 text-blue-400' },
}

export default function History() {
  const [events,   setEvents]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const { playSong } = usePlayerStore()

  useEffect(() => {
    usersAPI.getHistory()
      .then(({ data }) => setEvents(data.events || []))
      .finally(() => setLoading(false))
  }, [])

  // Group by date
  const grouped = events.reduce((acc, e) => {
    const date = new Date(e.createdAt).toLocaleDateString('en-IN', {
      weekday: 'long', month: 'short', day: 'numeric'
    })
    if (!acc[date]) acc[date] = []
    acc[date].push(e)
    return acc
  }, {})

  // Unique songs for queue (play events only)
  const uniqueSongs = [...new Map(
    events.filter(e => e.song && e.event === 'play').map(e => [e.song._id, e.song])
  ).values()]

  if (loading) {
    return (
      <div className="pt-6 space-y-2">
        {Array(10).fill(0).map((_,i) => <SkeletonRow key={i} />)}
      </div>
    )
  }

  return (
    <div className="pt-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <Clock size={20} className="text-brand" />
        <h1 className="text-2xl font-bold text-text-primary">Recently Played</h1>
        {events.length > 0 && (
          <span className="ml-auto text-xs text-text-muted">{events.length} events</span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20">
          <Clock size={40} className="text-text-muted mx-auto mb-4 opacity-30" />
          <p className="text-text-muted font-medium">No listening history yet</p>
          <p className="text-text-muted text-sm mt-1">Play some songs and they'll appear here</p>
        </div>
      ) : (
        <div className="space-y-7">
          {Object.entries(grouped).map(([date, dateEvents]) => {
            const playEvents = dateEvents.filter(e => e.song)
            if (!playEvents.length) return null
            return (
              <section key={date}>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-2 px-1">{date}</p>
                <div className="space-y-0.5">
                  {playEvents.map((e, i) => (
                    <div key={e._id || i} className="relative group">
                      <SongRow song={e.song} index={i} queue={uniqueSongs} />
                      {/* Event badge */}
                      <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity
                        ${EVENT_STYLE[e.event]?.cls || 'bg-surface-overlay text-text-muted'}`}>
                        {EVENT_STYLE[e.event]?.label || e.event}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
