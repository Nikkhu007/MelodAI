const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const ListenEvent = require('../models/ListenEvent');

const router = express.Router();

// GET /api/users/history — user's listening history
router.get('/history', protect, async (req, res) => {
  const events = await ListenEvent.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('song', 'title artist coverUrl duration audioUrl mood genre');
  res.json({ success: true, events });
});

// GET /api/users/liked — liked songs
router.get('/liked', protect, async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('likedSongs', 'title artist coverUrl duration audioUrl genre mood tempo');
  res.json({ success: true, songs: user.likedSongs });
});

// PUT /api/users/profile — update profile
router.put('/profile', protect, async (req, res) => {
  const { username, avatar } = req.body;
  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { username, avatar },
    { new: true, runValidators: true }
  ).select('-password');
  res.json({ success: true, user: updated });
});

module.exports = router;
