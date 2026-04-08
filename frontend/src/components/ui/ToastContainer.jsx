import useUIStore from '../../store/uiStore'
import { CheckCircle, XCircle, Info } from 'lucide-react'

const ICONS = {
  success: <CheckCircle size={16} className="text-green-400 shrink-0" />,
  error: <XCircle size={16} className="text-red-400 shrink-0" />,
  info: <Info size={16} className="text-blue-400 shrink-0" />,
}

export default function ToastContainer() {
  const { toasts } = useUIStore()

  return (
    <div className="fixed bottom-24 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-slide-up flex items-center gap-2.5 px-4 py-3 rounded-xl glass border border-surface-border shadow-xl text-sm text-text-primary max-w-xs"
        >
          {ICONS[t.type] || ICONS.info}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
