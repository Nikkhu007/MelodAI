const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false,
  },
  avatar: {
    type: String,
    default: '',
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  likedSongs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],
  followedPlaylists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Playlist' }],

  // AI profile: aggregated preference vector updated on each listen event
  aiProfile: {
    genreWeights: {
      type: Map,
      of: Number,
      default: {},
    },
    moodWeights: {
      type: Map,
      of: Number,
      default: {},
    },
    tempoPreference: { type: Number, default: 120 }, // avg BPM preference
    totalPlays: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
  },

  currentMood: {
    type: String,
    enum: ['happy', 'sad', 'energetic', 'focus', 'chill', 'gym', 'romance', null],
    default: null,
  },
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Update AI profile based on a listen event
userSchema.methods.updateAIProfile = function (song, event) {
  const weights = { play: 1, like: 3, repeat: 2, skip: -1 };
  const w = weights[event] || 1;

  // Update genre weight
  if (song.genre) {
    const current = this.aiProfile.genreWeights.get(song.genre) || 0;
    this.aiProfile.genreWeights.set(song.genre, current + w);
  }

  // Update mood weight
  if (song.mood) {
    const current = this.aiProfile.moodWeights.get(song.mood) || 0;
    this.aiProfile.moodWeights.set(song.mood, current + w);
  }

  // Update tempo preference (rolling average)
  if (song.tempo && event !== 'skip') {
    const total = this.aiProfile.totalPlays || 1;
    this.aiProfile.tempoPreference =
      (this.aiProfile.tempoPreference * total + song.tempo) / (total + 1);
  }

  if (event === 'play') this.aiProfile.totalPlays += 1;
  this.aiProfile.lastUpdated = new Date();
};

module.exports = mongoose.model('User', userSchema);
