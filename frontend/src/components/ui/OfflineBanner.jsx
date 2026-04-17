import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { WifiOff, Wifi } from 'lucide-react'

export default function OfflineBanner() {
  const [online,      setOnline]      = useState(navigator.onLine)
  const [showBack,    setShowBack]    = useState(false)

  useEffect(() => {
    const goOnline  = () => { setOnline(true);  setShowBack(true); setTimeout(() => setShowBack(false), 3000) }
    const goOffline = () => { setOnline(false); setShowBack(false) }
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const show = !online || showBack

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{   y: -48,  opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={`fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 py-2.5 text-sm font-medium
            ${online
              ? 'bg-green-500/90 text-white'
              : 'bg-orange-500/90 text-white'
            }`}
        >
          {online
            ? <><Wifi size={14} /> Back online!</>
            : <><WifiOff size={14} /> You're offline — music continues playing</>
          }
        </motion.div>
      )}
    </AnimatePresence>
  )
}
