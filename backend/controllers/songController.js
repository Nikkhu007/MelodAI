const Song         = require('../models/Song');
const User         = require('../models/User');
const ListenEvent  = require('../models/ListenEvent');
const axios        = require('axios');

// GET /api/songs
exports.getSongs = async (req, res) => {
  const page   = parseInt(req.query.page)  || 1;
  const limit  = parseInt(req.query.limit) || 20;
  const skip   = (page - 1) * limit;
  const { genre, mood, search } = req.query;

  const filter = { isPublic: true };
  if (genre)  filter.genre = genre;
  if (mood)   filter.mood  = mood;
  if (search) filter.$text = { $search: search };

  const [songs, total] = await Promise.all([
    Song.find(filter)
      .sort(search ? { score: { $meta: 'textScore' } } : { plays: -1 })
      .skip(skip).limit(limit)
      .populate('uploadedBy', 'username'),
    Song.countDocuments(filter),
  ]);

  res.json({ success: true, songs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

// GET /api/songs/trending
exports.getTrending = async (req, res) => {
  const songs = await Song.find({ isPublic: true }).sort({ plays: -1, likes: -1 }).limit(20);
  res.json({ success: true, songs });
};

// GET /api/songs/:id
exports.getSong = async (req, res) => {
  const song = await Song.findById(req.params.id).populate('uploadedBy', 'username avatar');
  if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
  res.json({ success: true, song });
};

// POST /api/songs
exports.createSong = async (req, res) => {
  const { title, artist, album, duration, audioUrl, coverUrl, genre, mood,
          tempo, energy, valence, acousticness, danceability, tags, releaseYear } = req.body;

  const song = await Song.create({
    title, artist, album, duration, audioUrl, coverUrl,
    genre, mood, tempo, energy, valence, acousticness, danceability,
    tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
    releaseYear, uploadedBy: req.user._id,
  });

  generateEmbedding(song._id).catch(console.error);
  res.status(201).json({ success: true, song });
};

// PUT /api/songs/:id
exports.updateSong = async (req, res) => {
  const song = await Song.findById(req.params.id);
  if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
  if (song.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  const updated = await Song.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  res.json({ success: true, song: updated });
};

// DELETE /api/songs/:id
exports.deleteSong = async (req, res) => {
  const song = await Song.findById(req.params.id);
  if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
  if (song.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  await song.deleteOne();
  res.json({ success: true, message: 'Song deleted' });
};

/**
 * POST /api/songs/:id/event
 * Tracks play/like/unlike/skip/repeat/complete events.
 * Works for both DB songs AND YouTube/Jamendo songs (stored transiently).
 */
exports.trackEvent = async (req, res) => {
  const { event, progress, listenDuration, source, sessionId, songMeta } = req.body;

  // For external songs (YouTube/Jamendo) not in our DB,
  // we still record the event but skip DB song stat updates
  const isExternalSong = req.params.id.startsWith('yt_') ||
                         req.params.id.startsWith('jamendo_') ||
                         req.params.id.startsWith('itunes_');

  let song = null;
  if (!isExternalSong) {
    song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
  }

  // Record listen event for AI training
  await ListenEvent.create({
    user:          req.user._id,
    song:          isExternalSong ? undefined : req.params.id,
    externalId:    isExternalSong ? req.params.id : undefined,
    event,
    progress:      progress      || 0,
    listenDuration: listenDuration || 0,
    source:        source        || 'player',
    mood:          req.user.currentMood,
    sessionId,
  }).catch(() => {}); // Don't fail the request if event storage fails

  // Update song stats (DB songs only)
  if (song) {
    const updates = {};
    if (event === 'play')    updates.$inc = { plays: 1 };
    if (event === 'like')    updates.$inc = { likes: 1 };
    if (event === 'unlike')  updates.$inc = { likes: -1 };
    if (event === 'skip')    updates.$inc = { skips: 1 };
    if (Object.keys(updates).length) {
      await Song.findByIdAndUpdate(req.params.id, updates);
    }
  }

  // Update user AI profile
  const user = await User.findById(req.user._id);
  if (user) {
    // For external songs use metadata passed from frontend
    const songForProfile = song || songMeta || {
      genre: 'other', mood: req.user.currentMood || 'chill', tempo: 120
    };
    user.updateAIProfile(songForProfile, event);
    await user.save().catch(() => {});
  }

  // Update liked songs list
  if (event === 'like' && song) {
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { likedSongs: song._id } });
  }
  if (event === 'unlike' && song) {
    await User.findByIdAndUpdate(req.user._id, { $pull:    { likedSongs: song._id } });
  }

  res.json({ success: true });
};

async function generateEmbedding(songId) {
  try {
    const song = await Song.findById(songId);
    if (!song) return;
    const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const response = await axios.post(`${AI_URL}/embed`, {
      song_id:  song._id.toString(),
      features: { genre: song.genre, mood: song.mood, tempo: song.tempo,
                  energy: song.energy, valence: song.valence,
                  acousticness: song.acousticness, danceability: song.danceability, tags: song.tags },
    }, { timeout: 10000 });
    if (response.data?.embedding) {
      await Song.findByIdAndUpdate(songId, { embedding: response.data.embedding });
    }
  } catch (_) {}
}
