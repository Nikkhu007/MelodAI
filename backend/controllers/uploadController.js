const { cloudinary } = require('../config/cloudinary');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// POST /api/upload/audio
exports.uploadAudio = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No audio file uploaded' });
  res.json({
    success: true,
    url: req.file.path,
    publicId: req.file.filename,
    duration: req.file.duration || null,
  });
};

// POST /api/upload/image
exports.uploadImage = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No image uploaded' });
  res.json({
    success: true,
    url: req.file.path,
    publicId: req.file.filename,
  });
};

// DELETE /api/upload/:publicId
exports.deleteFile = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin only' });
  }
  try {
    await cloudinary.uploader.destroy(req.params.publicId, { resource_type: 'video' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
