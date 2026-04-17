import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import usePlayerStore from './store/playerStore'
import useUIStore from './store/uiStore'
import ErrorBoundary     from './components/ui/ErrorBoundary'
import PWAInstallPrompt from './components/ui/PWAInstallPrompt'
import OfflineBanner  from './components/ui/OfflineBanner'
import Layout from './components/layout/Layout'
import { SkeletonRow } from './components/ui/Skeleton'

const Home         = lazy(() => import('./pages/Home'))
const Search       = lazy(() => import('./pages/Search'))
const Library      = lazy(() => import('./pages/Library'))
const PlaylistPage = lazy(() => import('./pages/PlaylistPage'))
const LikedSongs   = lazy(() => import('./pages/LikedSongs'))
const MoodPage     = lazy(() => import('./pages/MoodPage'))
const History      = lazy(() => import('./pages/History'))
const Stats        = lazy(() => import('./pages/Stats'))
const Login        = lazy(() => import('./pages/Login'))
const Register     = lazy(() => import('./pages/Register'))
const Upload       = lazy(() => import('./pages/Upload'))

function PageLoader() {
  return (
    <div className="pt-10 space-y-2 px-4">
      {Array(6).fill(0).map((_,i) => <SkeletonRow key={i} />)}
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { isLoggedIn, initialized } = useAuthStore()
  if (!initialized) return <PageLoader />
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return children
}

// Ambient background glow that follows album art color
function AmbientGlow() {
  const { dominantColor, isPlaying } = usePlayerStore()
  if (!dominantColor || !isPlaying) return null
  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none z-0 transition-all duration-1000"
      style={{ background: dominantColor + '20', transform: 'translateX(-50%) translateY(60%)' }}
    />
  )
}

export default function App() {
  const initialize          = useAuthStore(s => s.initialize)
  const setupAudioListeners = usePlayerStore(s => s.setupAudioListeners)
  const updateMediaSession  = usePlayerStore(s => s.updateMediaSession)
  const currentSong         = usePlayerStore(s => s.currentSong)
  const { theme }           = useUIStore()

  useEffect(() => {
    initialize()
    setupAudioListeners()
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [])

  // Update OS/browser media controls when song changes
  useEffect(() => {
    if (currentSong) updateMediaSession(currentSong)
  }, [currentSong?._id])

  return (
    <ErrorBoundary>
    <OfflineBanner />
    <BrowserRouter>
      <AmbientGlow />
      <Suspense fallback={<div className="min-h-screen" style={{background:'var(--color-bg)'}}><PageLoader /></div>}>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index               element={<Home />} />
            <Route path="search"       element={<Search />} />
            <Route path="library"      element={<Library />} />
            <Route path="playlist/:id" element={<PlaylistPage />} />
            <Route path="liked"        element={<LikedSongs />} />
            <Route path="mood"         element={<MoodPage />} />
            <Route path="history"      element={<History />} />
            <Route path="stats"        element={<Stats />} />
            <Route path="upload"       element={<Upload />} />
          </Route>
        </Routes>
      </Suspense>
    <PWAInstallPrompt />
    </BrowserRouter>
    </ErrorBoundary>
  )
}
