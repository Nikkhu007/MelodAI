import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Home, Search, Library, Heart, Clock, Smile, Upload, Music2, LogOut, Plus, BarChart2 } from 'lucide-react'
import { motion } from 'framer-motion'
import useAuthStore from '../../store/authStore'
import useUIStore from '../../store/uiStore'

const NAV = [
  { to: '/',        icon: Home,    label: 'Home',         end: true },
  { to: '/search',  icon: Search,  label: 'Search' },
  { to: '/library', icon: Library, label: 'Your Library' },
]
const LIBRARY = [
  { to: '/liked',   icon: Heart,  label: 'Liked Songs' },
  { to: '/history', icon: Clock,  label: 'History' },
  { to: '/mood',    icon: Smile,    label: 'Mood Radio' },
  { to: '/stats',   icon: BarChart2, label: 'Your Stats' },
]

const SHORTCUTS = [
  ['Space',   'Play / Pause'],
  ['← →',    'Seek 10s'],
  ['↑ ↓',    'Volume'],
  ['N / P',   'Next / Prev'],
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const { openModal }    = useUIStore()
  const navigate         = useNavigate()
  const { pathname }     = useLocation()

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 h-full border-r border-surface-border/30"
      style={{ background: 'var(--color-surface)' }}>

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-surface-border/20">
        <motion.div whileHover={{ rotate: 15 }} className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center glow shrink-0">
          <Music2 size={16} className="text-white" />
        </motion.div>
        <span className="text-base font-bold text-text-primary tracking-tight">MelodAI</span>
      </div>

      {/* Main nav */}
      <nav className="px-3 pt-4 space-y-0.5">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `sidebar-link relative ${isActive ? 'active' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div layoutId="nav-pill"
                    className="absolute inset-0 rounded-xl bg-brand/10 border border-brand/20"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon size={17} className={`relative z-10 ${isActive ? 'text-brand' : ''}`} />
                <span className={`relative z-10 ${isActive ? 'text-text-primary font-medium' : ''}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Your Music */}
      <div className="px-3 mt-5">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Your Music</span>
          <motion.button whileHover={{ rotate: 90 }} transition={{ duration: 0.2 }}
            onClick={() => openModal('createPlaylist')} className="text-text-muted hover:text-brand transition-colors">
            <Plus size={14} />
          </motion.button>
        </div>
        <nav className="space-y-0.5">
          {LIBRARY.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `sidebar-link relative ${isActive ? 'active' : ''}`}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div layoutId={`lib-pill-${to}`}
                      className="absolute inset-0 rounded-xl bg-brand/10 border border-brand/20"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon size={16} className={`relative z-10 ${isActive ? 'text-brand' : ''}`} />
                  <span className={`relative z-10 ${isActive ? 'text-text-primary font-medium' : ''}`}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Admin */}
      {user?.role === 'admin' && (
        <div className="px-3 mt-2">
          <NavLink to="/upload" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <Upload size={16} /> Upload Song
          </NavLink>
        </div>
      )}

      <div className="flex-1" />

      {/* Keyboard shortcuts */}
      <div className="mx-3 mb-3 p-3 rounded-xl border border-surface-border/30" style={{ background: 'var(--color-surface-overlay)' }}>
        <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-2">Shortcuts</p>
        <div className="space-y-1">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between">
              <kbd className="text-[9px] bg-surface-border/60 text-text-muted px-1.5 py-0.5 rounded font-mono">{key}</kbd>
              <span className="text-[9px] text-text-muted">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* User */}
      <div className="border-t border-surface-border/30 px-3 py-3">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-surface-overlay transition-colors group">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand/50 to-brand-dark/50 flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-brand/20">
            {user?.avatar
              ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              : <span className="text-white text-sm font-bold">{user?.username?.[0]?.toUpperCase()}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate leading-tight">{user?.username}</p>
            <p className="text-[10px] text-text-muted capitalize">{user?.role}</p>
          </div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all p-1"
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
