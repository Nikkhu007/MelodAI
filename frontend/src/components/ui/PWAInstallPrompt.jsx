/**
 * PWAInstallPrompt
 * Shows a beautiful install banner when the browser fires beforeinstallprompt
 * Works on Android Chrome and desktop Chrome/Edge
 * iOS shows different instructions (manual Add to Home Screen)
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Smartphone, Music2 } from 'lucide-react'

export default function PWAInstallPrompt() {
  const [prompt,   setPrompt]   = useState(null)   // deferred install event
  const [show,     setShow]     = useState(false)
  const [isIOS,    setIsIOS]    = useState(false)
  const [installed,setInstalled]= useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
      return
    }

    // Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
    setIsIOS(ios)

    // Android/Desktop Chrome install prompt
    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      // Show after 30 seconds (don't be annoying immediately)
      setTimeout(() => setShow(true), 30000)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS — show after 20 seconds if not dismissed before
    if (ios) {
      const dismissed = localStorage.getItem('melodai_ios_install_dismissed')
      if (!dismissed) {
        setTimeout(() => setShow(true), 20000)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setShow(false)
    setPrompt(null)
  }

  const dismiss = () => {
    setShow(false)
    if (isIOS) localStorage.setItem('melodai_ios_install_dismissed', '1')
  }

  if (installed || !show) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="fixed bottom-20 md:bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-80 z-50"
      >
        <div className="glass-card p-4 border border-brand/20 shadow-2xl shadow-brand/10">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center shrink-0 glow">
              <Music2 size={20} className="text-white" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-text-primary text-sm">Install MelodAI</p>
              {isIOS ? (
                <p className="text-text-muted text-xs mt-0.5 leading-relaxed">
                  Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to install
                </p>
              ) : (
                <p className="text-text-muted text-xs mt-0.5 leading-relaxed">
                  Add to home screen for the full app experience
                </p>
              )}
            </div>

            {/* Close */}
            <button onClick={dismiss} className="text-text-muted hover:text-text-primary shrink-0 p-0.5">
              <X size={15} />
            </button>
          </div>

          {!isIOS && (
            <button
              onClick={install}
              className="btn-primary w-full mt-3 py-2.5 text-sm flex items-center justify-center gap-2"
            >
              <Download size={15} /> Install App
            </button>
          )}

          {isIOS && (
            <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-surface-overlay border border-surface-border/30">
              <Smartphone size={14} className="text-brand shrink-0" />
              <p className="text-xs text-text-muted">
                Safari only: Tap <span className="text-brand">⎙ Share</span> → <span className="text-brand">Add to Home Screen</span>
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
