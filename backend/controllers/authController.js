/**
 * Auth Controller — v3 fixed
 *
 * KEY FIX: email is stored and compared as-is (lowercased only).
 * normalizeEmail() was removed from validation — it was transforming
 * gmail.com → googlemail.com which broke login for saved accounts.
 */
const jwt      = require('jsonwebtoken')
const { validationResult } = require('express-validator')
const User     = require('../models/User')
const AppError = require('../utils/AppError')

const resetTokens = new Map()

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '30d' })

const userPayload = (u) => ({
  _id:         u._id,
  username:    u.username,
  email:       u.email,
  avatar:      u.avatar,
  role:        u.role,
  currentMood: u.currentMood,
  likedSongs:  u.likedSongs || [],
})

// ── POST /api/auth/register ───────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty())
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors:  errors.array(),
    })

  const { username, email, password } = req.body
  const normalEmail = email.toLowerCase().trim()

  // Check for existing user
  const existing = await User.findOne({
    $or: [
      { email: normalEmail },
      { username: username.trim() }
    ]
  })

  if (existing) {
    const msg = existing.email === normalEmail
      ? 'Email already registered — please log in'
      : 'Username already taken — try a different one'
    return next(AppError.conflict(msg))
  }

  const user  = await User.create({
    username: username.trim(),
    email:    normalEmail,
    password,
  })
  const token = signToken(user._id)

  res.status(201).json({ success: true, token, user: userPayload(user) })
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, message: errors.array()[0].msg })

  const { email, password } = req.body
  const normalEmail = email.toLowerCase().trim()

  const user = await User.findOne({ email: normalEmail }).select('+password')
  if (!user || !(await user.comparePassword(password)))
    return next(AppError.unauthorized('Invalid email or password'))

  if (!user.isActive)
    return next(AppError.unauthorized('Account deactivated — contact support'))

  User.findByIdAndUpdate(user._id, { lastSeen: new Date() }).exec()

  const token = signToken(user._id)
  res.json({ success: true, token, user: userPayload(user) })
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('likedSongs', 'title artist coverUrl duration audioUrl genre mood')
    .select('-password')
  if (!user) return res.status(401).json({ success: false, message: 'User not found' })
  res.json({ success: true, user })
}

// ── PUT /api/auth/mood ────────────────────────────────────────────────────────
exports.setMood = async (req, res, next) => {
  const { mood } = req.body
  const validMoods = ['happy','sad','energetic','focus','chill','gym','romance',null]
  if (!validMoods.includes(mood))
    return next(AppError.badRequest('Invalid mood value'))

  const user = await User.findByIdAndUpdate(
    req.user._id, { currentMood: mood || null }, { new: true }
  )
  res.json({ success: true, mood: user.currentMood })
}

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  const { email } = req.body
  if (!email) return res.status(400).json({ success: false, message: 'Email required' })

  const user = await User.findOne({ email: email.toLowerCase().trim() })

  const genericResponse = {
    success: true,
    message: 'If that email is registered, a reset code was sent.',
  }

  if (!user) return res.json(genericResponse)

  const otp    = Math.floor(100000 + Math.random() * 900000).toString()
  const expiry = Date.now() + 10 * 60 * 1000

  resetTokens.set(email.toLowerCase().trim(), { otp, userId: user._id.toString(), expiry })

  console.log(`\n╔══════════════════════════════════╗`)
  console.log(`║  PASSWORD RESET OTP              ║`)
  console.log(`║  Email: ${email.padEnd(24)}║`)
  console.log(`║  Code:  ${otp.padEnd(24)}║`)
  console.log(`║  Expires in 10 minutes           ║`)
  console.log(`╚══════════════════════════════════╝\n`)

  res.json({
    ...genericResponse,
    ...(process.env.NODE_ENV !== 'production' && { _dev_otp: otp }),
  })
}

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
exports.resetPassword = async (req, res, next) => {
  const { email, otp, newPassword } = req.body
  if (!email || !otp || !newPassword)
    return next(AppError.badRequest('email, otp and newPassword required'))
  if (newPassword.length < 6)
    return next(AppError.badRequest('Password must be at least 6 characters'))

  const stored = resetTokens.get(email.toLowerCase().trim())
  if (!stored || stored.otp !== otp || Date.now() > stored.expiry)
    return next(AppError.unauthorized('Invalid or expired reset code'))

  resetTokens.delete(email.toLowerCase().trim())

  const user = await User.findById(stored.userId).select('+password')
  if (!user) return next(AppError.notFound('User not found'))

  user.password = newPassword
  await user.save()

  res.json({ success: true, message: 'Password reset successfully. Please log in.' })
}
