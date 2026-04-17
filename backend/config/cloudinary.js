/**
 * Cloudinary config with circuit breaker wrapping
 */
const cloudinary   = require('cloudinary').v2
const multer       = require('multer')
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const breakers     = require('../utils/circuitBreaker')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
})

// Audio storage
const audioStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:        'melodai/audio',
    resource_type: 'video',   // Cloudinary uses 'video' for audio files
    allowed_formats: ['mp3','wav','ogg','m4a','flac','aac'],
    transformation: [{ quality: 'auto' }],
  },
})

// Image storage (covers)
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'melodai/covers',
    resource_type:   'image',
    allowed_formats: ['jpg','jpeg','png','webp'],
    transformation:  [
      { width: 500, height: 500, crop: 'fill', gravity: 'center' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  },
})

const uploadAudio = multer({
  storage: audioStorage,
  limits:  { fileSize: 50 * 1024 * 1024 },  // 50 MB
  fileFilter: (req, file, cb) => {
    const ok = ['audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/flac','audio/aac']
    if (ok.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Invalid audio format — allowed: mp3 wav ogg m4a flac aac'))
  },
})

const uploadImage = multer({
  storage: imageStorage,
  limits:  { fileSize: 5 * 1024 * 1024 },   // 5 MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/webp']
    if (ok.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Invalid image format — allowed: jpg png webp'))
  },
})

/**
 * Delete from Cloudinary wrapped in circuit breaker
 */
async function deleteFile(publicId, resourceType = 'image') {
  return breakers.cloudinary.call(
    () => cloudinary.uploader.destroy(publicId, { resource_type: resourceType }),
    () => ({ result: 'skipped — circuit open' })
  )
}

module.exports = { uploadAudio, uploadImage, deleteFile, cloudinary }
