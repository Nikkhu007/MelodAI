const express = require('express');
const { protect } = require('../middleware/auth');
const { uploadAudio: multerAudio, uploadImage: multerImage } = require('../config/cloudinary');
const { uploadAudio, uploadImage, deleteFile } = require('../controllers/uploadController');

const router = express.Router();

router.post('/audio', protect, multerAudio.single('audio'), uploadAudio);
router.post('/image', protect, multerImage.single('image'), uploadImage);
router.delete('/:publicId', protect, deleteFile);

module.exports = router;
