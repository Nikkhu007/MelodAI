const jwt     = require('jsonwebtoken')
const User    = require('../models/User')
const AppError = require('../utils/AppError')

/**
 * protect — require valid JWT. Attaches req.user
 */
const protect = async (req, res, next) => {
  try {
    let token
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1]
    } else if (req.cookies?.token) {
      token = req.cookies.token
    }

    if (!token) return next(AppError.unauthorized('Authentication required'))

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const user = await User.findById(decoded.id)
      .select('-password')
      .lean()

    if (!user) return next(AppError.unauthorized('Account no longer exists'))

    req.user = user
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') return next(AppError.unauthorized('Session expired — please login again'))
    if (err.name === 'JsonWebTokenError')  return next(AppError.unauthorized('Invalid token'))
    next(err)
  }
}

/**
 * adminOnly — must be called after protect
 */
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return next(AppError.forbidden('Admin access required'))
  next()
}

/**
 * optionalAuth — attach user if token present, continue either way
 */
const optionalAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      req.user = await User.findById(decoded.id).select('-password').lean()
    } catch {}
  }
  next()
}

/**
 * ownerOrAdmin — req.resourceOwnerId must be set by the controller
 */
const ownerOrAdmin = (req, res, next) => {
  const isOwner = req.resourceOwnerId?.toString() === req.user?._id?.toString()
  const isAdmin = req.user?.role === 'admin'
  if (!isOwner && !isAdmin) return next(AppError.forbidden('Not authorized'))
  next()
}

module.exports = { protect, adminOnly, optionalAuth, ownerOrAdmin }
