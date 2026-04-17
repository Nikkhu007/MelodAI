import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar'
import Player from '../player/Player'
import TopBar from './TopBar'
import useUIStore from '../../store/uiStore'
import useGlobalShortcuts from '../../hooks/useGlobalShortcuts'
import AddToPlaylistModal  from '../playlists/AddToPlaylistModal'
import CreatePlaylistModal from '../playlists/CreatePlaylistModal'
import MoodPickerModal     from '../ui/MoodPickerModal'
import UploadModal         from '../songs/UploadModal'
import ShareModal          from '../ui/ShareModal'
import SleepTimerModal     from '../ui/SleepTimerModal'
import ShortcutsOverlay    from '../ui/ShortcutsOverlay'
import SongRadio          from '../player/SongRadio'
import ToastContainer      from '../ui/ToastContainer'

export default function Layout() {
  const { modals, theme } = useUIStore()

  // Wire up global keyboard shortcuts
  useGlobalShortcuts()

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-bg)' }}>
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main
          className="flex-1 overflow-y-auto pb-28 px-4 md:px-8 page-enter"
          style={{ scrollbarGutter: 'stable' }}
        >
          <Outlet />
        </main>
      </div>

      <Player />

      <AnimatePresence>
        {modals.addToPlaylist  && <AddToPlaylistModal  key="addPl" />}
        {modals.createPlaylist && <CreatePlaylistModal key="createPl" />}
        {modals.moodPicker     && <MoodPickerModal     key="mood" />}
        {modals.uploadSong     && <UploadModal         key="upload" />}
        {modals.shareModal     && <ShareModal          key="share" />}
        {modals.sleepTimer     && <SleepTimerModal     key="sleep" />}
      </AnimatePresence>

      {/* Always-mounted overlay for ? keyboard shortcuts */}
      <ShortcutsOverlay />
      <SongRadio />

      <ToastContainer />
    </div>
  )
}
