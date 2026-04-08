const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, setMood } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username 3-30 chars'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
], register);

router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/mood', protect, setMood);

module.exports = router;
