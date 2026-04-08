import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Music2, Eye, EyeOff } from 'lucide-react'
import useAuthStore from '../store/authStore'

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const { register, loading } = useAuthStore()
  const navigate = useNavigate()

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
    const result = await register(form.username, form.email, form.password)
    if (result.success) navigate('/')
    else setError(result.message)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center glow mb-4">
            <Music2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Create account</h1>
          <p className="text-text-muted text-sm mt-1">Join MelodAI for free</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs text-text-muted mb-1.5 block">Username</label>
            <input className="input-field" placeholder="yourname" value={form.username}
              onChange={(e) => set('username', e.target.value)} required minLength={3} />
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1.5 block">Email</label>
            <input type="email" className="input-field" placeholder="you@example.com" value={form.email}
              onChange={(e) => set('email', e.target.value)} required />
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1.5 block">Password</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} className="input-field pr-11"
                placeholder="Min. 6 characters" value={form.password}
                onChange={(e) => set('password', e.target.value)} required minLength={6} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating account...
              </span>
            ) : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-text-muted text-sm mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-brand hover:text-brand-light transition-colors font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
