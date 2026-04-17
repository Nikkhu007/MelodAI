import { create } from 'zustand'
import { authAPI } from '../services/api'

const savedEmail = localStorage.getItem('melodai_remembered_email') || ''

// Extract the best error message from any axios error response shape
function getErrMsg(err, fallback) {
  // Network Error = backend not running or CORS issue
  if (!err.response) {
    if (err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
      return 'Cannot connect to server — make sure the backend is running (check run.py)'
    }
    return err.message || fallback
  }
  const data = err.response.data
  if (!data) return fallback
  // Backend may return:  { message: "..." }
  //                  or  { errors: [{ message: "..." }] }
  if (data.errors?.length) return data.errors[0].message
  if (data.message) return data.message
  return fallback
}

const useAuthStore = create((set, get) => ({
  user:        null,
  token:       localStorage.getItem('melodai_token') || null,
  loading:     false,
  initialized: false,
  savedEmail,

  initialize: async () => {
    const token = localStorage.getItem('melodai_token')
    if (!token) return set({ initialized: true })
    try {
      const { data } = await authAPI.getMe()
      set({ user: data.user, token, initialized: true })
    } catch {
      localStorage.removeItem('melodai_token')
      set({ user: null, token: null, initialized: true })
    }
  },

  login: async (email, password, remember = false) => {
    set({ loading: true })
    try {
      const { data } = await authAPI.login({ email, password })
      localStorage.setItem('melodai_token', data.token)
      if (remember) localStorage.setItem('melodai_remembered_email', email)
      else          localStorage.removeItem('melodai_remembered_email')
      set({ user: data.user, token: data.token, loading: false, savedEmail: remember ? email : '' })
      return { success: true }
    } catch (err) {
      set({ loading: false })
      return { success: false, message: getErrMsg(err, 'Invalid email or password') }
    }
  },

  register: async (username, email, password) => {
    set({ loading: true })
    try {
      const { data } = await authAPI.register({ username, email, password })
      localStorage.setItem('melodai_token', data.token)
      set({ user: data.user, token: data.token, loading: false })
      return { success: true }
    } catch (err) {
      set({ loading: false })
      return { success: false, message: getErrMsg(err, 'Registration failed') }
    }
  },

  logout: () => {
    localStorage.removeItem('melodai_token')
    set({ user: null, token: null })
  },

  setMood: async (mood) => {
    try {
      await authAPI.setMood(mood)
      set(s => ({ user: { ...s.user, currentMood: mood } }))
    } catch {}
  },

  updateUser: (updates) => set(s => ({ user: { ...s.user, ...updates } })),
  isLoggedIn: () => !!get().token,
}))

export default useAuthStore
