const express = require('express');
const {
  getPlaylists, getPlaylist, createPlaylist, updatePlaylist,
  deletePlaylist, addSong, removeSong, generateAIPlaylist,
} = require('../controllers/playlistController');
const { protect, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', optionalAuth, getPlaylists);
router.get('/:id', optionalAuth, getPlaylist);
router.post('/', protect, createPlaylist);
router.post('/ai-generate', protect, generateAIPlaylist);
router.put('/:id', protect, updatePlaylist);
router.delete('/:id', protect, deletePlaylist);
router.post('/:id/songs', protect, addSong);
router.delete('/:id/songs/:songId', protect, removeSong);

module.exports = router;
