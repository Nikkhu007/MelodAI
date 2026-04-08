import { create } from 'zustand'

const useUIStore = create((set, get) => ({
  sidebarOpen: true,
  toasts: [],
  modals: {
    addToPlaylist: false,
    createPlaylist: false,
    uploadSong: false,
    moodPicker: false,
  },
  selectedSongForPlaylist: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  openModal: (name, data = {}) => set((s) => ({
    modals: { ...s.modals, [name]: true },
    ...data,
  })),
  closeModal: (name) => set((s) => ({
    modals: { ...s.modals, [name]: false },
  })),

  toast: (message, type = 'success', duration = 3000) => {
    const id = Date.now()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, duration)
  },
}))

export default useUIStore
