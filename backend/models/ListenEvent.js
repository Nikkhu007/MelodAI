const mongoose = require('mongoose');

const listenEventSchema = new mongoose.Schema({
  user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // DB song ref (null for YouTube/Jamendo songs)
  song:           { type: mongoose.Schema.Types.ObjectId, ref: 'Song', default: null },
  // External song ID (e.g. yt_dQw4w9WgXcQ, jamendo_123)
  externalId:     { type: String, default: null },
  event: {
    type: String,
    enum: ['play','skip','like','unlike','repeat','complete'],
    required: true,
  },
  progress:       { type: Number, default: 0 },
  listenDuration: { type: Number, default: 0 },
  source: {
    type: String,
    enum: ['search','recommendation','playlist','artist','mood','player','direct'],
    default: 'player',
  },
  mood:       { type: String, default: null },
  sessionId:  { type: String, default: null },
}, { timestamps: true });

listenEventSchema.index({ user: 1, createdAt: -1 });
listenEventSchema.index({ user: 1, song: 1 });

module.exports = mongoose.model('ListenEvent', listenEventSchema);
