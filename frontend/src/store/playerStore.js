import { create } from 'zustand'
import { songsAPI } from '../services/api'

const usePlayerStore = create((set, get) => ({
  // ── Playback state ──────────────────────────────────────────────────────
  currentSong:  null,
  queue:        [],
  queueIndex:   -1,
  isPlaying:    false,
  volume:       0.8,
  isMuted:      false,
  currentTime:  0,
  duration:     0,
  buffered:     0,        // buffered progress 0-1
  isShuffled:   false,
  repeatMode:   'none',   // 'none' | 'one' | 'all'
  isLoading:    false,
  playbackSpeed: 1.0,

  // ── UI state ────────────────────────────────────────────────────────────
  playerMode:    'bar',   // 'bar' | 'full' | 'mini'
  showLyrics:    false,
  showQueue:     false,

  audio: typeof window !== 'undefined' ? new Audio() : null,

  // ── Core controls ────────────────────────────────────────────────────────

  playSong: (song, queue = []) => {
    const { audio, currentSong, reportEvent } = get()
    if (!audio) return

    if (currentSong?._id === song._id) {
      get().togglePlay()
      return
    }

    if (currentSong) reportEvent(currentSong._id, 'skip')

    const newQueue = queue.length ? queue : [song]
    const idx = newQueue.findIndex(s => s._id === song._id)

    audio.src = song.audioUrl
    audio.volume = get().isMuted ? 0 : get().volume
    audio.playbackRate = get().playbackSpeed
    audio.load()

    set({
      currentSong: song,
      queue: newQueue,
      queueIndex: idx >= 0 ? idx : 0,
      isLoading: true,
      currentTime: 0,
      duration: 0,
      buffered: 0,
    })

    audio.play()
      .then(() => { set({ isPlaying: true, isLoading: false }); reportEvent(song._id, 'play') })
      .catch(err => { console.error('Playback error:', err); set({ isPlaying: false, isLoading: false }) })
  },

  togglePlay: () => {
    const { audio, isPlaying, currentSong } = get()
    if (!audio || !currentSong) return
    if (isPlaying) { audio.pause(); set({ isPlaying: false }) }
    else { audio.play(); set({ isPlaying: true }) }
  },

  next: () => {
    const { queue, queueIndex, isShuffled, repeatMode, playSong, reportEvent, currentSong } = get()
    if (!queue.length) return
    if (currentSong) reportEvent(currentSong._id, 'complete')

    let nextIdx
    if (repeatMode === 'one') nextIdx = queueIndex
    else if (isShuffled) nextIdx = Math.floor(Math.random() * queue.length)
    else {
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
    if (currentTime > 3) { audio.currentTime = 0; set({ currentTime: 0 }); return }
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

  setPlaybackSpeed: (speed) => {
    const { audio } = get()
    if (audio) audio.playbackRate = speed
    set({ playbackSpeed: speed })
  },

  toggleShuffle: () => set(s => ({ isShuffled: !s.isShuffled })),

  cycleRepeat: () => set(s => ({
    repeatMode: s.repeatMode === 'none' ? 'all' : s.repeatMode === 'all' ? 'one' : 'none',
  })),

  addToQueue: (song) => set(s => ({ queue: [...s.queue, song] })),
  removeFromQueue: (idx) => set(s => ({ queue: s.queue.filter((_, i) => i !== idx) })),
  clearQueue: () => set({ queue: [], queueIndex: -1 }),
  reorderQueue: (from, to) => set(s => {
    const q = [...s.queue]
    const [item] = q.splice(from, 1)
    q.splice(to, 0, item)
    return { queue: q }
  }),

  setPlayerMode: (mode) => set({ playerMode: mode }),
  toggleLyrics: () => set(s => ({ showLyrics: !s.showLyrics })),
  toggleQueue: () => set(s => ({ showQueue: !s.showQueue })),

  // ── Internals (set by audio listeners) ──────────────────────────────────
  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setBuffered: (b) => set({ buffered: b }),
  setIsPlaying: (v) => set({ isPlaying: v }),

  // ── Behavior tracking ────────────────────────────────────────────────────
  reportEvent: (songId, event) => {
    const token = localStorage.getItem('melodai_token')
    if (!token || !songId) return
    if (String(songId).startsWith('itunes_') || String(songId).startsWith('yt_') || String(songId).startsWith('jamendo_')) return
    const { currentTime, duration } = get()
    songsAPI.trackEvent(songId, {
      event,
      progress: duration > 0 ? currentTime / duration : 0,
      listenDuration: currentTime,
      source: 'player',
    }).catch(() => {})
  },

  // ── Audio listeners (call once at app startup) ───────────────────────────
  setupAudioListeners: () => {
    const { audio } = get()
    if (!audio) return

    audio.addEventListener('timeupdate', () => {
      set({ currentTime: audio.currentTime })
      // Update buffered progress
      if (audio.buffered.length > 0 && audio.duration > 0) {
        const buf = audio.buffered.end(audio.buffered.length - 1) / audio.duration
        set({ buffered: Math.min(buf, 1) })
      }
    })
    audio.addEventListener('loadedmetadata', () => set({ duration: audio.duration, isLoading: false }))
    audio.addEventListener('ended', () => get().next())
    audio.addEventListener('waiting', () => set({ isLoading: true }))
    audio.addEventListener('playing', () => set({ isLoading: false, isPlaying: true }))
    audio.addEventListener('pause', () => set({ isPlaying: false }))
    audio.addEventListener('error', (e) => {
      console.error('Audio error:', e)
      set({ isLoading: false, isPlaying: false })
    })

    // ── Keyboard shortcuts ──────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
      // Don't intercept when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const { currentSong, togglePlay, next, prev, seek, currentTime, duration, setVolume, volume } = get()
      if (!currentSong) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowRight':
          e.preventDefault()
          seek(Math.min(currentTime + (e.shiftKey ? 30 : 10), duration))
          break
        case 'ArrowLeft':
          e.preventDefault()
          seek(Math.max(currentTime - (e.shiftKey ? 30 : 10), 0))
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(Math.min(volume + 0.1, 1))
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(Math.max(volume - 0.1, 0))
          break
        case 'KeyN':
          next()
          break
        case 'KeyP':
          prev()
          break
      }
    })
  },
}))

export default usePlayerStore
