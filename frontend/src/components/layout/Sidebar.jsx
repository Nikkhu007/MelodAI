import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home, Search, Library, Heart, Clock, Smile, Upload,
  Music2, LogOut, ChevronRight, Plus
} from 'lucide-react'
import useAuthStore from '../../store/authStore'
import useUIStore from '../../store/uiStore'

const NAV_LINKS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/library', icon: Library, label: 'Your Library' },
]

const LIBRARY_LINKS = [
  { to: '/liked', icon: Heart, label: 'Liked Songs' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/mood', icon: Smile, label: 'Mood Radio' },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const { openModal } = useUIStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 h-full bg-[#0d0d14] border-r border-surface-border/40 py-5 px-3">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 mb-8">
        <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center glow">
          <Music2 size={18} className="text-white" />
        </div>
        <span className="text-lg font-bold text-text-primary tracking-tight">MelodAI</span>
      </div>

      {/* Main nav */}
      <nav className="space-y-1 mb-6">
        {NAV_LINKS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-surface-border/40 pt-4 mb-2">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-widest">Your Music</span>
          <button
            onClick={() => openModal('createPlaylist')}
            className="text-text-muted hover:text-brand transition-colors"
          >
            <Plus size={16} />
          </button>
        </div>
        <nav className="space-y-1">
          {LIBRARY_LINKS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Upload (admin) */}
      {user?.role === 'admin' && (
        <NavLink to="/upload" className={({ isActive }) => `sidebar-link mt-1 ${isActive ? 'active' : ''}`}>
          <Upload size={18} />
          Upload Song
        </NavLink>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* User profile */}
      <div className="mt-4 border-t border-surface-border/40 pt-4">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-brand/30 flex items-center justify-center overflow-hidden shrink-0">
            {user?.avatar
              ? <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
              : <span className="text-brand text-sm font-bold">{user?.username?.[0]?.toUpperCase()}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{user?.username}</p>
            <p className="text-xs text-text-muted truncate">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="text-text-muted hover:text-red-400 transition-colors" title="Logout">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
