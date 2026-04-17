const express = require('express')
const { getLyrics, translate, cacheStats } = require('../controllers/lyricsController')

const router = express.Router()

router.get('/',             getLyrics)
router.post('/translate',   translate)
router.get('/cache-stats',  cacheStats)

module.exports = router
