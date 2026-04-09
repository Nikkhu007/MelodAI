import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Search, Library, Heart, Clock, Smile, Upload, Music2, LogOut, Plus, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import useAuthStore from '../../store/authStore'
import useUIStore from '../../store/uiStore'

const NAV = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/library', icon: Library, label: 'Your Library' },
]

const LIBRARY = [
  { to: '/liked', icon: Heart, label: 'Liked Songs' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/mood', icon: Smile, label: 'Mood Radio' },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const { openModal } = useUIStore()
  const navigate = useNavigate()

  return (
    <aside
      className="hidden md:flex flex-col w-58 shrink-0 h-full py-5 px-3 border-r border-surface-border/30"
      style={{ background: 'var(--color-surface)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 mb-7">
        <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center glow">
          <Music2 size={17} className="text-white" />
        </div>
        <span className="text-lg font-bold text-text-primary tracking-tight">MelodAI</span>
      </div>

      {/* Main nav */}
      <nav className="space-y-0.5 mb-5">
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-surface-border/40 pt-4 mb-1">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Your Music</span>
          <button onClick={() => openModal('createPlaylist')} className="text-text-muted hover:text-brand transition-colors" title="New playlist">
            <Plus size={15} />
          </button>
        </div>
        <nav className="space-y-0.5">
          {LIBRARY.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {user?.role === 'admin' && (
        <NavLink to="/upload" className={({ isActive }) => `sidebar-link mt-0.5 ${isActive ? 'active' : ''}`}>
          <Upload size={17} />
          Upload Song
        </NavLink>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="mt-3 mx-3 p-2.5 rounded-xl bg-surface-overlay/50 border border-surface-border/30">
        <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1.5">Shortcuts</p>
        <div className="space-y-0.5">
          {[['Space','Play/Pause'],['← →','Seek 10s'],['N / P','Next/Prev'],['↑ ↓','Volume']].map(([k,v])=>(
            <div key={k} className="flex items-center justify-between">
              <code className="text-[9px] bg-surface-border/60 text-text-muted px-1.5 py-0.5 rounded">{k}</code>
              <span className="text-[9px] text-text-muted">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1" />

      {/* User */}
      <div className="mt-3 border-t border-surface-border/40 pt-3">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-brand/30 flex items-center justify-center overflow-hidden shrink-0">
            {user?.avatar
              ? <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
              : <span className="text-brand text-sm font-bold">{user?.username?.[0]?.toUpperCase()}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{user?.username}</p>
            <p className="text-[10px] text-text-muted capitalize">{user?.role}</p>
          </div>
          <button onClick={() => { logout(); navigate('/login') }} className="text-text-muted hover:text-red-400 transition-colors" title="Logout">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
