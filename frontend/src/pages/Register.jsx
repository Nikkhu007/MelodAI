import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Music2, Eye, EyeOff, Mail, Lock, User, AlertCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import useAuthStore from '../store/authStore'

export default function Register() {
  const { register, loading } = useAuthStore()
  const navigate = useNavigate()
  const [form,     setForm]     = useState({ username: '', email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [error,    setError]    = useState('')
  const [fieldErr, setFieldErr] = useState({}) // per-field errors

  const setF = (k, v) => {
    setForm(p => ({ ...p, [k]: v }))
    // Clear field error when user starts typing
    if (fieldErr[k]) setFieldErr(p => ({ ...p, [k]: '' }))
    setError('')
  }

  const validate = () => {
    const errs = {}
    if (!form.username.trim() || form.username.trim().length < 3)
      errs.username = 'Username must be at least 3 characters'
    if (!form.email.trim())
      errs.email = 'Email address is required'
    else if (!/\S+@\S+\.\S+/.test(form.email))
      errs.email = 'Please enter a valid email address'
    if (!form.password || form.password.length < 6)
      errs.password = 'Password must be at least 6 characters'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setFieldErr({})

    // Client-side validation first — gives instant feedback
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFieldErr(errs)
      return
    }

    const result = await register(form.username.trim(), form.email.trim(), form.password)
    if (result.success) {
      navigate('/')
    } else {
      // Try to map server error to specific field
      const msg = result.message || 'Registration failed'
      if (msg.toLowerCase().includes('username')) setFieldErr({ username: msg })
      else if (msg.toLowerCase().includes('email')) setFieldErr({ email: msg })
      else if (msg.toLowerCase().includes('password')) setFieldErr({ password: msg })
      else setError(msg)
    }
  }

  const strength = form.password.length === 0 ? 0
    : form.password.length < 6 ? 1
    : form.password.length < 10 ? 2 : 3
  const strengthColor = ['', 'bg-red-500', 'bg-yellow-400', 'bg-green-500'][strength]
  const strengthLabel = ['', 'Weak', 'Good', 'Strong'][strength]

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-bg)' }}>
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-brand/20 via-brand/5 to-transparent p-12 border-r border-surface-border/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center glow">
            <Music2 size={22} className="text-white" />
          </div>
          <span className="text-xl font-bold text-text-primary">MelodAI</span>
        </div>
        <div>
          <h2 className="text-4xl font-bold text-text-primary leading-tight mb-4">
            Join the future<br />
            <span className="text-gradient">of music.</span>
          </h2>
          <p className="text-text-muted text-lg">Create your account and let AI discover music you'll love.</p>
        </div>
        <p className="text-text-muted text-xs">Free forever · No credit card needed</p>
      </div>

      {/* Right form */}
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

          <h1 className="text-3xl font-bold text-text-primary mb-1">Create account</h1>
          <p className="text-text-muted mb-8">Free forever — start listening in seconds</p>

          {/* Global error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3"
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Username */}
            <div>
              <label className="text-sm font-medium text-text-secondary mb-2 block">
                Username
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  className={`input-field pl-10 ${fieldErr.username ? 'border-red-500/60 focus:border-red-500' : ''}`}
                  placeholder="Your name (e.g. Ganesh Kendre)"
                  value={form.username}
                  onChange={e => setF('username', e.target.value)}
                  autoComplete="name"
                  maxLength={30}
                />
              </div>
              {fieldErr.username && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErr.username}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-medium text-text-secondary mb-2 block">
                Email address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  type="email"
                  className={`input-field pl-10 ${fieldErr.email ? 'border-red-500/60 focus:border-red-500' : ''}`}
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setF('email', e.target.value)}
                  autoComplete="email"
                />
              </div>
              {fieldErr.email && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErr.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-text-secondary mb-2 block">
                Password
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  className={`input-field pl-10 pr-11 ${fieldErr.password ? 'border-red-500/60 focus:border-red-500' : ''}`}
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={e => setF('password', e.target.value)}
                  autoComplete="new-password"
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {/* Strength bar */}
              {form.password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-surface-border rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strengthColor} transition-all duration-300`}
                      style={{ width: `${(strength / 3) * 100}%` }}
                    />
                  </div>
                  <span className={`text-[10px] ${['','text-red-400','text-yellow-400','text-green-400'][strength]}`}>
                    {strengthLabel}
                  </span>
                </div>
              )}
              {fieldErr.password && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} /> {fieldErr.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 text-base font-semibold mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-text-muted text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand hover:text-brand-light font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
