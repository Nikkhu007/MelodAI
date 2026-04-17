/**
 * Upload Controller — v3
 * Audio + image uploads via Cloudinary with circuit breaker
 */
const AppError    = require('../utils/AppError')
const { deleteFile } = require('../config/cloudinary')

exports.uploadAudio = async (req, res, next) => {
  if (!req.file) return next(AppError.badRequest('No audio file provided'))
  res.status(201).json({
    success:  true,
    audioUrl: req.file.path,
    publicId: req.file.filename,
    size:     req.file.size,
    format:   req.file.format || req.file.mimetype,
  })
}

exports.uploadImage = async (req, res, next) => {
  if (!req.file) return next(AppError.badRequest('No image file provided'))
  res.status(201).json({
    success:  true,
    imageUrl: req.file.path,
    publicId: req.file.filename,
    width:    req.file.width,
    height:   req.file.height,
  })
}

exports.deleteUpload = async (req, res, next) => {
  const { publicId, type = 'image' } = req.body
  if (!publicId) return next(AppError.badRequest('publicId required'))
  const result = await deleteFile(publicId, type === 'audio' ? 'video' : 'image')
  res.json({ success: true, result })
}
