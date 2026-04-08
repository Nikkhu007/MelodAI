const express = require('express')
const { search, stream, getInfo, trending, check } = require('../controllers/youtubeController')
const { protect, optionalAuth } = require('../middleware/auth')

const router = express.Router()

// Check yt-dlp installation status
router.get('/check', check)

// Search YouTube
router.get('/search', optionalAuth, search)

// Get full video info
router.get('/info/:videoId', optionalAuth, getInfo)

// Trending music
router.get('/trending', optionalAuth, trending)

// Stream audio — redirects to YouTube CDN URL
// No auth required so the HTML5 <audio> element can load it directly
router.get('/stream/:videoId', stream)

module.exports = router
