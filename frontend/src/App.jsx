import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import usePlayerStore from './store/playerStore'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import Search from './pages/Search'
import Library from './pages/Library'
import PlaylistPage from './pages/PlaylistPage'
import LikedSongs from './pages/LikedSongs'
import MoodPage from './pages/MoodPage'
import History from './pages/History'
import Login from './pages/Login'
import Register from './pages/Register'
import Upload from './pages/Upload'
import ToastContainer from './components/ui/ToastContainer'

function ProtectedRoute({ children }) {
  const { isLoggedIn, initialized } = useAuthStore()
  if (!initialized) return null
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const initialize = useAuthStore((s) => s.initialize)
  const setupAudioListeners = usePlayerStore((s) => s.setupAudioListeners)

  useEffect(() => {
    initialize()
    setupAudioListeners()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="library" element={<Library />} />
          <Route path="playlist/:id" element={<PlaylistPage />} />
          <Route path="liked" element={<LikedSongs />} />
          <Route path="mood" element={<MoodPage />} />
          <Route path="history" element={<History />} />
          <Route path="upload" element={<Upload />} />
        </Route>
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  )
}
