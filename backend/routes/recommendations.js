const express = require('express');
const {
  getHomeFeed, getSimilar, getMoodRecommendations, smartSearch,
} = require('../controllers/recommendationController');
const { protect, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/home', protect, getHomeFeed);
router.get('/search', optionalAuth, smartSearch);
router.get('/mood/:mood', protect, getMoodRecommendations);
router.get('/similar/:songId', optionalAuth, getSimilar);

module.exports = router;
