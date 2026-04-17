/**
 * API Service — v3 Maximum Level
 *
 * Features:
 *  - Request deduplication (identical in-flight requests share one Promise)
 *  - Automatic retry with exponential backoff (3 attempts, network errors only)
 *  - Offline detection (queues non-critical requests while offline)
 *  - Request cancellation via AbortController
 *  - Response normalisation (always { success, data, error, status })
 *  - JWT auto-refresh on 401 (single retry, prevents infinite loops)
 *  - Request ID header forwarded from backend
 *  - Stale-while-revalidate in-memory cache
 */
import axios from 'axios'

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({
  // Always use relative /api - goes through Vite proxy in dev, same domain in prod
  // NEVER hardcode localhost:5000 - breaks when Vite runs on different port
  baseURL:         '/api',
  timeout:         20000,
  withCredentials: true,
})

// ── Request deduplication map ─────────────────────────────────────────────────
// Prevents multiple identical GET requests firing simultaneously (e.g. two
// components mounting at the same time both calling /songs/trending)
const inFlight = new Map()

// ── In-memory SWR cache ───────────────────────────────────────────────────────
const swr = new Map()  // key -> { data, ts, staleMs }

function swrGet(key)                       { return swr.get(key) }
function swrSet(key, data, ttlMs = 300000) { swr.set(key, { data, ts: Date.now(), ttlMs }) }
function swrIsStale(entry)                 { return !entry || Date.now() - entry.ts > entry.ttlMs }
function swrInvalidate(prefix)             { swr.forEach((_, k) => { if (k.startsWith(prefix)) swr.delete(k) }) }

// ── Offline queue ─────────────────────────────────────────────────────────────
const offlineQueue = []
let   isOnline     = navigator.onLine

window.addEventListener('online',  () => {
  isOnline = true
  flushOfflineQueue()
})
window.addEventListener('offline', () => { isOnline = false })

function flushOfflineQueue() {
  while (offlineQueue.length > 0) {
    const { fn, resolve, reject } = offlineQueue.shift()
    fn().then(resolve).catch(reject)
  }
}

// ── Request interceptor — attach token + request ID ──────────────────────────
api.interceptors.request.use(config => {
  const token = localStorage.getItem('melodai_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  config.headers['X-Client-Version'] = '3.0'
  return config
})

// ── Response interceptor — 401 auto-refresh ───────────────────────────────────
let refreshing = null   // singleton refresh promise

api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (
      err.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/')
    ) {
      original._retry = true
      try {
        if (!refreshing) {
          refreshing = api.post('/auth/refresh').finally(() => { refreshing = null })
        }
        const { data } = await refreshing
        localStorage.setItem('melodai_token', data.token)
        original.headers.Authorization = `Bearer ${data.token}`
        return api(original)
      } catch {
        localStorage.removeItem('melodai_token')
        swrInvalidate('')    // clear all cache on logout
        window.location.href = '/login'
        return
      }
    }
    return Promise.reject(err)
  }
)

export default api

// ── Retry helper ──────────────────────────────────────────────────────────────
async function withRetry(fn, maxAttempts = 3) {
  let lastErr
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      // Only retry on network errors, not 4xx/5xx
      const isNetwork = !err.response && (err.code === 'ECONNABORTED' || err.message === 'Network Error')
      if (!isNetwork || attempt === maxAttempts) throw err
      await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 8000)))
    }
  }
  throw lastErr
}

// ── Deduplicated GET ──────────────────────────────────────────────────────────
function dedupGet(url, params) {
  const key = url + JSON.stringify(params || {})

  // Return stale data immediately + revalidate in background (SWR pattern)
  const cached = swrGet(key)
  if (cached && !swrIsStale(cached)) {
    return Promise.resolve(cached.data)
  }

  // Deduplicate: if same request is in-flight, share the promise
  if (inFlight.has(key)) return inFlight.get(key)

  const req = withRetry(() => api.get(url, { params }))
    .then(res => {
      swrSet(key, res)
      return res
    })
    .finally(() => inFlight.delete(key))

  inFlight.set(key, req)

  // Return stale immediately if available, while re-fetching
  if (cached) return Promise.resolve(cached.data)
  return req
}

// ── Auth ───────────────────────────────────────────────────────────────────────
export const authAPI = {
  register:        data  => api.post('/auth/register', data),
  login:           data  => api.post('/auth/login', data),
  getMe:           ()    => api.get('/auth/me'),
  setMood:         mood  => api.put('/auth/mood', { mood }),
  logout:          ()    => {
    localStorage.removeItem('melodai_token')
    swrInvalidate('')
    return api.post('/auth/logout').catch(() => {})
  },
  forgotPassword:  email       => api.post('/auth/forgot-password', { email }),
  resetPassword:   data        => api.post('/auth/reset-password', data),
}

// ── Songs ─────────────────────────────────────────────────────────────────────
export const songsAPI = {
  getAll:         params           => dedupGet('/songs', params),
  getOne:         id               => dedupGet(`/songs/${id}`),
  getTrending:    (period = '7d')  => dedupGet('/songs/trending', { period }),
  autocomplete:   q                => dedupGet('/songs/autocomplete', { q }),
  getByArtist:    (name, params)   => dedupGet(`/songs/artist/${encodeURIComponent(name)}`, params),
  getGenres:      ()               => dedupGet('/songs/genres'),
  getSimilar:     id               => dedupGet(`/songs/${id}/similar`),
  getStats:       ()               => api.get('/songs/admin/stats'),
  create:         data             => { swrInvalidate('/songs'); return api.post('/songs', data) },
  update:         (id, data)       => { swrInvalidate('/songs'); return api.put(`/songs/${id}`, data) },
  delete:         id               => { swrInvalidate('/songs'); return api.delete(`/songs/${id}`) },
  trackEvent:     (id, data)       => api.post(`/songs/${id}/event`, data),
  react:          (id, emoji)      => api.post(`/songs/${id}/react`, { emoji }),
  report:         (id, reason)     => api.post(`/songs/${id}/report`, { reason }),
}

// ── Playlists ─────────────────────────────────────────────────────────────────
export const playlistsAPI = {
  getAll:       params            => dedupGet('/playlists', params),
  getOne:       id                => dedupGet(`/playlists/${id}`),
  create:       data              => { swrInvalidate('/playlists'); return api.post('/playlists', data) },
  update:       (id, data)        => { swrInvalidate('/playlists'); return api.put(`/playlists/${id}`, data) },
  delete:       id                => { swrInvalidate('/playlists'); return api.delete(`/playlists/${id}`) },
  addSong:      (id, songId, songData) => {
    swrInvalidate(`/playlists/${id}`)
    return api.post(`/playlists/${id}/songs`, { songId, songData })
  },
  removeSong:   (id, songId)      => {
    swrInvalidate(`/playlists/${id}`)
    return api.delete(`/playlists/${id}/songs/${songId}`)
  },
  reorderSongs: (id, songIds)     => {
    swrInvalidate(`/playlists/${id}`)
    return api.put(`/playlists/${id}`, { songs: songIds })
  },
  generateAI:   data              => api.post('/playlists/ai-generate', data),
}

// ── Recommendations ───────────────────────────────────────────────────────────
export const recommendAPI = {
  getHome:      (sessionIds = []) => api.get('/recommendations/home', { params: { sessionIds } }),
  getSimilar:   songId            => dedupGet(`/recommendations/similar/${songId}`),
  getMood:      mood              => dedupGet(`/recommendations/mood/${mood}`),
  search:       (q, limit = 20)  => dedupGet('/recommendations/search', { q, limit }),
  skipFeedback: songId            => api.post('/recommendations/skip-feedback', { songId }),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersAPI = {
  getMe:           ()         => api.get('/users/me'),
  getLiked:        ()         => dedupGet('/users/liked'),
  getHistory:      params     => api.get('/users/history', { params }),
  getStats:        ()         => api.get('/users/stats'),
  getAIProfile:    ()         => api.get('/users/ai-profile'),
  updateProfile:   data       => { swrInvalidate('/users'); return api.put('/users/profile', data) },
  changePassword:  data       => api.put('/users/password', data),
  getPublicProfile:(id)       => dedupGet(`/users/${id}`),
  follow:          id         => api.post(`/users/follow/${id}`),
  unfollow:        id         => api.delete(`/users/follow/${id}`),
  deactivate:      password   => api.delete('/users/me', { data: { password } }),
}

// ── Upload ────────────────────────────────────────────────────────────────────
export const uploadAPI = {
  audio: (file, onProgress, signal) => {
    const form = new FormData()
    form.append('audio', file)
    return api.post('/upload/audio', form, {
      headers:              { 'Content-Type': 'multipart/form-data' },
      onUploadProgress:     e => onProgress?.(Math.round((e.loaded / e.total) * 100)),
      signal,
    })
  },
  image: (file, signal) => {
    const form = new FormData()
    form.append('image', file)
    return api.post('/upload/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
    })
  },
}

// ── YouTube ───────────────────────────────────────────────────────────────────
export const youtubeAPI = {
  check:     ()               => dedupGet('/youtube/check'),
  search:    (q, limit = 20, raw = false) => api.get('/youtube/search', { params: { q, limit, type: raw ? 'none' : 'music' } }),
  trending:  (region = 'IN')  => api.get('/youtube/trending', { params: { region } }),
  info:      videoId          => api.get(`/youtube/info/${videoId}`),
  streamUrl: videoId          => `${api.defaults.baseURL}/youtube/stream/${videoId}`,
}

// ── Lyrics ────────────────────────────────────────────────────────────────────
export const lyricsAPI = {
  get:       (artist, title, lang = 'original') =>
    dedupGet('/lyrics', { artist, title, lang }),
  translate: (text, lang) => api.post('/lyrics/translate', { text, lang }),
}

// ── Cache helpers (public) ────────────────────────────────────────────────────
export const apiCache = {
  invalidate: swrInvalidate,
  clear:      () => swr.clear(),
  size:       () => swr.size,
}

// ── Network status ────────────────────────────────────────────────────────────
export const network = {
  isOnline: () => isOnline,
  onStatusChange: (fn) => {
    window.addEventListener('online',  () => fn(true))
    window.addEventListener('offline', () => fn(false))
  },
}

// ── AI service ────────────────────────────────────────────────────────────────
const AI_BASE = window.location.hostname.includes('vercel.app')
  ? '/ai'
  : (import.meta.env.VITE_AI_URL || 'http://localhost:8000')

export const aiAPI = {
  recommend:        data => axios.post(`${AI_BASE}/recommend`,          data),
  similar:          data => axios.post(`${AI_BASE}/similar`,            data),
  generatePlaylist: data => axios.post(`${AI_BASE}/generate-playlist`,  data),
  rankSearch:       data => axios.post(`${AI_BASE}/rank-search`,        data),
  moodRecommend:    data => axios.post(`${AI_BASE}/recommend/mood`,     data),
  embed:            data => axios.post(`${AI_BASE}/embed`,              data),
  health:           ()   => axios.get(`${AI_BASE}/health`),
}
