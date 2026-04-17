/**
 * Song Model — v3
 *
 * Additions over v2:
 *  - bollywood/punjabi genres
 *  - reactions map (emoji counters)
 *  - reportCount (community moderation)
 *  - language field
 *  - Compound indexes for common query patterns
 *  - Engagement score as a stored field (updated by trackEvent)
 */
const mongoose = require('mongoose')

const GENRES = [
  'pop','rock','hiphop','rnb','electronic','classical','jazz',
  'indie','metal','country','latin','folk','ambient',
  'bollywood','punjabi','other',
]
const MOODS = ['happy','sad','energetic','focus','chill','gym','romance']

const songSchema = new mongoose.Schema({
  title:  { type: String, required: true, trim: true, maxlength: 200 },
  artist: { type: String, required: true, trim: true, maxlength: 100 },
  album:  { type: String, default: 'Single', maxlength: 200 },

  duration:  { type: Number, required: true, min: 1 },  // seconds
  audioUrl:  { type: String, required: true },
  coverUrl:  { type: String, default: '' },
  cloudinaryPublicId: { type: String },

  lang:      { type: String, default: 'en', maxlength: 10 },  // renamed from 'language' (MongoDB reserved)

  // AI metadata
  genre:        { type: String, enum: GENRES, default: 'other', index: true },
  mood:         { type: String, enum: MOODS,  default: 'chill', index: true },
  tempo:        { type: Number, default: 120, min: 40, max: 250 },
  energy:       { type: Number, default: 0.5, min: 0, max: 1 },
  valence:      { type: Number, default: 0.5, min: 0, max: 1 },
  acousticness: { type: Number, default: 0.5, min: 0, max: 1 },
  danceability: { type: Number, default: 0.5, min: 0, max: 1 },
  tags:         [{ type: String, maxlength: 50 }],
  embedding:    [{ type: Number }],

  // Engagement stats
  plays:         { type: Number, default: 0, min: 0 },
  likes:         { type: Number, default: 0, min: 0 },
  skips:         { type: Number, default: 0, min: 0 },
  shares:        { type: Number, default: 0, min: 0 },
  completions:   { type: Number, default: 0, min: 0 },

  // Emoji reactions: { '🔥': 12, '❤️': 5 }
  reactions:     { type: Map, of: Number, default: {} },

  // Community moderation
  reportCount:   { type: Number, default: 0 },
  isReported:    { type: Boolean, default: false },

  // Computed engagement score — updated on trackEvent for DB-side sorting
  engagementScore: { type: Number, default: 0, index: true },

  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  isPublic:   { type: Boolean, default: true, index: true },
  releaseYear:{ type: Number, default: () => new Date().getFullYear() },

}, { timestamps: true })

// ── Text search index ────────────────────────────────────────────────────────
songSchema.index(
  { title: 'text', artist: 'text', album: 'text', tags: 'text' },
  { weights: { title: 10, artist: 5, album: 2, tags: 1 }, name: 'song_text' }
)

// ── Compound indexes for common query patterns ───────────────────────────────
songSchema.index({ isPublic: 1, genre: 1, plays: -1 })      // genre browse
songSchema.index({ isPublic: 1, mood:  1, plays: -1 })      // mood browse
songSchema.index({ isPublic: 1, engagementScore: -1 })       // smart sort
songSchema.index({ isPublic: 1, createdAt: -1 })             // newest
songSchema.index({ artist: 1, isPublic: 1 })                 // artist page

// ── Virtual: formatted duration ──────────────────────────────────────────────
songSchema.virtual('durationFormatted').get(function() {
  const m = Math.floor(this.duration / 60)
  const s = String(Math.floor(this.duration % 60)).padStart(2, '0')
  return `${m}:${s}`
})

// ── Static method: recalculate engagementScore ───────────────────────────────
songSchema.statics.recalcEngagement = async function(songId) {
  const s = await this.findById(songId)
  if (!s) return
  const score = (s.likes * 3 + s.completions * 2 + s.shares * 2 - s.skips * 0.5) / Math.max(s.plays + 1, 1)
  await this.updateOne({ _id: songId }, { engagementScore: Math.max(0, score) })
}

songSchema.set('toJSON', { virtuals: true })

module.exports = mongoose.model('Song', songSchema)
