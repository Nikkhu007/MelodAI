const mongoose = require('mongoose');

/**
 * ExternalSong — embedded doc for YouTube/Jamendo songs
 * These songs are NOT in our DB, so we store their metadata inline.
 */
const externalSongSchema = new mongoose.Schema({
  externalId:  { type: String, required: true }, // e.g. "yt_dQw4w9WgXcQ"
  title:       { type: String, default: '' },
  artist:      { type: String, default: '' },
  album:       { type: String, default: '' },
  duration:    { type: Number, default: 0 },
  audioUrl:    { type: String, default: '' },
  coverUrl:    { type: String, default: '' },
  genre:       { type: String, default: 'other' },
  mood:        { type: String, default: 'chill' },
  isYouTube:   { type: Boolean, default: false },
  isJamendo:   { type: Boolean, default: false },
  ytId:        { type: String, default: '' },
  jamendoUrl:  { type: String, default: '' },
}, { _id: false });

const playlistSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  description:{ type: String, default: '' },
  coverUrl:   { type: String, default: '' },
  owner:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // DB songs (MongoDB ObjectIds)
  songs:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'Song' }],

  // External songs (YouTube / Jamendo) stored as embedded docs
  externalSongs: [externalSongSchema],

  isPublic:           { type: Boolean, default: true },
  isAIGenerated:      { type: Boolean, default: false },
  aiGeneratedReason:  { type: String,  default: '' },
  followers:          [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  tags:               [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Playlist', playlistSchema);
