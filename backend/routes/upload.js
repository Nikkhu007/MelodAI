const express  = require('express')
const { uploadAudio, uploadImage, deleteUpload } = require('../controllers/uploadController')
const { protect, adminOnly } = require('../middleware/auth')
const { uploadAudio: multerAudio, uploadImage: multerImage } = require('../config/cloudinary')
const limiter  = require('../middleware/rateLimiter')

const r = express.Router()

r.post('/audio',    protect, adminOnly, limiter.upload, multerAudio.single('audio'), uploadAudio)
r.post('/image',    protect, adminOnly, limiter.upload, multerImage.single('image'), uploadImage)
r.delete('/',       protect, adminOnly,                  deleteUpload)

module.exports = r
