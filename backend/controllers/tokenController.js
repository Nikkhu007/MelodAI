/**
 * Refresh Token System
 * - Access token: 15 min (short-lived, stored in memory/localStorage)
 * - Refresh token: 30 days (stored in httpOnly cookie)
 */

const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const User = require('../models/User')

// In-memory refresh token store (use Redis in true production)
const refreshTokens = new Map() // token → { userId, expiry }

const ACCESS_TTL  = '15m'
const REFRESH_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days ms

function generateTokens(userId) {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL })
  const refreshToken = crypto.randomBytes(48).toString('hex')
  refreshTokens.set(refreshToken, { userId: userId.toString(), expiry: Date.now() + REFRESH_TTL })
  return { accessToken, refreshToken }
}

/**
 * POST /api/auth/refresh
 * Exchange a valid refresh token for a new access token
 */
exports.refresh = async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken
  if (!token) return res.status(401).json({ success: false, message: 'No refresh token' })

  const stored = refreshTokens.get(token)
  if (!stored || Date.now() > stored.expiry) {
    refreshTokens.delete(token)
    return res.status(401).json({ success: false, message: 'Refresh token expired or invalid' })
  }

  const user = await User.findById(stored.userId).select('-password')
  if (!user) return res.status(401).json({ success: false, message: 'User not found' })

  // Rotate refresh token (invalidate old one)
  refreshTokens.delete(token)
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id)

  // Set new refresh token as httpOnly cookie
  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_TTL,
  })

  res.json({ success: true, token: accessToken, user })
}

/**
 * POST /api/auth/logout
 */
exports.logout = (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken
  if (token) refreshTokens.delete(token)
  res.clearCookie('refreshToken')
  res.json({ success: true, message: 'Logged out' })
}

exports.generateTokens = generateTokens
