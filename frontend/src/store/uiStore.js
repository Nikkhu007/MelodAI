import { create } from 'zustand'

// Persist theme to localStorage
const savedTheme = typeof window !== 'undefined' ? localStorage.getItem('melodai_theme') || 'dark' : 'dark'

const useUIStore = create((set, get) => ({
  sidebarOpen: true,
  theme: savedTheme,
  toasts: [],
  modals: {
    addToPlaylist: false,
    createPlaylist: false,
    uploadSong: false,
    moodPicker: false,
    shareModal: false,
    queuePanel: false,
  },
  selectedSongForPlaylist: null,
  selectedSongForShare: null,

  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('melodai_theme', newTheme)
    document.documentElement.classList.toggle('light', newTheme === 'light')
    set({ theme: newTheme })
  },

  openModal: (name, data = {}) => set(s => ({
    modals: { ...s.modals, [name]: true },
    ...data,
  })),
  closeModal: (name) => set(s => ({ modals: { ...s.modals, [name]: false } })),
  closeAllModals: () => set(s => ({
    modals: Object.fromEntries(Object.keys(s.modals).map(k => [k, false])),
  })),

  toast: (message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random()
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), duration)
  },
}))

export default useUIStore
