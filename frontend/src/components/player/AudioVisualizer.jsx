/**
 * AudioVisualizer — fixed v2
 *
 * FIXES:
 *  - Now imports `audioEl` directly (the single stable Audio element)
 *    instead of getting it from the store via a getter that could return
 *    different elements after crossfade
 *  - `createMediaElementSource` is only called once per page load
 *    (the `connected` flag ensures this)
 *  - No more audio disappearing when panel opens/closes
 */
import { useEffect, useRef } from 'react'
import usePlayerStore from '../../store/playerStore'
import { audioEl } from '../../store/playerStore'

let audioCtx   = null
let analyser   = null
let connected  = false

function connect() {
  if (connected || !audioEl) return
  try {
    audioCtx  = new (window.AudioContext || window.webkitAudioContext)()
    analyser  = audioCtx.createAnalyser()
    analyser.fftSize             = 64
    analyser.smoothingTimeConstant = 0.8

    const source = audioCtx.createMediaElementSource(audioEl)
    source.connect(analyser)
    analyser.connect(audioCtx.destination)
    connected = true
  } catch (err) {
    console.warn('[Visualizer] Could not connect Web Audio API:', err.message)
  }
}

export default function AudioVisualizer({ className = '', barCount = 28, color = '#6c47ff' }) {
  const { isPlaying } = usePlayerStore()
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)

  useEffect(() => {
    // Resume audio context on first user interaction (browser autoplay policy)
    const resume = () => {
      if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {})
    }
    document.addEventListener('click', resume, { once: true })
    return () => document.removeEventListener('click', resume)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Connect once
    connect()
    if (!analyser) return

    const ctx         = canvas.getContext('2d')
    const bufferLen   = analyser.frequencyBinCount
    const dataArray   = new Uint8Array(bufferLen)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)

      const dpr = window.devicePixelRatio || 1
      const w   = canvas.clientWidth
      const h   = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width  = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!isPlaying) return

      analyser.getByteFrequencyData(dataArray)

      const bw  = (canvas.width / barCount) * 0.65
      const gap = (canvas.width / barCount) * 0.35

      for (let i = 0; i < barCount; i++) {
        const binIdx    = Math.floor((i / barCount) * bufferLen * 0.75)
        const value     = dataArray[binIdx] || 0
        const pct       = value / 255
        const barHeight = Math.max(2, pct * canvas.height * 0.88)
        const x         = i * (bw + gap)
        const y         = (canvas.height - barHeight) / 2

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight)
        grad.addColorStop(0, color + 'DD')
        grad.addColorStop(1, color + '44')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.roundRect?.(x, y, bw, barHeight, 2) || ctx.rect(x, y, bw, barHeight)
        ctx.fill()
      }
    }

    draw()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isPlaying, barCount, color])

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ display: 'block' }}
    />
  )
}
