import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Player from '../player/Player'
import TopBar from './TopBar'
import useUIStore from '../../store/uiStore'
import AddToPlaylistModal from '../playlists/AddToPlaylistModal'
import CreatePlaylistModal from '../playlists/CreatePlaylistModal'
import MoodPickerModal from '../ui/MoodPickerModal'
import UploadModal from '../songs/UploadModal'

export default function Layout() {
  const { sidebarOpen, modals } = useUIStore()

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0f]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300`}>
        <TopBar />
        <main
          className="flex-1 overflow-y-auto pb-28 px-4 md:px-8 page-enter"
          style={{ scrollbarGutter: 'stable' }}
        >
          <Outlet />
        </main>
      </div>

      {/* Persistent bottom player */}
      <Player />

      {/* Modals */}
      {modals.addToPlaylist && <AddToPlaylistModal />}
      {modals.createPlaylist && <CreatePlaylistModal />}
      {modals.moodPicker && <MoodPickerModal />}
      {modals.uploadSong && <UploadModal />}
    </div>
  )
}
