/**
 * BottomNav — Mobile only (hidden on md+)
 * Shown at the bottom of screen instead of sidebar
 */
import { NavLink } from 'react-router-dom'
import { Home, Search, Library, Heart, Smile } from 'lucide-react'
import { motion } from 'framer-motion'

const TABS = [
  { to: '/',        icon: Home,    label: 'Home',    end: true },
  { to: '/search',  icon: Search,  label: 'Search' },
  { to: '/library', icon: Library, label: 'Library' },
  { to: '/liked',   icon: Heart,   label: 'Liked' },
  { to: '/mood',    icon: Smile,   label: 'Mood' },
]

export default function BottomNav() {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-surface-border/40"
      style={{
        background: 'var(--color-surface)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-center justify-around h-14 px-2">
        {TABS.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end} className="flex-1">
            {({ isActive }) => (
              <motion.div
                whileTap={{ scale: 0.85 }}
                className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors
                  ${isActive ? 'text-brand' : 'text-text-muted'}`}
              >
                <div className="relative">
                  {isActive && (
                    <motion.div
                      layoutId="bottom-nav-pill"
                      className="absolute inset-0 -m-1.5 rounded-lg bg-brand/15"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon size={20} className="relative z-10" fill={isActive ? 'currentColor' : 'none'} strokeWidth={isActive ? 2.5 : 1.8} />
                </div>
                <span className={`text-[9px] font-medium ${isActive ? 'text-brand' : 'text-text-muted'}`}>
                  {label}
                </span>
              </motion.div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
