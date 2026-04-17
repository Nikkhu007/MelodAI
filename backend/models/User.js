const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

const userSchema = new mongoose.Schema({
  username: {
    type:      String,
    required:  [true, 'Username required'],
    unique:    true,
    trim:      true,
    minlength: 3,
    maxlength: 30,
    index:     true,
  },
  email: {
    type:      String,
    required:  [true, 'Email required'],
    unique:    true,
    lowercase: true,
    match:     [/^\S+@\S+\.\S+$/, 'Invalid email'],
    index:     true,
  },
  password: {
    type:      String,
    required:  [true, 'Password required'],
    minlength: 6,
    select:    false,
  },
  avatar:  { type: String, default: '' },
  bio:     { type: String, default: '', maxlength: 200 },
  role:    { type: String, enum: ['user', 'admin'], default: 'user' },

  // Music
  likedSongs:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],
  followedPlaylists:[{ type: mongoose.Schema.Types.ObjectId, ref: 'Playlist' }],

  // Social
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // AI preference profile — updated on each listen event
  aiProfile: {
    genreWeights:    { type: Map, of: Number, default: {} },
    moodWeights:     { type: Map, of: Number, default: {} },
    tempoPreference: { type: Number, default: 120 },
    totalPlays:      { type: Number, default: 0 },
    lastUpdated:     { type: Date, default: Date.now },
  },

  currentMood: {
    type:    String,
    enum:    ['happy','sad','energetic','focus','chill','gym','romance', null],
    default: null,
  },

  // Account state
  isActive:   { type: Boolean, default: true },
  lastSeen:   { type: Date,    default: Date.now },

}, { timestamps: true })

// ── Indexes ────────────────────────────────────────────────────────────────
userSchema.index({ username: 'text' })

// ── Hooks ──────────────────────────────────────────────────────────────────
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

userSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password)
}

// Update AI profile on each listen event
userSchema.methods.updateAIProfile = function(song, event) {
  const weights = { play: 1, like: 5, complete: 2, repeat: 3, skip: -1 }
  const w = weights[event] ?? 1

  if (song.genre) {
    const cur = this.aiProfile.genreWeights.get(song.genre) || 0
    this.aiProfile.genreWeights.set(song.genre, Math.max(0, cur + w))
  }
  if (song.mood) {
    const cur = this.aiProfile.moodWeights.get(song.mood) || 0
    this.aiProfile.moodWeights.set(song.mood, Math.max(0, cur + w))
  }
  if (song.tempo && event !== 'skip') {
    const total = this.aiProfile.totalPlays || 1
    this.aiProfile.tempoPreference =
      (this.aiProfile.tempoPreference * total + song.tempo) / (total + 1)
  }
  if (event === 'play') this.aiProfile.totalPlays++
  this.aiProfile.lastUpdated = new Date()
}

// Virtual: follower count
userSchema.virtual('followerCount').get(function() {
  return this.followers?.length || 0
})

userSchema.set('toJSON', {
  virtuals: true,
  transform: (_, obj) => { delete obj.password; return obj },
})

module.exports = mongoose.model('User', userSchema)
