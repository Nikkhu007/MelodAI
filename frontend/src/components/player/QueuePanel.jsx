import { useState } from 'react'
import { X, Music, Play, ListPlus, Clock, Shuffle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import usePlayerStore from '../../store/playerStore'
import useUIStore from '../../store/uiStore'
import { playlistsAPI } from '../../services/api'

function fmtDur(s) {
  if (!s) return '—'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2,'0')}`
}
function fmtTotal(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

export default function QueuePanel() {
  const { queue, queueIndex, currentSong, playSong, removeFromQueue, clearQueue, addToQueue } = usePlayerStore()
  const { toast, openModal } = useUIStore()
  const [saving, setSaving] = useState(false)

  const upcoming = queue.slice(queueIndex + 1)
  const history  = queue.slice(0, Math.max(0, queueIndex))
  const totalDuration = queue.reduce((acc, s) => acc + (s.duration || 0), 0)

  const saveAsPlaylist = async () => {
    if (!queue.length) return
    setSaving(true)
    try {
      const name = `Queue — ${new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`
      const { data } = await playlistsAPI.create({ name, isPublic: false })
      const pl = data.playlist
      for (const song of queue) {
        await playlistsAPI.addSong(pl._id, song._id, song)
      }
      toast(`Saved as "${pl.name}" ✓`)
    } catch { toast('Could not save', 'error') }
    finally   { setSaving(false) }
  }

  const shuffleUpcoming = () => {
    if (!upcoming.length) return
    const before   = queue.slice(0, queueIndex + 1)
    const shuffled = [...upcoming].sort(() => Math.random() - 0.5)
    // rebuild queue in store: clear upcoming and re-add shuffled
    for (let i = queue.length - 1; i > queueIndex; i--) removeFromQueue(i)
    shuffled.forEach(s => addToQueue(s))
    toast('Queue shuffled')
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border/30 shrink-0">
        <div>
          <p className="text-xs font-bold text-text-secondary uppercase tracking-wider">Queue</p>
          {queue.length > 0 && (
            <p className="text-[9px] text-text-muted mt-0.5">{queue.length} songs · {fmtTotal(totalDuration)}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {upcoming.length > 1 && (
            <button onClick={shuffleUpcoming} className="btn-ghost p-1.5 text-text-muted hover:text-brand" title="Shuffle upcoming">
              <Shuffle size={13} />
            </button>
          )}
          {queue.length > 0 && (
            <button onClick={saveAsPlaylist} disabled={saving}
              className="btn-ghost p-1.5 text-text-muted hover:text-brand" title="Save as playlist">
              <ListPlus size={13} />
            </button>
          )}
          {queue.length > 0 && (
            <button onClick={clearQueue} className="text-[10px] text-text-muted hover:text-red-400 transition-colors px-1.5 py-1">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Now playing */}
        {currentSong && (
          <div className="px-3 pt-3 pb-1">
            <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-2 px-1">Now Playing</p>
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-brand/10 border border-brand/20">
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-overlay shrink-0">
                {currentSong.coverUrl
                  ? <img src={currentSong.coverUrl} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Music size={13} className="text-text-muted" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-brand truncate">{currentSong.title}</p>
                <p className="text-[10px] text-text-muted truncate">{currentSong.artist}</p>
              </div>
              <span className="text-[9px] text-text-muted tabular-nums">{fmtDur(currentSong.duration)}</span>
            </div>
          </div>
        )}

        {/* Up next */}
        {upcoming.length > 0 && (
          <div className="px-3 pt-3 pb-2">
            <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-2 px-1">
              Up Next ({upcoming.length})
            </p>
            <AnimatePresence>
              {upcoming.map((song, i) => {
                const realIdx = queueIndex + 1 + i
                return (
                  <motion.div
                    key={song._id + realIdx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-overlay group cursor-pointer mb-0.5"
                    onClick={() => playSong(song, queue)}
                  >
                    <span className="text-[9px] text-text-muted w-4 shrink-0 text-center tabular-nums">{i + 1}</span>
                    <div className="w-8 h-8 rounded-md overflow-hidden bg-surface-overlay shrink-0 relative">
                      {song.coverUrl
                        ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Music size={11} className="text-text-muted" /></div>
                      }
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play size={10} fill="white" className="text-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-primary truncate leading-tight">{song.title}</p>
                      <p className="text-[9px] text-text-muted truncate">{song.artist}</p>
                    </div>
                    <span className="text-[9px] text-text-muted tabular-nums hidden group-hover:hidden">
                      {fmtDur(song.duration)}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); removeFromQueue(realIdx) }}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 p-0.5 transition-all shrink-0"
                    >
                      <X size={11} />
                    </button>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="px-3 pt-2 pb-3 border-t border-surface-border/20 mt-2">
            <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-2 px-1">History ({history.length})</p>
            {history.slice(-5).reverse().map((song, i) => (
              <div
                key={song._id + 'h' + i}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-overlay group cursor-pointer opacity-50 hover:opacity-80 transition-opacity mb-0.5"
                onClick={() => playSong(song, queue)}
              >
                <div className="w-7 h-7 rounded-md overflow-hidden bg-surface-overlay shrink-0">
                  {song.coverUrl ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-text-secondary truncate">{song.title}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {queue.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-text-muted gap-2">
            <Music size={22} className="opacity-30" />
            <p className="text-xs">Queue is empty</p>
            <p className="text-[10px] opacity-60">Songs will auto-add via Song Radio</p>
          </div>
        )}
      </div>
    </div>
  )
}
