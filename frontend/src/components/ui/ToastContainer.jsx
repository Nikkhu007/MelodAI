import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import useUIStore from '../../store/uiStore'

const CONFIG = {
  success: { icon: CheckCircle, color: 'text-green-400',  bg: 'border-green-500/20 bg-green-500/10' },
  error:   { icon: XCircle,     color: 'text-red-400',    bg: 'border-red-500/20   bg-red-500/10'   },
  info:    { icon: Info,        color: 'text-blue-400',   bg: 'border-blue-500/20  bg-blue-500/10'  },
}

export default function ToastContainer() {
  const { toasts } = useUIStore()

  return (
    <div className="fixed bottom-28 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => {
          const cfg = CONFIG[t.type] || CONFIG.info
          const Icon = cfg.icon
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0,  scale: 1   }}
              exit={{   opacity: 0, x: 60,  scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-xl text-sm text-text-primary max-w-xs ${cfg.bg}`}
            >
              <Icon size={16} className={`${cfg.color} shrink-0`} />
              <span className="flex-1">{t.message}</span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
