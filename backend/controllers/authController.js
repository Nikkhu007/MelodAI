const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// POST /api/auth/register
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { username, email, password } = req.body;

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    return res.status(400).json({
      success: false,
      message: existing.email === email ? 'Email already in use' : 'Username taken',
    });
  }

  const user = await User.create({ username, email, password });
  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    token,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
    },
  });
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password required' });
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = generateToken(user._id);
  res.json({
    success: true,
    token,
    user: {
      _id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      currentMood: user.currentMood,
    },
  });
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('likedSongs', 'title artist coverUrl duration audioUrl genre mood')
    .select('-password');
  res.json({ success: true, user });
};

// PUT /api/auth/mood
exports.setMood = async (req, res) => {
  const { mood } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { currentMood: mood },
    { new: true }
  );
  res.json({ success: true, mood: user.currentMood });
};
