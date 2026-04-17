/**
 * Input validation — v3 fixed
 *
 * KEY FIX: Removed normalizeEmail() from login validator.
 * normalizeEmail() transforms gmail.com → googlemail.com, strips dots, etc.
 * This caused saved emails to not match on login.
 * We only lowercase the email — no other transformation.
 */
const { body, query, param, validationResult } = require('express-validator')

const check = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,   // show first error clearly
      errors:  errors.array().map(e => ({ field: e.path, message: e.msg })),
    })
  }
  next()
}

const rules = {
  register: [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be 3–30 characters')
      .matches(/^[a-zA-Z0-9_. ]+$/)
      .withMessage('Username can only contain letters, numbers, spaces, underscores and dots'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email required')
      .customSanitizer(v => v.toLowerCase().trim()),  // ONLY lowercase, no normalizeEmail
    body('password')
      .isLength({ min: 6, max: 128 })
      .withMessage('Password must be 6–128 characters'),
  ],

  login: [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email required')
      .customSanitizer(v => v.toLowerCase().trim()),  // ONLY lowercase, no normalizeEmail
    body('password')
      .notEmpty()
      .withMessage('Password required'),
  ],

  createSong: [
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title required'),
    body('artist').trim().isLength({ min: 1, max: 100 }).withMessage('Artist required'),
    body('duration').isNumeric().withMessage('Duration must be a number'),
    body('audioUrl').notEmpty().withMessage('Audio URL required'),
    body('genre').optional().isIn(['pop','rock','hiphop','rnb','electronic','classical',
      'jazz','indie','metal','country','latin','folk','ambient','other','bollywood','punjabi']),
    body('mood').optional().isIn(['happy','sad','energetic','focus','chill','gym','romance']),
    body('tempo').optional().isFloat({ min: 40, max: 250 }),
    body('energy').optional().isFloat({ min: 0, max: 1 }),
    body('valence').optional().isFloat({ min: 0, max: 1 }),
  ],

  createPlaylist: [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Playlist name required'),
    body('description').optional().isLength({ max: 500 }),
  ],

  pagination: [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],

  objectId: (field = 'id') => [
    param(field).isMongoId().withMessage(`Invalid ${field}`),
  ],

  mood: [
    body('mood')
      .isIn(['happy','sad','energetic','focus','chill','gym','romance'])
      .withMessage('Invalid mood'),
  ],
}

module.exports = { check, rules }
