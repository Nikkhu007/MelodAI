import { X } from 'lucide-react'
import useUIStore from '../../store/uiStore'
import useAuthStore from '../../store/authStore'

const MOODS = [
  { id: 'happy', emoji: '😄', label: 'Happy', color: 'from-yellow-500/30 to-orange-500/20 hover:from-yellow-500/50' },
  { id: 'sad', emoji: '😢', label: 'Sad', color: 'from-blue-500/30 to-indigo-500/20 hover:from-blue-500/50' },
  { id: 'energetic', emoji: '⚡', label: 'Energetic', color: 'from-orange-500/30 to-red-500/20 hover:from-orange-500/50' },
  { id: 'focus', emoji: '🎯', label: 'Focus', color: 'from-green-500/30 to-teal-500/20 hover:from-green-500/50' },
  { id: 'chill', emoji: '😌', label: 'Chill', color: 'from-cyan-500/30 to-blue-500/20 hover:from-cyan-500/50' },
  { id: 'gym', emoji: '💪', label: 'Gym', color: 'from-red-500/30 to-orange-500/20 hover:from-red-500/50' },
  { id: 'romance', emoji: '💜', label: 'Romance', color: 'from-pink-500/30 to-purple-500/20 hover:from-pink-500/50' },
]

export default function MoodPickerModal() {
  const { closeModal, toast } = useUIStore()
  const { user, setMood } = useAuthStore()

  const handleSelect = async (mood) => {
    await setMood(mood)
    toast(`Mood set to ${mood} 🎵`)
    closeModal('moodPicker')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-text-primary">How are you feeling?</h2>
          <button onClick={() => closeModal('moodPicker')} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-text-muted mb-5">AI will personalize your music to match your vibe.</p>

        <div className="grid grid-cols-4 gap-3">
          {MOODS.map((mood) => (
            <button
              key={mood.id}
              onClick={() => handleSelect(mood.id)}
              className={`
                relative flex flex-col items-center gap-2 p-3 rounded-2xl
                bg-gradient-to-br ${mood.color}
                border transition-all duration-200 active:scale-95
                ${user?.currentMood === mood.id
                  ? 'border-brand shadow-lg shadow-brand/20'
                  : 'border-surface-border/30 hover:border-surface-border'
                }
              `}
            >
              <span className="text-2xl">{mood.emoji}</span>
              <span className="text-xs text-text-secondary">{mood.label}</span>
              {user?.currentMood === mood.id && (
                <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand" />
              )}
            </button>
          ))}

          {/* Clear mood */}
          <button
            onClick={() => handleSelect(null)}
            className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-surface-border/30 hover:border-surface-border bg-surface-raised/40 transition-all active:scale-95"
          >
            <span className="text-2xl">✕</span>
            <span className="text-xs text-text-muted">Clear</span>
          </button>
        </div>
      </div>
    </div>
  )
}
