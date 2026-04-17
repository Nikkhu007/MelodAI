import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import usePlayerStore from '../store/playerStore'
import useUIStore from '../store/uiStore'
import useAuthStore from '../store/authStore'
import { songsAPI } from '../services/api'

/**
 * Global keyboard shortcuts:
 *   g+h → Home       g+s → Search     g+l → Liked      g+m → Mood
 *   /   → focus search bar
 *   m   → mute       l   → like current song
 *   t   → toggle theme
 *   f   → full player  y → lyrics   q → queue
 *   ?   → shortcuts overlay (handled in ShortcutsOverlay)
 */
export default function useGlobalShortcuts() {
  const navigate = useNavigate()
  const gPressedRef = useRef(false)
  const gTimeoutRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      // Skip when typing
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        // still allow / to not trigger when inside an input
        return
      }

      // Modifier shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'k') {
          e.preventDefault()
          document.querySelector('input[placeholder*="earch"]')?.focus()
        }
        return
      }

      // G-prefixed shortcuts
      if (gPressedRef.current) {
        gPressedRef.current = false
        clearTimeout(gTimeoutRef.current)
        switch (e.key.toLowerCase()) {
          case 'h': e.preventDefault(); navigate('/');        return
          case 's': e.preventDefault(); navigate('/search');  return
          case 'l': e.preventDefault(); navigate('/liked');   return
          case 'm': e.preventDefault(); navigate('/mood');    return
          case 'r': e.preventDefault(); navigate('/history'); return
        }
      }

      if (e.key.toLowerCase() === 'g') {
        gPressedRef.current = true
        gTimeoutRef.current = setTimeout(() => { gPressedRef.current = false }, 1000)
        return
      }

      // Single-key shortcuts
      const { togglePlay, next, prev, seek, currentTime, duration,
              volume, setVolume, toggleMute, currentSong,
              toggleLyrics, toggleQueue } = usePlayerStore.getState()
      const { toggleTheme, toast } = useUIStore.getState()
      const { user } = useAuthStore.getState()

      switch (e.key) {
        case '/':
          e.preventDefault()
          document.querySelector('input[placeholder*="earch"]')?.focus()
          break
        case 't': case 'T':
          e.preventDefault(); toggleTheme(); break
        case 'm': case 'M':
          if (!e.ctrlKey) { e.preventDefault(); toggleMute() }
          break
        case 'l': case 'L':
          if (currentSong && user && !String(currentSong._id).startsWith('yt_') && !String(currentSong._id).startsWith('jamendo_')) {
            e.preventDefault()
            songsAPI.trackEvent(currentSong._id, { event: 'like', progress: 0, listenDuration: 0 })
              .then(() => toast('❤️ Liked!', 'success'))
              .catch(() => {})
          }
          break
        case 'y': case 'Y':
          if (currentSong) { e.preventDefault(); toggleLyrics() }
          break
        case 'q': case 'Q':
          if (currentSong) { e.preventDefault(); toggleQueue() }
          break
      }
    }

    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      clearTimeout(gTimeoutRef.current)
    }
  }, [navigate])
}
