const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Audio storage
const audioStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    resource_type: 'video', // Cloudinary uses 'video' for audio
    folder: 'melodai/songs',
    allowed_formats: ['mp3', 'wav', 'ogg', 'flac', 'm4a'],
    transformation: [{ quality: 'auto' }],
  },
});

// Image storage (cover art)
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    resource_type: 'image',
    folder: 'melodai/covers',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'fill', quality: 'auto' }],
  },
});

const uploadAudio = multer({ storage: audioStorage, limits: { fileSize: 50 * 1024 * 1024 } });
const uploadImage = multer({ storage: imageStorage, limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = { cloudinary, uploadAudio, uploadImage };
