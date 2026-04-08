import { useEffect, useState } from 'react'
import { Clock, TrendingUp } from 'lucide-react'
import { usersAPI } from '../services/api'
import SongRow from '../components/songs/SongRow'
import { SkeletonRow } from '../components/ui/Skeleton'

const EVENT_LABEL = { play: '▶ Played', like: '♥ Liked', skip: '⏭ Skipped', complete: '✓ Completed', repeat: '↺ Repeated' }

export default function History() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    usersAPI.getHistory()
      .then(({ data }) => setEvents(data.events || []))
      .finally(() => setLoading(false))
  }, [])

  // Group events by date
  const grouped = events.reduce((acc, e) => {
    const date = new Date(e.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    if (!acc[date]) acc[date] = []
    acc[date].push(e)
    return acc
  }, {})

  // Unique songs for the player queue
  const uniqueSongs = [...new Map(events.filter(e => e.song).map(e => [e.song._id, e.song])).values()]

  return (
    <div className="pt-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <Clock size={22} className="text-brand" />
        <h1 className="text-2xl font-bold text-text-primary">Recently Played</h1>
      </div>

      {loading ? (
        <div className="space-y-1">{Array(10).fill(0).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : events.length === 0 ? (
        <div className="text-center py-20">
          <Clock size={40} className="text-text-muted mx-auto mb-4" />
          <p className="text-text-muted">No listening history yet.</p>
          <p className="text-text-muted text-sm mt-1">Start playing songs to see them here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, dateEvents]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">{date}</p>
              <div className="space-y-1">
                {dateEvents.filter(e => e.song).map((e, i) => (
                  <div key={e._id || i} className="relative">
                    <SongRow song={e.song} index={i} queue={uniqueSongs} />
                    <span className={`absolute right-16 top-1/2 -translate-y-1/2 text-[10px] px-2 py-0.5 rounded-full
                      ${e.event === 'like' ? 'bg-brand/20 text-brand' : e.event === 'skip' ? 'bg-red-500/10 text-red-400' : 'bg-surface-overlay text-text-muted'}`}>
                      {EVENT_LABEL[e.event] || e.event}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
