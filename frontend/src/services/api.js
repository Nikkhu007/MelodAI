import axios from 'axios'

const api = axios.create({
baseURL: "https://melodai-1.onrender.com",
  timeout: 15000,
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('melodai_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('melodai_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ── Auth ───────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  setMood: (mood) => api.put('/auth/mood', { mood }),
}

// ── Songs ──────────────────────────────────────────────────────────────────
export const songsAPI = {
  getAll: (params) => api.get('/songs', { params }),
  getOne: (id) => api.get(`/songs/${id}`),
  create: (data) => api.post('/songs', data),
  update: (id, data) => api.put(`/songs/${id}`, data),
  delete: (id) => api.delete(`/songs/${id}`),
  trackEvent: (id, data) => api.post(`/songs/${id}/event`, data),
  getTrending: () => api.get('/songs/trending'),
}

// ── Playlists ──────────────────────────────────────────────────────────────
export const playlistsAPI = {
  getAll: (params) => api.get('/playlists', { params }),
  getOne: (id) => api.get(`/playlists/${id}`),
  create: (data) => api.post('/playlists', data),
  update: (id, data) => api.put(`/playlists/${id}`, data),
  delete: (id) => api.delete(`/playlists/${id}`),
  addSong: (id, songId) => api.post(`/playlists/${id}/songs`, { songId }),
  removeSong: (id, songId) => api.delete(`/playlists/${id}/songs/${songId}`),
  generateAI: (data) => api.post('/playlists/ai-generate', data),
}

// ── Recommendations ────────────────────────────────────────────────────────
export const recommendAPI = {
  getHome: () => api.get('/recommendations/home'),
  getSimilar: (songId) => api.get(`/recommendations/similar/${songId}`),
  getMood: (mood) => api.get(`/recommendations/mood/${mood}`),
  search: (q, limit = 20) => api.get('/recommendations/search', { params: { q, limit } }),
}

// ── Users ──────────────────────────────────────────────────────────────────
export const usersAPI = {
  getLiked: () => api.get('/users/liked'),
  getHistory: () => api.get('/users/history'),
  updateProfile: (data) => api.put('/users/profile', data),
}

// ── Upload ─────────────────────────────────────────────────────────────────
export const uploadAPI = {
  audio: (file, onProgress) => {
    const form = new FormData()
    form.append('audio', file)
    return api.post('/upload/audio', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded / e.total) * 100)),
    })
  },
  image: (file) => {
    const form = new FormData()
    form.append('image', file)
    return api.post('/upload/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// ── YouTube (yt-dlp, local only) ───────────────────────────────────────────
export const youtubeAPI = {
  check:    ()              => api.get('/youtube/check'),
  search:   (q, limit = 20) => api.get('/youtube/search', { params: { q, limit } }),
  trending: (region = 'IN') => api.get('/youtube/trending', { params: { region } }),
  info:     (videoId)       => api.get(`/youtube/info/${videoId}`),
  // Stream URL — backend redirects to YouTube CDN
  streamUrl: (videoId)      => `${api.defaults.baseURL}/youtube/stream/${videoId}`,
}
