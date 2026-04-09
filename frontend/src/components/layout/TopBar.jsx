import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Smile, Sun, Moon, Upload } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import useUIStore from '../../store/uiStore'
import { motion } from 'framer-motion'

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
  const navigate  = useNavigate()
  const { pathname } = useLocation()
  const { user }  = useAuthStore()
  const { openModal, toggleTheme, theme } = useUIStore()

  const title = PAGE_TITLES[pathname] || 'MelodAI'

  return (
    <header className="flex items-center justify-between px-4 md:px-8 h-14 border-b border-surface-border/30 bg-[var(--color-bg)]/80 backdrop-blur-md sticky top-0 z-20 shrink-0">
      {/* Page title */}
      <h1 className="text-sm font-semibold text-text-primary hidden md:block">{title}</h1>

      {/* Mobile logo */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
          <span className="text-white text-xs font-bold">M</span>
        </div>
        <span className="font-bold text-text-primary">MelodAI</span>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Search */}
        <button onClick={() => navigate('/search')} className="btn-ghost p-2 rounded-full" title="Search (S)">
          <Search size={17} />
        </button>

        {/* Mood pill */}
        <button
          onClick={() => openModal('moodPicker')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-raised border border-surface-border text-xs hover:border-brand/40 transition-all"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <span>{MOOD_EMOJI[user?.currentMood] || '🎵'}</span>
          <span className="capitalize">{user?.currentMood || 'Set mood'}</span>
        </button>

        {/* Theme toggle */}
        <motion.button
          onClick={toggleTheme}
          className="btn-ghost p-2 rounded-full"
          whileTap={{ rotate: 20 }}
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </motion.button>

        {/* Upload (admin) */}
        {user?.role === 'admin' && (
          <button onClick={() => navigate('/upload')} className="btn-ghost p-2 rounded-full" title="Upload">
            <Upload size={17} />
          </button>
        )}
      </div>
    </header>
  )
}
