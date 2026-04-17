const express  = require('express')
const {
  getSongs, getTrending, autocomplete, getSong, getSongsByArtist,
  createSong, updateSong, deleteSong,
  trackEvent, reactToSong, reportSong, getSimilar,
  getGenres, getStats,
} = require('../controllers/songController')
const { protect, optionalAuth, adminOnly } = require('../middleware/auth')
const { rules, check } = require('../middleware/validate')
const { cacheMiddleware }  = require('../utils/cache')
const limiter = require('../middleware/rateLimiter')

const r = express.Router()

// Public / optional auth
r.get('/trending',       cacheMiddleware('trending'),  getTrending)
r.get('/autocomplete',   limiter.search,               autocomplete)
r.get('/genres',         cacheMiddleware('songs'),     getGenres)
r.get('/artist/:name',                                 getSongsByArtist)
r.get('/',               rules.pagination, check,      getSongs)
r.get('/:id',            optionalAuth,                 getSong)
r.get('/:id/similar',    optionalAuth,                 getSimilar)

// Protected
r.post('/',              protect, rules.createSong, check, createSong)
r.put('/:id',            protect,                        updateSong)
r.delete('/:id',         protect,                        deleteSong)
r.post('/:id/event',     protect,                        trackEvent)
r.post('/:id/react',     protect,                        reactToSong)
r.post('/:id/report',    protect,                        reportSong)

// Admin only
r.get('/admin/stats',    protect, adminOnly,             getStats)

module.exports = r
