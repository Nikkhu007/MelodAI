import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import usePlayerStore from './store/playerStore'
import useUIStore from './store/uiStore'
import Layout from './components/layout/Layout'
import { SkeletonRow } from './components/ui/Skeleton'

// Lazy-load pages for code splitting
const Home         = lazy(() => import('./pages/Home'))
const Search       = lazy(() => import('./pages/Search'))
const Library      = lazy(() => import('./pages/Library'))
const PlaylistPage = lazy(() => import('./pages/PlaylistPage'))
const LikedSongs   = lazy(() => import('./pages/LikedSongs'))
const MoodPage     = lazy(() => import('./pages/MoodPage'))
const History      = lazy(() => import('./pages/History'))
const Login        = lazy(() => import('./pages/Login'))
const Register     = lazy(() => import('./pages/Register'))
const Upload       = lazy(() => import('./pages/Upload'))

function PageLoader() {
  return <div className="pt-10 space-y-2">{Array(6).fill(0).map((_,i)=><SkeletonRow key={i}/>)}</div>
}

function ProtectedRoute({ children }) {
  const { isLoggedIn, initialized } = useAuthStore()
  if (!initialized) return <PageLoader />
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const initialize          = useAuthStore(s => s.initialize)
  const setupAudioListeners = usePlayerStore(s => s.setupAudioListeners)
  const { theme }           = useUIStore()

  useEffect(() => {
    initialize()
    setupAudioListeners()
    // Apply saved theme on load
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [])

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen" style={{background:'var(--color-bg)'}}><PageLoader /></div>}>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index             element={<Home />} />
            <Route path="search"     element={<Search />} />
            <Route path="library"    element={<Library />} />
            <Route path="playlist/:id" element={<PlaylistPage />} />
            <Route path="liked"      element={<LikedSongs />} />
            <Route path="mood"       element={<MoodPage />} />
            <Route path="history"    element={<History />} />
            <Route path="upload"     element={<Upload />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
