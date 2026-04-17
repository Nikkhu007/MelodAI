import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Sidebar         from './Sidebar'
import BottomNav       from './BottomNav'
import Player          from '../player/Player'
import TopBar          from './TopBar'
import Onboarding      from '../ui/Onboarding'
import useUIStore      from '../../store/uiStore'
import useAuthStore    from '../../store/authStore'
import useGlobalShortcuts from '../../hooks/useGlobalShortcuts'
import AddToPlaylistModal  from '../playlists/AddToPlaylistModal'
import CreatePlaylistModal from '../playlists/CreatePlaylistModal'
import MoodPickerModal     from '../ui/MoodPickerModal'
import UploadModal         from '../songs/UploadModal'
import ShareModal          from '../ui/ShareModal'
import SleepTimerModal     from '../ui/SleepTimerModal'
import ShortcutsOverlay    from '../ui/ShortcutsOverlay'
import SongRadio           from '../player/SongRadio'
import ToastContainer      from '../ui/ToastContainer'

const ONBOARDING_KEY = 'melodai_onboarding_done'

export default function Layout() {
  const { modals, theme } = useUIStore()
  const { user }          = useAuthStore()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useGlobalShortcuts()

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  // Show onboarding once per account
  useEffect(() => {
    if (!user) return
    const key = `${ONBOARDING_KEY}_${user._id}`
    if (!localStorage.getItem(key)) {
      setTimeout(() => setShowOnboarding(true), 800)
    }
  }, [user?._id])

  const doneOnboarding = () => {
    if (user) localStorage.setItem(`${ONBOARDING_KEY}_${user._id}`, '1')
    setShowOnboarding(false)
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main
          className="flex-1 overflow-y-auto page-enter"
          style={{
            paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))',  // space for player + mobile nav
            paddingLeft:  '1rem',
            paddingRight: '1rem',
          }}
        >
          <Outlet />
        </main>
      </div>

      {/* Player bar */}
      <Player />

      {/* Mobile bottom nav — shown above player */}
      <BottomNav />

      {/* Modals */}
      <AnimatePresence>
        {modals.addToPlaylist  && <AddToPlaylistModal  key="addPl" />}
        {modals.createPlaylist && <CreatePlaylistModal key="createPl" />}
        {modals.moodPicker     && <MoodPickerModal     key="mood" />}
        {modals.uploadSong     && <UploadModal         key="upload" />}
        {modals.shareModal     && <ShareModal          key="share" />}
        {modals.sleepTimer     && <SleepTimerModal     key="sleep" />}
        {showOnboarding        && <Onboarding key="onboard" onDone={doneOnboarding} />}
      </AnimatePresence>

      <ShortcutsOverlay />
      <SongRadio />
      <ToastContainer />
    </div>
  )
}
