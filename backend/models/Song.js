const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, index: true },
  artist: { type: String, required: true, trim: true, index: true },
  album: { type: String, default: 'Single' },
  duration: { type: Number, required: true }, // seconds
  audioUrl: { type: String, required: true },
  coverUrl: { type: String, default: '' },
  cloudinaryPublicId: { type: String },

  // Metadata for AI
  genre: {
    type: String,
    enum: ['pop', 'rock', 'hiphop', 'rnb', 'electronic', 'classical', 'jazz', 'indie', 'metal', 'country', 'latin', 'folk', 'ambient', 'other'],
    default: 'other',
    index: true,
  },
  mood: {
    type: String,
    enum: ['happy', 'sad', 'energetic', 'focus', 'chill', 'gym', 'romance'],
    default: 'chill',
    index: true,
  },
  tempo: { type: Number, default: 120 },       // BPM
  energy: { type: Number, default: 0.5 },      // 0-1
  valence: { type: Number, default: 0.5 },     // 0-1 (musical positivity)
  acousticness: { type: Number, default: 0.5 },
  danceability: { type: Number, default: 0.5 },
  tags: [{ type: String }],

  // AI embedding vector (stored after AI service processes the song)
  embedding: [{ type: Number }],

  // Engagement stats
  plays: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  skips: { type: Number, default: 0 },

  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPublic: { type: Boolean, default: true },
  releaseYear: { type: Number, default: () => new Date().getFullYear() },
}, { timestamps: true });

// Text search index
songSchema.index({ title: 'text', artist: 'text', album: 'text', tags: 'text' });

// Virtual: engagement score (used in smart ranking)
songSchema.virtual('engagementScore').get(function () {
  const total = this.plays + 1;
  return (this.likes * 3 - this.skips * 0.5) / total;
});

songSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Song', songSchema);
