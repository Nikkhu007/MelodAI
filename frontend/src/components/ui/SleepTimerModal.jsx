import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Moon, X, Clock, Music } from 'lucide-react'
import usePlayerStore from '../../store/playerStore'
import useUIStore from '../../store/uiStore'

const PRESETS = [
  { mins: 5,   label: '5 minutes' },
  { mins: 15,  label: '15 minutes' },
  { mins: 30,  label: '30 minutes' },
  { mins: 60,  label: '1 hour' },
  { mins: 90,  label: '1.5 hours' },
  { mins: 0,   label: 'End of song', endOfSong: true },
]

export default function SleepTimerModal() {
  const { modals, closeModal, toast } = useUIStore()
  const { togglePlay, isPlaying } = usePlayerStore()
  const [remaining, setRemaining] = useState(0)
  const [active, setActive]       = useState(false)

  // Load persisted timer
  useEffect(() => {
    const saved = localStorage.getItem('melodai_sleep_timer')
    if (saved) {
      const { endTime } = JSON.parse(saved)
      const left = Math.floor((endTime - Date.now()) / 1000)
      if (left > 0) { setRemaining(left); setActive(true) }
      else localStorage.removeItem('melodai_sleep_timer')
    }
  }, [])

  // Countdown
  useEffect(() => {
    if (!active || remaining <= 0) return
    const interval = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(interval)
          setActive(false)
          localStorage.removeItem('melodai_sleep_timer')
          if (isPlaying) togglePlay()
          toast('😴 Sleep timer ended — music paused', 'info')
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [active, remaining, isPlaying, togglePlay, toast])

  const setTimer = (mins) => {
    if (mins === 0) {
      toast('Will pause at end of current song', 'info')
      closeModal('sleepTimer')
      return
    }
    const secs = mins * 60
    setRemaining(secs)
    setActive(true)
    localStorage.setItem('melodai_sleep_timer', JSON.stringify({ endTime: Date.now() + secs * 1000 }))
    toast(`Sleep timer set: ${mins}min`, 'success')
    closeModal('sleepTimer')
  }

  const cancel = () => {
    setActive(false)
    setRemaining(0)
    localStorage.removeItem('melodai_sleep_timer')
    toast('Sleep timer cancelled', 'info')
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  if (!modals.sleepTimer) return null

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => closeModal('sleepTimer')}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="glass-card w-full max-w-sm mx-4 mb-4 sm:mb-0 p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand/20 flex items-center justify-center">
              <Moon size={16} className="text-brand" />
            </div>
            <div>
              <h2 className="font-semibold text-text-primary text-sm">Sleep Timer</h2>
              <p className="text-[10px] text-text-muted">Music will pause automatically</p>
            </div>
          </div>
          <button onClick={() => closeModal('sleepTimer')} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {/* Active timer display */}
        {active && (
          <div className="mb-4 p-4 rounded-xl bg-brand/10 border border-brand/20 text-center">
            <Clock size={24} className="text-brand mx-auto mb-2" />
            <p className="text-2xl font-bold text-text-primary font-mono tabular-nums">{fmt(remaining)}</p>
            <p className="text-[10px] text-text-muted mt-1">until music pauses</p>
            <button onClick={cancel} className="mt-3 text-xs text-red-400 hover:text-red-300 transition-colors">
              Cancel timer
            </button>
          </div>
        )}

        {/* Presets */}
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => setTimer(p.mins)}
              className="p-3 rounded-xl border border-surface-border hover:border-brand/40 hover:bg-brand/5 transition-all text-left"
            >
              <div className="flex items-center gap-2">
                {p.endOfSong
                  ? <Music size={14} className="text-brand" />
                  : <Clock size={14} className="text-brand" />
                }
                <span className="text-sm font-medium text-text-primary">{p.label}</span>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
