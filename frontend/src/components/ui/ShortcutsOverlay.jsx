import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Keyboard, X } from 'lucide-react'

const SHORTCUTS = [
  { category: 'Playback', items: [
    { keys: ['Space'],       desc: 'Play / Pause' },
    { keys: ['N'],           desc: 'Next song' },
    { keys: ['P'],           desc: 'Previous song' },
    { keys: ['←', '→'],      desc: 'Seek 10 seconds' },
    { keys: ['Shift', '←', '→'], desc: 'Seek 30 seconds' },
    { keys: ['↑', '↓'],      desc: 'Volume up / down' },
    { keys: ['M'],           desc: 'Mute / Unmute' },
    { keys: ['L'],           desc: 'Like current song' },
  ]},
  { category: 'Navigation', items: [
    { keys: ['G', 'H'],      desc: 'Go to Home' },
    { keys: ['G', 'S'],      desc: 'Go to Search' },
    { keys: ['G', 'L'],      desc: 'Go to Liked Songs' },
    { keys: ['G', 'M'],      desc: 'Go to Mood Radio' },
    { keys: ['/'],           desc: 'Focus search' },
  ]},
  { category: 'Interface', items: [
    { keys: ['?'],           desc: 'Show this shortcuts panel' },
    { keys: ['Esc'],         desc: 'Close dialogs' },
    { keys: ['T'],           desc: 'Toggle theme' },
    { keys: ['F'],           desc: 'Full-screen player' },
    { keys: ['Y'],           desc: 'Show lyrics' },
    { keys: ['Q'],           desc: 'Show queue' },
  ]},
]

function Key({ children }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-surface-overlay border border-surface-border text-[11px] font-mono text-text-secondary shadow-sm">
      {children}
    </kbd>
  )
}

export default function ShortcutsOverlay() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === '?') { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="glass-card w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border/30 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand/20 flex items-center justify-center">
                  <Keyboard size={16} className="text-brand" />
                </div>
                <div>
                  <h2 className="font-semibold text-text-primary text-sm">Keyboard Shortcuts</h2>
                  <p className="text-[10px] text-text-muted">Press <Key>?</Key> anytime to toggle</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary p-1">
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-5 space-y-6 scrollbar-hide">
              {SHORTCUTS.map(section => (
                <div key={section.category}>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">
                    {section.category}
                  </h3>
                  <div className="space-y-2">
                    {section.items.map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="flex items-center justify-between gap-4"
                      >
                        <span className="text-sm text-text-secondary">{item.desc}</span>
                        <div className="flex gap-1 shrink-0">
                          {item.keys.map((k, j) => (
                            <span key={j} className="flex items-center gap-1">
                              {j > 0 && <span className="text-text-muted text-[10px]">then</span>}
                              <Key>{k}</Key>
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
