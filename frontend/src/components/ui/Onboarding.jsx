/**
 * Onboarding — shown once to new users
 * Guides them to their first song in under 10 seconds
 * Stored in localStorage so only shown once
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Music2, Youtube, Smile, Sparkles, ArrowRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useUIStore from '../../store/uiStore'

const STEPS = [
  {
    icon:    '🎵',
    title:   'Welcome to MelodAI!',
    desc:    'Your personal AI music streaming app. Play any song, set your mood, and let AI discover music you\'ll love.',
    action:  null,
  },
  {
    icon:    '🎤',
    title:   'Search any song',
    desc:    'Type any song name, artist, or just a vibe — MelodAI streams it directly from YouTube. No limits.',
    action:  { label: 'Try searching →', route: '/search' },
  },
  {
    icon:    '😊',
    title:   'Set your mood',
    desc:    'Tell MelodAI how you\'re feeling — happy, chill, gym, sad, focus — and it creates a perfect playlist for you.',
    action:  { label: 'Set your mood →', modal: 'moodPicker' },
  },
  {
    icon:    '🤖',
    title:   'AI learns your taste',
    desc:    'Every song you play, like, or skip teaches the AI about your preferences. The more you use it, the better it gets.',
    action:  { label: 'Start listening →', route: '/' },
  },
]

export default function Onboarding({ onDone }) {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const { openModal } = useUIStore()
  const { user } = useAuthStore()

  const current = STEPS[step]
  const isLast  = step === STEPS.length - 1

  const handleAction = () => {
    if (current.action?.route) { onDone(); navigate(current.action.route) }
    else if (current.action?.modal) { onDone(); openModal(current.action.modal) }
  }

  const next = () => {
    if (isLast) onDone()
    else setStep(s => s + 1)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="glass-card w-full max-w-sm mx-auto overflow-hidden"
      >
        {/* Skip button */}
        <div className="flex justify-end px-4 pt-3">
          <button onClick={onDone} className="text-text-muted hover:text-text-primary text-xs flex items-center gap-1 transition-colors">
            <X size={13} /> Skip
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="text-center"
            >
              <div className="text-5xl mb-4">{current.icon}</div>
              <h2 className="text-xl font-bold text-text-primary mb-2">{current.title}</h2>
              <p className="text-text-muted text-sm leading-relaxed">{current.desc}</p>

              {user && step === 0 && (
                <p className="mt-3 text-brand font-medium text-sm">Hey {user.username}! 👋</p>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 mt-5 mb-5">
            {STEPS.map((_, i) => (
              <motion.div
                key={i}
                animate={{ width: i === step ? 20 : 6, opacity: i === step ? 1 : 0.3 }}
                className="h-1.5 rounded-full bg-brand"
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            {current.action && (
              <button
                onClick={handleAction}
                className="flex-1 btn-ghost border border-brand/40 text-brand text-sm py-2.5 hover:bg-brand/10"
              >
                {current.action.label}
              </button>
            )}
            <button
              onClick={next}
              className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-1.5"
            >
              {isLast ? 'Let\'s go! 🎵' : 'Next'}
              {!isLast && <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
