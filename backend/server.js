/**
 * MelodAI Backend Server — v3 Maximum Level
 *
 * Security stack:
 *   helmet          — 15 security headers
 *   mongoSanitize   — prevent NoSQL injection ($where, $gt attacks)
 *   xss-clean       — strip XSS from req.body/query/params
 *   hpp             — prevent HTTP Parameter Pollution
 *   cors            — whitelist-only origins
 *   rate limiting   — tiered per endpoint type
 *   request ID      — every request gets a UUID for log tracing
 *
 * Performance:
 *   node-cache      — in-process response caching
 *   connection pool — mongo maxPoolSize=10
 *   gzip via express — handled by reverse proxy in prod
 *
 * Observability:
 *   Winston          — structured JSON logs, daily rotation
 *   request logging  — method/path/status/ms/requestId on every request
 *   health endpoint  — /health returns uptime, memory, DB state
 *
 * Reliability:
 *   graceful shutdown — drains in-flight requests before exit
 *   circuit breaker   — wraps AI service + Cloudinary
 *   express-async-errors — catches all async throws automatically
 */

require('dotenv').config()
require('express-async-errors')

const express       = require('express')
const cors          = require('cors')
const helmet        = require('helmet')
const cookieParser  = require('cookie-parser')
const mongoSanitize = require('express-mongo-sanitize')
const xssClean      = require('xss-clean')
const hpp           = require('hpp')
const mongoose      = require('mongoose')
const path          = require('path')
const fs            = require('fs')

const connectDB    = require('./config/db')
const logger       = require('./utils/logger')
const limiter      = require('./middleware/rateLimiter')
const requestId    = require('./middleware/requestId')
const { stats: cacheStats } = require('./utils/cache')
const breakers     = require('./utils/circuitBreaker')

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes        = require('./routes/auth')
const songRoutes        = require('./routes/songs')
const playlistRoutes    = require('./routes/playlists')
const userRoutes        = require('./routes/users')
const recommendRoutes   = require('./routes/recommendations')
const uploadRoutes      = require('./routes/upload')
const lyricsRoutes      = require('./routes/lyrics')

// YouTube only in development
let youtubeRoutes = null
if (process.env.NODE_ENV !== 'production') {
  try { youtubeRoutes = require('./routes/youtube') } catch (e) { logger.warn('YouTube routes not loaded') }
}

// ── Ensure logs directory ────────────────────────────────────────────────────
const logsDir = path.join(__dirname, 'logs')
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

const app = express()

// ── Connect DB ────────────────────────────────────────────────────────────────
connectDB()

// ── Trust proxy (Render / Vercel / Nginx sit in front) ───────────────────────
app.set('trust proxy', 1)

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:3000',
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin (mobile/curl/Postman in dev)
    if (!origin) return cb(null, true)
    // In development allow any localhost port (Vite picks next available port)
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
      return cb(null, true)
    }
    if (allowedOrigins.includes(origin)) return cb(null, true)
    logger.warn(`CORS blocked: ${origin}`)
    cb(new Error(`Origin ${origin} not allowed`))
  },
  credentials:     true,
  methods:         ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders:  ['Content-Type','Authorization','X-Request-Id'],
  exposedHeaders:  ['X-Request-Id','X-Cache','X-RateLimit-Remaining'],
}))
app.options('*', cors())

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy:  { policy: 'cross-origin' },
  crossOriginEmbedderPolicy:  false,
  contentSecurityPolicy:      false,           // Relaxed — frontend handles CSP
  hsts: { maxAge: 31536000, includeSubDomains: true },
}))

// ── Request ID (attach before everything else) ────────────────────────────────
app.use(requestId)

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true, limit: '5mb' }))
app.use(cookieParser())

// ── Security middleware ───────────────────────────────────────────────────────
app.use(mongoSanitize())        // strip $ and . from req.body/query/params
app.use(xssClean())             // sanitize XSS from user input
app.use(hpp({                   // prevent ?sort=asc&sort=desc attacks
  whitelist: ['tags', 'genre', 'mood'],
}))

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api/', limiter.general)

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const ms  = Date.now() - start
    const lvl = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'
    logger[lvl](`${req.method} ${req.path} ${res.statusCode} ${ms}ms`, {
      requestId: req.requestId,
      ip:        req.ip,
      ua:        req.get('user-agent')?.slice(0, 80),
    })
  })
  next()
})

// ── Health & diagnostic endpoints ─────────────────────────────────────────────
app.get('/', (req, res) => res.json({ message: 'MelodAI API', version: '3.0' }))

app.get('/health', (req, res) => {
  const mem = process.memoryUsage()
  res.json({
    status:  'ok',
    service: 'melodai-backend',
    version: '3.0',
    uptime:  Math.floor(process.uptime()),
    memory: {
      heapUsed:  Math.round(mem.heapUsed  / 1024 / 1024) + 'MB',
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB',
      rss:       Math.round(mem.rss       / 1024 / 1024) + 'MB',
    },
    db:      mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    cache:   cacheStats(),
    circuits: {
      ai:         breakers.ai.getStatus(),
      cloudinary: breakers.cloudinary.getStatus(),
    },
    env: process.env.NODE_ENV,
  })
})

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',            authRoutes)
app.use('/api/songs',           songRoutes)
app.use('/api/playlists',       playlistRoutes)
app.use('/api/users',           userRoutes)
app.use('/api/recommendations', recommendRoutes)
app.use('/api/upload',          uploadRoutes)
app.use('/api/lyrics',          lyricsRoutes)
if (youtubeRoutes) app.use('/api/youtube', youtubeRoutes)

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success:   false,
    message:   `Route ${req.method} ${req.path} not found`,
    requestId: req.requestId,
  })
})

// ── Global error handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.statusCode || err.status || 500

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message)
    return res.status(400).json({
      success:   false,
      message:   'Validation failed',
      errors:    messages,
      requestId: req.requestId,
    })
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field'
    return res.status(409).json({
      success:   false,
      message:   `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
      requestId: req.requestId,
    })
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success:   false,
      message:   `Invalid ${err.path}: ${err.value}`,
      requestId: req.requestId,
    })
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError')  return res.status(401).json({ success: false, message: 'Invalid token',          requestId: req.requestId })
  if (err.name === 'TokenExpiredError')  return res.status(401).json({ success: false, message: 'Session expired',        requestId: req.requestId })

  // Operational errors (AppError)
  if (err.isOperational) {
    return res.status(status).json({
      success:   false,
      message:   err.message,
      code:      err.code,
      requestId: req.requestId,
    })
  }

  // Unknown error — log full stack, hide details from client
  logger.error('Unhandled error', {
    message:   err.message,
    stack:     err.stack,
    path:      req.path,
    requestId: req.requestId,
  })

  res.status(500).json({
    success:   false,
    message:   process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    requestId: req.requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

// ── Start server with graceful shutdown ───────────────────────────────────────
const PORT = process.env.PORT || 5000

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`MelodAI Backend v3 running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`)
})

// Keep-alive for Render free tier
if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_HOSTNAME) {
  setInterval(() => {
    fetch(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}/health`).catch(() => {})
  }, 14 * 60 * 1000)
}

// Graceful shutdown — drain in-flight requests before exit
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received — starting graceful shutdown`)
  server.close(() => {
    logger.info('HTTP server closed')
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed')
      process.exit(0)
    })
  })
  // Force exit after 30s
  setTimeout(() => { logger.error('Forced shutdown after timeout'); process.exit(1) }, 30000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT',  () => gracefulShutdown('SIGINT'))
process.on('uncaughtException',  (err) => { logger.error('uncaughtException',  { error: err.message, stack: err.stack }); process.exit(1) })
process.on('unhandledRejection', (err) => { logger.error('unhandledRejection', { error: err?.message, stack: err?.stack }) })

module.exports = app
