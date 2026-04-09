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

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs')
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir)

const authRoutes        = require('./routes/auth')
const songRoutes        = require('./routes/songs')
const playlistRoutes    = require('./routes/playlists')
const userRoutes        = require('./routes/users')
const recommendRoutes   = require('./routes/recommendations')
const uploadRoutes      = require('./routes/upload')
const youtubeRoutes     = require('./routes/youtube')
const lyricsRoutes      = require('./routes/lyrics')

const app = express()
connectDB()

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }))
app.use('/api/youtube/stream', cors({ origin: '*' }))
app.use(cors({ origin: [process.env.CLIENT_URL || 'http://localhost:5173', 'http://localhost:3000'], credentials: true, methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }))
app.use(cookieParser())

const generalLimiter = rateLimit({ windowMs: 15*60*1000, max: 500, standardHeaders: true, legacyHeaders: false })
const authLimiter    = rateLimit({ windowMs: 15*60*1000, max: 20 })
const streamLimiter  = rateLimit({ windowMs: 60*1000, max: 60 })
app.use('/api/', generalLimiter)
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/youtube/stream', streamLimiter)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now()-start}ms`)
    }
  })
  next()
})

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'melodai-backend', uptime: Math.floor(process.uptime()) }))

app.use('/api/auth',            authRoutes)
app.use('/api/songs',           songRoutes)
app.use('/api/playlists',       playlistRoutes)
app.use('/api/users',           userRoutes)
app.use('/api/recommendations', recommendRoutes)
app.use('/api/upload',          uploadRoutes)
app.use('/api/youtube',         youtubeRoutes)
app.use('/api/lyrics',          lyricsRoutes)

app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.path} not found` }))
app.use((err, req, res, next) => {
  console.error(err.stack)
  const status = err.statusCode || err.status || 500
  res.status(status).json({ success: false, message: status === 500 ? 'Internal Server Error' : err.message, ...(process.env.NODE_ENV==='development'&&{stack:err.stack}) })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`🎵 MelodAI Backend on port ${PORT}`))
module.exports = app
