const express = require('express')
const { getLyrics, cacheStats } = require('../controllers/lyricsController')

const router = express.Router()

// GET /api/lyrics?artist=Arijit+Singh&title=Tum+Hi+Ho
router.get('/', getLyrics)
router.get('/cache-stats', cacheStats)

module.exports = router
