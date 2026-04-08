import { create } from 'zustand'
import { authAPI } from '../services/api'

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('melodai_token') || null,
  loading: false,
  initialized: false,

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

  login: async (email, password) => {
    set({ loading: true })
    try {
      const { data } = await authAPI.login({ email, password })
      localStorage.setItem('melodai_token', data.token)
      set({ user: data.user, token: data.token, loading: false })
      return { success: true }
    } catch (err) {
      set({ loading: false })
      return { success: false, message: err.response?.data?.message || 'Login failed' }
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
      return { success: false, message: err.response?.data?.message || 'Registration failed' }
    }
  },

  logout: () => {
    localStorage.removeItem('melodai_token')
    set({ user: null, token: null })
  },

  setMood: async (mood) => {
    try {
      await authAPI.setMood(mood)
      set((state) => ({ user: { ...state.user, currentMood: mood } }))
    } catch (err) {
      console.error('Set mood failed:', err)
    }
  },

  updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),

  isLoggedIn: () => !!get().token,
}))

export default useAuthStore
