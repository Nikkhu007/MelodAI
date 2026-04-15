require('dotenv').config()
require('express-async-errors')

const express      = require('express')
const cors         = require('cors')
const helmet       = require('helmet')
const rateLimit    = require('express-rate-limit')
const cookieParser = require('cookie-parser')
const connectDB    = require('./config/db')
const fs           = require('fs')
const path         = require('path')

const logsDir = path.join(__dirname, 'logs')
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir)

const authRoutes        = require('./routes/auth')
const songRoutes        = require('./routes/songs')
const playlistRoutes    = require('./routes/playlists')
const userRoutes        = require('./routes/users')
const recommendRoutes   = require('./routes/recommendations')
const uploadRoutes      = require('./routes/upload')
const lyricsRoutes      = require('./routes/lyrics')

// YouTube only loaded in development (yt-dlp not available on hosting)
let youtubeRoutes = null
if (process.env.NODE_ENV !== 'production') {
  try { youtubeRoutes = require('./routes/youtube') } catch(e) { console.log('YouTube routes skipped') }
}

const app = express()
connectDB()

// Trust proxy (needed for Render/Railway)
app.set('trust proxy', 1)

// CORS — allow your Vercel frontend + localhost dev
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean)

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}))

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl) + allowedOrigins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type','Authorization'],
}))

app.use(cookieParser())
app.options('*', cors()) // handle preflight

const generalLimiter = rateLimit({ windowMs: 15*60*1000, max: 500, standardHeaders: true, legacyHeaders: false })
const authLimiter    = rateLimit({ windowMs: 15*60*1000, max: 20 })
app.use('/api/', generalLimiter)
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now()-start}ms`))
  next()
})

app.get('/',        (req, res) => res.json({ message: 'MelodAI API is running 🎵' }))
app.get('/health',  (req, res) => res.json({ status: 'ok', service: 'melodai-backend', uptime: Math.floor(process.uptime()), env: process.env.NODE_ENV }))

app.use('/api/auth',            authRoutes)
app.use('/api/songs',           songRoutes)
app.use('/api/playlists',       playlistRoutes)
app.use('/api/users',           userRoutes)
app.use('/api/recommendations', recommendRoutes)
app.use('/api/upload',          uploadRoutes)
app.use('/api/lyrics',          lyricsRoutes)
if (youtubeRoutes) app.use('/api/youtube', youtubeRoutes)

app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.path} not found` }))
app.use((err, req, res, next) => {
  console.error(err.stack)
  const status = err.statusCode || err.status || 500
  res.status(status).json({ success: false, message: status === 500 ? 'Internal Server Error' : err.message })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, '0.0.0.0', () => console.log(`🎵 MelodAI Backend running on port ${PORT} [${process.env.NODE_ENV}]`))
module.exports = app

// ── Keep-alive ping (prevents Render free tier from sleeping) ──────────────
if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_HOSTNAME) {
  setInterval(() => {
    fetch(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}/health`)
      .then(() => console.log('Keep-alive ping sent'))
      .catch(() => {})
  }, 14 * 60 * 1000) // every 14 minutes
}
