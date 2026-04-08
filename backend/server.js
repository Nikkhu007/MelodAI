require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

const authRoutes       = require('./routes/auth');
const songRoutes       = require('./routes/songs');
const playlistRoutes   = require('./routes/playlists');
const userRoutes       = require('./routes/users');
const recommendRoutes  = require('./routes/recommendations');
const uploadRoutes     = require('./routes/upload');
const youtubeRoutes    = require('./routes/youtube');

const app = express();

connectDB();

// Allow all origins for the audio stream endpoint (HTML5 <audio> needs this)
app.use('/api/youtube/stream', cors({ origin: '*' }));

// All other routes: only allow frontend origin
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // Allow audio content to load cross-origin
  crossOriginEmbedderPolicy: false,
}));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'melodai-backend' }));

app.use('/api/auth',            authRoutes);
app.use('/api/songs',           songRoutes);
app.use('/api/playlists',       playlistRoutes);
app.use('/api/users',           userRoutes);
app.use('/api/recommendations', recommendRoutes);
app.use('/api/upload',          uploadRoutes);
app.use('/api/youtube',         youtubeRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🎵 MelodAI Backend running on port ${PORT}`));
module.exports = app;
