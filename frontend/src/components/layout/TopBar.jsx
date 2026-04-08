import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Smile, Bell, Menu } from 'lucide-react'
import useAuthStore from '../../store/authStore'
import useUIStore from '../../store/uiStore'

const MOOD_EMOJI = {
  happy: '😄', sad: '😢', energetic: '⚡', focus: '🎯',
  chill: '😌', gym: '💪', romance: '💜', null: '😊',
}

export default function TopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()
  const { openModal } = useUIStore()

  const pageTitle = () => {
    const p = location.pathname
    if (p === '/') return 'Good vibes incoming 🎵'
    if (p === '/search') return 'Search'
    if (p === '/library') return 'Your Library'
    if (p === '/liked') return 'Liked Songs'
    if (p === '/history') return 'Recently Played'
    if (p === '/mood') return 'Mood Radio'
    return 'MelodAI'
  }

  return (
    <header className="flex items-center justify-between px-4 md:px-8 h-16 border-b border-surface-border/30 bg-[#0a0a0f]/80 backdrop-blur-md sticky top-0 z-20">
      <h1 className="text-base font-semibold text-text-primary hidden md:block">{pageTitle()}</h1>

      {/* Mobile: logo */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
          <span className="text-white text-xs font-bold">M</span>
        </div>
        <span className="font-bold text-text-primary">MelodAI</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Search shortcut */}
        <button
          onClick={() => navigate('/search')}
          className="btn-ghost p-2 rounded-full"
        >
          <Search size={18} />
        </button>

        {/* Mood pill */}
        <button
          onClick={() => openModal('moodPicker')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-raised border border-surface-border text-xs text-text-secondary hover:text-brand hover:border-brand/40 transition-all"
        >
          <span>{MOOD_EMOJI[user?.currentMood] || '🎵'}</span>
          <span className="capitalize">{user?.currentMood || 'Set mood'}</span>
        </button>
      </div>
    </header>
  )
}
