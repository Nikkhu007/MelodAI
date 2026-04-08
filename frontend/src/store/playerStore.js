import { create } from 'zustand'
import { songsAPI } from '../services/api'

const usePlayerStore = create((set, get) => ({
  // Playback state
  currentSong: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  volume: 0.8,
  isMuted: false,
  currentTime: 0,
  duration: 0,
  isShuffled: false,
  repeatMode: 'none', // 'none' | 'one' | 'all'
  isLoading: false,

  // The HTML5 Audio element (created once)
  audio: typeof window !== 'undefined' ? new Audio() : null,

  // ── Core Controls ──────────────────────────────────────────────────────

  playSong: (song, queue = []) => {
    const { audio, currentSong, reportEvent } = get()
    if (!audio) return

    // If same song is already loaded, just toggle play
    if (currentSong?._id === song._id) {
      get().togglePlay()
      return
    }

    // Report end of previous song
    if (currentSong) reportEvent(currentSong._id, 'skip')

    const newQueue = queue.length ? queue : [song]
    const idx = newQueue.findIndex((s) => s._id === song._id)

    audio.src = song.audioUrl
    audio.volume = get().isMuted ? 0 : get().volume
    audio.load()

    set({ currentSong: song, queue: newQueue, queueIndex: idx >= 0 ? idx : 0, isLoading: true, currentTime: 0 })

    audio.play().then(() => {
      set({ isPlaying: true, isLoading: false })
      reportEvent(song._id, 'play')
    }).catch((err) => {
      console.error('Playback error:', err)
      set({ isPlaying: false, isLoading: false })
    })
  },

  togglePlay: () => {
    const { audio, isPlaying, currentSong } = get()
    if (!audio || !currentSong) return
    if (isPlaying) {
      audio.pause()
      set({ isPlaying: false })
    } else {
      audio.play()
      set({ isPlaying: true })
    }
  },

  next: () => {
    const { queue, queueIndex, isShuffled, repeatMode, playSong, reportEvent, currentSong } = get()
    if (!queue.length) return
    if (currentSong) reportEvent(currentSong._id, 'complete')

    let nextIdx
    if (repeatMode === 'one') {
      nextIdx = queueIndex
    } else if (isShuffled) {
      nextIdx = Math.floor(Math.random() * queue.length)
    } else {
      nextIdx = queueIndex + 1
      if (nextIdx >= queue.length) {
        if (repeatMode === 'all') nextIdx = 0
        else { set({ isPlaying: false }); return }
      }
    }
    playSong(queue[nextIdx], queue)
  },

  prev: () => {
    const { audio, queue, queueIndex, playSong, currentTime } = get()
    // If > 3s in, restart current song
    if (currentTime > 3) {
      audio.currentTime = 0
      set({ currentTime: 0 })
      return
    }
    const prevIdx = Math.max(0, queueIndex - 1)
    if (queue[prevIdx]) playSong(queue[prevIdx], queue)
  },

  seek: (time) => {
    const { audio } = get()
    if (!audio) return
    audio.currentTime = time
    set({ currentTime: time })
  },

  setVolume: (vol) => {
    const { audio } = get()
    if (audio) audio.volume = vol
    set({ volume: vol, isMuted: vol === 0 })
  },

  toggleMute: () => {
    const { audio, isMuted, volume } = get()
    if (!audio) return
    const newMuted = !isMuted
    audio.volume = newMuted ? 0 : volume
    set({ isMuted: newMuted })
  },

  toggleShuffle: () => set((s) => ({ isShuffled: !s.isShuffled })),

  cycleRepeat: () =>
    set((s) => ({
      repeatMode: s.repeatMode === 'none' ? 'all' : s.repeatMode === 'all' ? 'one' : 'none',
    })),

  addToQueue: (song) =>
    set((s) => ({ queue: [...s.queue, song] })),

  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setIsPlaying: (v) => set({ isPlaying: v }),

  // ── Behavior tracking ──────────────────────────────────────────────────
  reportEvent: (songId, event) => {
    const token = localStorage.getItem('melodai_token')
    // Skip tracking for iTunes preview songs (id starts with 'itunes_')
    if (!token || !songId || String(songId).startsWith('itunes_')) return
    const { currentTime } = get()
    songsAPI.trackEvent(songId, {
      event,
      progress: get().duration > 0 ? currentTime / get().duration : 0,
      listenDuration: currentTime,
      source: 'player',
    }).catch(() => {}) // fire and forget
  },

  // ── Audio event setup (call once after mount) ──────────────────────────
  setupAudioListeners: () => {
    const { audio } = get()
    if (!audio) return

    audio.addEventListener('timeupdate', () => {
      set({ currentTime: audio.currentTime })
    })
    audio.addEventListener('loadedmetadata', () => {
      set({ duration: audio.duration, isLoading: false })
    })
    audio.addEventListener('ended', () => {
      get().next()
    })
    audio.addEventListener('waiting', () => set({ isLoading: true }))
    audio.addEventListener('playing', () => set({ isLoading: false }))
    audio.addEventListener('error', () => set({ isLoading: false, isPlaying: false }))
  },
}))

export default usePlayerStore
