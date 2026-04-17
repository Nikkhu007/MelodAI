const express = require('express')
const {
  getMe, updateProfile, changePassword,
  getHistory, getLiked, getMyStats, getAIProfile,
  followUser, unfollowUser, getProfile, deactivateAccount,
} = require('../controllers/userController')
const { protect, optionalAuth } = require('../middleware/auth')

const r = express.Router()

r.get('/me',             protect,       getMe)
r.put('/profile',        protect,       updateProfile)
r.put('/password',       protect,       changePassword)
r.get('/history',        protect,       getHistory)
r.get('/liked',          protect,       getLiked)
r.get('/stats',          protect,       getMyStats)
r.get('/ai-profile',     protect,       getAIProfile)
r.post('/follow/:id',    protect,       followUser)
r.delete('/follow/:id',  protect,       unfollowUser)
r.delete('/me',          protect,       deactivateAccount)
r.get('/:id',            optionalAuth,  getProfile)

module.exports = r
