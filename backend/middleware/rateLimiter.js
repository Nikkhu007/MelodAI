/**
 * Tiered rate limiters
 *
 * general      — 300 req/15min per IP
 * auth         — 10 attempts/15min (brute force protection)
 * upload       — 10 req/hour
 * stream       — 60 req/min (YouTube audio)
 * search       — 60 req/min
 * lyrics       — 30 req/min (external API calls)
 */
const rateLimit = require('express-rate-limit')
const AppError  = require('../utils/AppError')

const make = (opts) => rateLimit({
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: opts.message || 'Too many requests — please slow down',
      code:    'TOO_MANY_REQUESTS',
      retryAfter: Math.ceil(opts.windowMs / 1000 / 60) + ' minutes',
    })
  },
  ...opts,
})

module.exports = {
  general: make({ windowMs: 15 * 60 * 1000, max: 300 }),
  auth:    make({ windowMs: 15 * 60 * 1000, max: 10,  message: 'Too many login attempts — try again in 15 minutes' }),
  upload:  make({ windowMs: 60 * 60 * 1000, max: 10,  message: 'Upload limit reached — try again in 1 hour' }),
  stream:  make({ windowMs:      60 * 1000, max: 60 }),
  search:  make({ windowMs:      60 * 1000, max: 60 }),
  lyrics:  make({ windowMs:      60 * 1000, max: 30 }),
}
