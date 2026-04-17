import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Sun, Moon, Moon as MoonIcon, Keyboard } from 'lucide-react'
import { motion } from 'framer-motion'
import useAuthStore from '../../store/authStore'
import useUIStore from '../../store/uiStore'

const MOOD_EMOJI = { happy:'😄', sad:'😢', energetic:'⚡', focus:'🎯', chill:'😌', gym:'💪', romance:'💜' }

const PAGE_TITLES = {
  '/':        'Home',
  '/search':  'Search',
  '/library': 'Your Library',
  '/liked':   'Liked Songs',
  '/history': 'History',
  '/mood':    'Mood Radio',
  '/upload':  'Upload',
}

export default function TopBar() {
  const navigate   = useNavigate()
  const { pathname } = useLocation()
  const { user }   = useAuthStore()
  const { openModal, toggleTheme, theme } = useUIStore()

  const title = PAGE_TITLES[pathname] || 'MelodAI'

  return (
    <header className="flex items-center justify-between px-4 md:px-6 h-14 border-b border-surface-border/20 backdrop-blur-md sticky top-0 z-20 shrink-0"
      style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>

      <h1 className="text-sm font-semibold text-text-primary hidden md:block">{title}</h1>

      <div className="flex items-center gap-2 md:hidden">
        <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
          <span className="text-white text-xs font-bold">M</span>
        </div>
        <span className="font-bold text-text-primary">MelodAI</span>
      </div>

      <div className="flex items-center gap-1">
        {/* Search */}
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/search')}
          className="btn-ghost p-2 rounded-xl" title="Search (press /)">
          <Search size={17} />
        </motion.button>

        {/* Mood pill */}
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => openModal('moodPicker')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
          style={{
            background: 'var(--color-surface-raised)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}>
          <span>{MOOD_EMOJI[user?.currentMood] || '🎵'}</span>
          <span className="capitalize">{user?.currentMood || 'Set mood'}</span>
        </motion.button>

        {/* Sleep timer */}
        <motion.button whileTap={{ scale: 0.9 }}
          onClick={() => openModal('sleepTimer')}
          className="btn-ghost p-2 rounded-xl hidden md:flex" title="Sleep timer">
          <MoonIcon size={16} />
        </motion.button>

        {/* Shortcuts hint */}
        <motion.button whileTap={{ scale: 0.9 }}
          onClick={() => { const e = new KeyboardEvent('keydown', { key: '?' }); document.dispatchEvent(e) }}
          className="btn-ghost p-2 rounded-xl hidden md:flex" title="Keyboard shortcuts (press ?)">
          <Keyboard size={16} />
        </motion.button>

        {/* Theme toggle */}
        <motion.button whileTap={{ scale: 0.9, rotate: 20 }} onClick={toggleTheme}
          className="btn-ghost p-2 rounded-xl" title="Toggle theme (press T)">
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </motion.button>
      </div>
    </header>
  )
}
