const mongoose = require('mongoose');

/**
 * ListenEvent — the raw behavioral data feed for the AI recommendation engine.
 * Every user action (play, skip, like, repeat) is stored here.
 * The AI service reads this collection to train/update collaborative filtering models.
 */
const listenEventSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true, index: true },
  event: {
    type: String,
    enum: ['play', 'skip', 'like', 'unlike', 'repeat', 'complete'],
    required: true,
  },
  // How far into the song when event occurred (0-1)
  progress: { type: Number, default: 0 },
  // Duration listened in seconds
  listenDuration: { type: Number, default: 0 },
  // Context: what triggered this play
  source: {
    type: String,
    enum: ['search', 'recommendation', 'playlist', 'artist', 'mood', 'direct'],
    default: 'direct',
  },
  mood: { type: String, default: null }, // user's active mood when event occurred
  sessionId: { type: String, default: null },
}, { timestamps: true });

// Compound index for fast user history lookups
listenEventSchema.index({ user: 1, createdAt: -1 });
listenEventSchema.index({ user: 1, song: 1 });

module.exports = mongoose.model('ListenEvent', listenEventSchema);
