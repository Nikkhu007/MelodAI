/**
 * playerStore — v4
 *
 * FIXES:
 *  1. crossfadeSecs now defaults to 0 (OFF) — was 4, causing audio disappear
 *     because audioB had no Web Audio API connection
 *  2. Single audio element (no crossfade swap) — AudioVisualizer connects
 *     once to this element and stays connected permanently
 *  3. Crossfade implemented via volume ramp on the SAME element (fade out
 *     then fade in) — safe for Web Audio API
 *  4. get audio() getter removed — replaced with plain audioEl export so
 *     AudioVisualizer can get a stable reference that never changes
 */
import { create } from 'zustand'
import { songsAPI } from '../services/api'

// ── Single stable audio element ───────────────────────────────────────────────
// IMPORTANT: Using ONE element fixes the AudioVisualizer disconnect bug.
// Crossfade is done via volume ramping, not element swapping.
export const audioEl = typeof window !== 'undefined' ? new Audio() : null

const usePlayerStore = create((set, get) => ({
  // ── Playback state ────────────────────────────────────────────────────────
  currentSong:   null,
  queue:         [],
  queueIndex:    -1,
  isPlaying:     false,
  volume:        0.8,
  isMuted:       false,
  currentTime:   0,
  duration:      0,
  buffered:      0,
  isShuffled:    false,
  repeatMode:    'none',
  isLoading:     false,
  playbackSpeed: 1.0,
  crossfadeSecs: 0,       // DEFAULT OFF — set to 2-8 in player settings
  dominantColor: null,

  // ── UI state ─────────────────────────────────────────────────────────────
  playerMode: 'bar',
  showLyrics: false,
  showQueue:  false,

  // ── playSong ──────────────────────────────────────────────────────────────
  playSong: (song, queue = []) => {
    if (!song?.audioUrl) return
    const { currentSong, reportEvent, volume, isMuted,
            playbackSpeed, crossfadeSecs } = get()

    if (currentSong?._id === song._id) { get().togglePlay(); return }
    if (currentSong) reportEvent(currentSong._id, 'skip')

    const newQueue = queue.length ? queue : [song]
    const idx      = newQueue.findIndex(s => s._id === song._id)

    set({
      currentSong: song,
      queue:       newQueue,
      queueIndex:  idx >= 0 ? idx : 0,
      isLoading:   true,
      currentTime: 0,
      duration:    0,
      buffered:    0,
      dominantColor: null,
    })

    const effectiveVolume = isMuted ? 0 : volume

    if (crossfadeSecs > 0 && currentSong && !audioEl.paused) {
      // Volume-ramp crossfade on the SAME audio element
      // Fade out current song over half the crossfade time,
      // then swap src and fade back in
      const halfMs    = (crossfadeSecs * 1000) / 2
      const steps     = 20
      const interval  = halfMs / steps
      let   step      = 0

      const fadeOut = setInterval(() => {
        step++
        audioEl.volume = Math.max(0, effectiveVolume * (1 - step / steps))
        if (step >= steps) {
          clearInterval(fadeOut)
          // Swap src and fade in
          audioEl.src    = song.audioUrl
          audioEl.playbackRate = playbackSpeed
          audioEl.load()
          audioEl.play().catch(() => {})

          let stepIn = 0
          const fadeIn = setInterval(() => {
            stepIn++
            audioEl.volume = Math.min(effectiveVolume, effectiveVolume * (stepIn / steps))
            if (stepIn >= steps) {
              clearInterval(fadeIn)
              audioEl.volume = effectiveVolume
            }
          }, interval)
        }
      }, interval)
    } else {
      // Direct play — no crossfade
      audioEl.src          = song.audioUrl
      audioEl.volume       = effectiveVolume
      audioEl.playbackRate = playbackSpeed
      audioEl.load()
      audioEl.play()
        .then(() => {
          set({ isPlaying: true, isLoading: false })
          reportEvent(song._id, 'play')
          get()._extractColor(song.coverUrl)
        })
        .catch(err => {
          console.error('[Player] Playback error:', err.message)
          set({ isPlaying: false, isLoading: false })
        })
    }
  },

  togglePlay: () => {
    const { isPlaying, currentSong } = get()
    if (!audioEl || !currentSong) return
    if (isPlaying) {
      audioEl.pause()
      set({ isPlaying: false })
    } else {
      audioEl.play()
        .then(() => set({ isPlaying: true }))
        .catch(err => console.error('[Player] Resume error:', err.message))
    }
  },

  next: () => {
    const { queue, queueIndex, isShuffled, repeatMode, playSong, reportEvent, currentSong } = get()
    if (!queue.length) return
    if (currentSong) reportEvent(currentSong._id, 'complete')

    let nextIdx
    if (repeatMode === 'one')    nextIdx = queueIndex
    else if (isShuffled)         nextIdx = Math.floor(Math.random() * queue.length)
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
    const { queue, queueIndex, playSong, currentTime } = get()
    if (currentTime > 3) {
      audioEl.currentTime = 0
      set({ currentTime: 0 })
      return
    }
    const prevIdx = Math.max(0, queueIndex - 1)
    if (queue[prevIdx]) playSong(queue[prevIdx], queue)
  },

  seek: (time) => {
    if (!audioEl) return
    audioEl.currentTime = time
    set({ currentTime: time })
  },

  setVolume: (vol) => {
    const v = Math.max(0, Math.min(1, vol))
    if (audioEl) audioEl.volume = v
    set({ volume: v, isMuted: v === 0 })
  },

  toggleMute: () => {
    const { isMuted, volume } = get()
    const newMuted = !isMuted
    if (audioEl) audioEl.volume = newMuted ? 0 : volume
    set({ isMuted: newMuted })
  },

  setPlaybackSpeed: (speed) => {
    if (audioEl) audioEl.playbackRate = speed
    set({ playbackSpeed: speed })
  },

  setCrossfade:   (secs)  => set({ crossfadeSecs: secs }),
  toggleShuffle:  ()      => set(s => ({ isShuffled: !s.isShuffled })),
  cycleRepeat:    ()      => set(s => ({
    repeatMode: s.repeatMode === 'none' ? 'all' : s.repeatMode === 'all' ? 'one' : 'none',
  })),

  addToQueue:     (song)  => set(s => ({ queue: [...s.queue, song] })),
  removeFromQueue:(idx)   => set(s => ({ queue: s.queue.filter((_,i) => i !== idx) })),
  clearQueue:     ()      => set({ queue: [], queueIndex: -1 }),

  setPlayerMode:  (mode)  => set({ playerMode: mode }),
  toggleLyrics:   ()      => set(s => ({ showLyrics: !s.showLyrics })),
  toggleQueue:    ()      => set(s => ({ showQueue:  !s.showQueue  })),

  // ── Album color extraction ─────────────────────────────────────────────────
  _extractColor: async (coverUrl) => {
    if (!coverUrl) return
    try {
      const { extractDominantColor } = await import('../utils/colorExtract.js')
      const color = await extractDominantColor(coverUrl)
      if (color) set({ dominantColor: color })
    } catch {}
  },

  // ── Behavior tracking ──────────────────────────────────────────────────────
  reportEvent: (songId, event) => {
    const token = localStorage.getItem('melodai_token')
    if (!token || !songId) return
    if (String(songId).startsWith('yt_') || String(songId).startsWith('jamendo_')) return
    const { currentTime, duration } = get()
    songsAPI.trackEvent(songId, {
      event,
      progress:       duration > 0 ? currentTime / duration : 0,
      listenDuration: currentTime,
      source:         'player',
    }).catch(() => {})

    // Real-time skip feedback to AI
    if (event === 'skip') {
      import('../services/api').then(m => {
        m.recommendAPI?.skipFeedback?.(songId).catch(() => {})
      }).catch(() => {})
    }
  },

  // ── Setup audio listeners (called once at app start) ───────────────────────
  setupAudioListeners: () => {
    if (!audioEl) return

    audioEl.addEventListener('timeupdate', () => {
      set({ currentTime: audioEl.currentTime })
      if (audioEl.buffered.length > 0 && audioEl.duration > 0) {
        set({ buffered: Math.min(audioEl.buffered.end(audioEl.buffered.length - 1) / audioEl.duration, 1) })
      }
    })

    audioEl.addEventListener('loadedmetadata', () => {
      set({ duration: audioEl.duration, isLoading: false })
    })

    audioEl.addEventListener('canplay', () => {
      set({ isLoading: false })
    })

    audioEl.addEventListener('ended', () => {
      get().next()
    })

    audioEl.addEventListener('waiting',  () => set({ isLoading: true  }))
    audioEl.addEventListener('playing',  () => {
      const { currentSong, reportEvent } = get()
      set({ isLoading: false, isPlaying: true })
      if (currentSong) {
        reportEvent(currentSong._id, 'play')
        get()._extractColor(currentSong.coverUrl)
      }
    })
    audioEl.addEventListener('pause',    () => set({ isPlaying: false }))
    audioEl.addEventListener('error',    () => set({ isLoading: false, isPlaying: false }))

    // Keyboard shortcuts (playback only)
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const { currentSong, togglePlay, next, prev, seek, currentTime, duration, setVolume, volume } = get()
      if (!currentSong) return
      switch (e.code) {
        case 'Space':      e.preventDefault(); togglePlay(); break
        case 'ArrowRight': e.preventDefault(); seek(Math.min(currentTime + (e.shiftKey ? 30 : 10), duration)); break
        case 'ArrowLeft':  e.preventDefault(); seek(Math.max(currentTime - (e.shiftKey ? 30 : 10), 0)); break
        case 'ArrowUp':    e.preventDefault(); setVolume(Math.min(volume + 0.1, 1)); break
        case 'ArrowDown':  e.preventDefault(); setVolume(Math.max(volume - 0.1, 0)); break
        case 'KeyN':       next(); break
        case 'KeyP':       prev(); break
      }
    })

    // Media Session API (OS media controls, lock screen, browser tab)
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play',          () => get().togglePlay())
      navigator.mediaSession.setActionHandler('pause',         () => get().togglePlay())
      navigator.mediaSession.setActionHandler('nexttrack',     () => get().next())
      navigator.mediaSession.setActionHandler('previoustrack', () => get().prev())
      navigator.mediaSession.setActionHandler('seekbackward',  () => get().seek(Math.max(get().currentTime - 10, 0)))
      navigator.mediaSession.setActionHandler('seekforward',   () => get().seek(Math.min(get().currentTime + 10, get().duration)))
    }
  },

  // Update OS lock screen / browser media metadata
  updateMediaSession: (song) => {
    if (!song || !('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title:   song.title  || 'Unknown',
      artist:  song.artist || 'Unknown',
      album:   song.album  || 'MelodAI',
      artwork: song.coverUrl
        ? [{ src: song.coverUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    })
  },
}))

export default usePlayerStore
