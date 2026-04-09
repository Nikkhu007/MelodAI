import { useRef } from 'react'
import { X, Music, GripVertical, Play } from 'lucide-react'
import usePlayerStore from '../../store/playerStore'

function formatDuration(s) {
  if (!s) return '—'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function QueuePanel() {
  const { queue, queueIndex, currentSong, playSong, removeFromQueue, clearQueue } = usePlayerStore()

  const upcoming = queue.slice(queueIndex + 1)
  const previous = queue.slice(0, queueIndex)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border/30 shrink-0">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Queue</p>
        {queue.length > 0 && (
          <button onClick={clearQueue} className="text-xs text-text-muted hover:text-red-400 transition-colors">
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Now playing */}
        {currentSong && (
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2 px-1">Now Playing</p>
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-brand/10 border border-brand/20">
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-surface-overlay shrink-0">
                {currentSong.coverUrl
                  ? <img src={currentSong.coverUrl} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Music size={14} className="text-text-muted" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-brand truncate">{currentSong.title}</p>
                <p className="text-[10px] text-text-muted truncate">{currentSong.artist}</p>
              </div>
              <span className="text-[10px] text-text-muted">{formatDuration(currentSong.duration)}</span>
            </div>
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div className="px-3 pt-3">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2 px-1">Up Next ({upcoming.length})</p>
            <div className="space-y-0.5">
              {upcoming.map((song, i) => {
                const realIdx = queueIndex + 1 + i
                return (
                  <div
                    key={song._id + i}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-overlay group cursor-pointer"
                    onClick={() => playSong(song, queue)}
                  >
                    <GripVertical size={12} className="text-text-muted opacity-0 group-hover:opacity-100" />
                    <div className="w-8 h-8 rounded-md overflow-hidden bg-surface-overlay shrink-0">
                      {song.coverUrl
                        ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Music size={12} className="text-text-muted" /></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-primary truncate">{song.title}</p>
                      <p className="text-[10px] text-text-muted truncate">{song.artist}</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); removeFromQueue(realIdx) }}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 p-0.5 transition-all"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {queue.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-text-muted gap-2">
            <Music size={24} className="opacity-30" />
            <p className="text-xs">Queue is empty</p>
          </div>
        )}
      </div>
    </div>
  )
}
