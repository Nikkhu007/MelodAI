/**
 * In-process cache using node-cache
 * Avoids Redis dependency while still caching expensive queries.
 *
 * TTL defaults:
 *   trending  — 10 min  (changes often)
 *   songs     — 5 min
 *   playlists — 5 min
 *   users     — 1 min   (profile data changes frequently)
 *
 * Cache is keyed by route+params string.
 * Cache is invalidated on write operations by prefix.
 */
const NodeCache = require('node-cache')

const cache = new NodeCache({
  stdTTL:      300,      // 5 min default
  checkperiod: 60,       // check for expired keys every 60s
  useClones:   false,    // don't clone objects (faster)
  maxKeys:     500,
})

const TTL = {
  trending:  600,
  songs:     300,
  playlists: 300,
  users:     60,
  lyrics:    86400,      // 24 hours
  search:    120,
}

/**
 * Middleware factory: cache GET responses by URL+query string
 * Usage: router.get('/trending', cacheMiddleware('trending'), handler)
 */
function cacheMiddleware(type = 'songs') {
  const ttl = TTL[type] || 300
  return (req, res, next) => {
    // Never cache authenticated user-specific routes
    if (req.user) return next()

    const key = `${type}:${req.originalUrl}`
    const cached = cache.get(key)
    if (cached !== undefined) {
      res.setHeader('X-Cache', 'HIT')
      return res.json(cached)
    }

    // Intercept res.json to store the response
    const originalJson = res.json.bind(res)
    res.json = (body) => {
      if (res.statusCode === 200 && body?.success) {
        cache.set(key, body, ttl)
      }
      res.setHeader('X-Cache', 'MISS')
      return originalJson(body)
    }
    next()
  }
}

/**
 * Invalidate all keys with a given prefix
 */
function invalidate(prefix) {
  const keys = cache.keys().filter(k => k.startsWith(prefix))
  if (keys.length) cache.del(keys)
}

/**
 * Direct get/set for controller-level caching
 */
function get(key)              { return cache.get(key) }
function set(key, val, ttl)    { cache.set(key, val, ttl) }
function del(key)              { cache.del(key) }
function stats()               { return cache.getStats() }

module.exports = { cacheMiddleware, invalidate, get, set, del, stats, TTL }
