const express = require('express');
const {
  getSongs, getSong, createSong, updateSong, deleteSong, trackEvent, getTrending,
} = require('../controllers/songController');
const { protect, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, getSongs);
router.get('/trending', getTrending);
router.get('/:id', optionalAuth, getSong);
router.post('/', protect, createSong);
router.put('/:id', protect, updateSong);
router.delete('/:id', protect, deleteSong);
router.post('/:id/event', protect, trackEvent);

module.exports = router;
