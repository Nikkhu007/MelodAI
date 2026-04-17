import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Music2, Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import useAuthStore from '../store/authStore'

export default function Login() {
  const { login, loading, savedEmail } = useAuthStore()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState(savedEmail || '')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [remember, setRemember] = useState(!!savedEmail)
  const [error,    setError]    = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const result = await login(email.trim(), password, remember)
    if (result.success) navigate('/')
    else setError(result.message)
  }

  const fillDemo = () => {
    setEmail('test@melodai.com')
    setPassword('test123')
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-bg)' }}>
      {/* Left — branding panel (hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-brand/20 via-brand/5 to-transparent p-12 border-r border-surface-border/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center glow">
            <Music2 size={22} className="text-white" />
          </div>
          <span className="text-xl font-bold text-text-primary">MelodAI</span>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-text-primary leading-tight mb-4">
            Music that learns<br />
            <span className="text-gradient">what you love.</span>
          </h2>
          <p className="text-text-muted text-lg">AI-powered streaming with YouTube, lyrics, mood radio and more.</p>

          <div className="mt-10 space-y-4">
            {[
              { icon: '🎵', text: 'Stream from YouTube — full songs' },
              { icon: '🤖', text: 'AI recommendations that actually work' },
              { icon: '🎤', text: 'Synced lyrics for every song' },
              { icon: '😊', text: 'Mood radio — music for every feeling' },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i + 0.3 }}
                className="flex items-center gap-3"
              >
                <span className="text-xl">{f.icon}</span>
                <span className="text-text-secondary">{f.text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="text-text-muted text-xs">Made with ❤️ — For personal use</p>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center glow">
              <Music2 size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-text-primary">MelodAI</span>
          </div>

          <h1 className="text-3xl font-bold text-text-primary mb-1">Welcome back</h1>
          <p className="text-text-muted mb-8">Sign in to continue listening</p>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2"
            >
              <span>⚠️</span> {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-sm font-medium text-text-secondary mb-2 block">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  type="email"
                  className="input-field pl-10"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-text-secondary mb-2 block">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field pl-10 pr-11"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div
                onClick={() => setRemember(!remember)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer
                  ${remember ? 'bg-brand border-brand' : 'border-surface-border group-hover:border-brand/50'}`}
              >
                {remember && <span className="text-white text-xs">✓</span>}
              </div>
              <span className="text-sm text-text-secondary">Remember my email</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 text-base font-semibold mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Register link */}
          <p className="text-center text-text-muted text-sm mt-5">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand hover:text-brand-light font-medium transition-colors">
              Create one free
            </Link>
          </p>

          {/* Demo credentials — clickable to auto-fill */}
          <button
            onClick={fillDemo}
            className="mt-4 w-full p-3.5 rounded-xl border border-surface-border/50 hover:border-brand/40 hover:bg-brand/5 transition-all text-center group"
          >
            <p className="text-xs text-text-muted mb-0.5">Try demo account <span className="text-brand group-hover:underline">(click to auto-fill)</span></p>
            <p className="text-xs text-text-secondary font-mono">test@melodai.com · test123</p>
          </button>
        </motion.div>
      </div>
    </div>
  )
}
