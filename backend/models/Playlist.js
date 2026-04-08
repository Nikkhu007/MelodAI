const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  coverUrl: { type: String, default: '' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  songs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],
  isPublic: { type: Boolean, default: true },
  isAIGenerated: { type: Boolean, default: false },
  aiGeneratedReason: { type: String, default: '' }, // e.g., "Based on your love of Indie Rock"
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  tags: [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Playlist', playlistSchema);
