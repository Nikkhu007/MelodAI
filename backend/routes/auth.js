const express  = require('express')
const { register, login, getMe, setMood, forgotPassword, resetPassword } = require('../controllers/authController')
const { protect } = require('../middleware/auth')
const { rules, check } = require('../middleware/validate')
const limiter = require('../middleware/rateLimiter')

const r = express.Router()

r.post('/register',       limiter.auth, rules.register, check, register)
r.post('/login',          limiter.auth, rules.login,    check, login)
r.get('/me',              protect,                             getMe)
r.put('/mood',            protect, rules.mood, check,         setMood)
r.post('/forgot-password',limiter.auth,                       forgotPassword)
r.post('/reset-password',                                      resetPassword)

module.exports = r
