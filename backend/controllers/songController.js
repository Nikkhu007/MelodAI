const Song = require('../models/Song');
const User = require('../models/User');
const ListenEvent = require('../models/ListenEvent');
const axios = require('axios');

// GET /api/songs — paginated list with optional filters
exports.getSongs = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const { genre, mood, search } = req.query;

  const filter = { isPublic: true };
  if (genre) filter.genre = genre;
  if (mood) filter.mood = mood;
  if (search) filter.$text = { $search: search };

  const [songs, total] = await Promise.all([
    Song.find(filter)
      .sort(search ? { score: { $meta: 'textScore' } } : { plays: -1 })
      .skip(skip)
      .limit(limit)
      .populate('uploadedBy', 'username'),
    Song.countDocuments(filter),
  ]);

  res.json({
    success: true,
    songs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

// GET /api/songs/:id
exports.getSong = async (req, res) => {
  const song = await Song.findById(req.params.id).populate('uploadedBy', 'username avatar');
  if (!song) return res.status(404).json({ success: false, message: 'Song not found' });
  res.json({ success: true, song });
};

// POST /api/songs — admin/user uploads (audio already uploaded via /upload route)
exports.createSong = async (req, res) => {
  const { title, artist, album, duration, audioUrl, coverUrl, genre, mood, tempo, energy, valence, acousticness, danceability, tags, releaseYear } = req.body;

  const song = await Song.create({
    title, artist, album, duration, audioUrl, coverUrl,
    genre, mood, tempo, energy, valence, acousticness, danceability,
    tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
    releaseYear,
    uploadedBy: req.user._id,
  });

  // Async: send to AI service to generate embedding
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
  generateEmbedding(updated._id).catch(console.error); // Re-embed on update
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

// POST /api/songs/:id/event — track user behavior (the AI data feed)
exports.trackEvent = async (req, res) => {
  const { event, progress, listenDuration, source, sessionId } = req.body;
  const song = await Song.findById(req.params.id);
  if (!song) return res.status(404).json({ success: false, message: 'Song not found' });

  // Record the event
  await ListenEvent.create({
    user: req.user._id,
    song: song._id,
    event,
    progress: progress || 0,
    listenDuration: listenDuration || 0,
    source: source || 'direct',
    mood: req.user.currentMood,
    sessionId,
  });

  // Update song global stats
  if (event === 'play') await Song.findByIdAndUpdate(song._id, { $inc: { plays: 1 } });
  if (event === 'like') await Song.findByIdAndUpdate(song._id, { $inc: { likes: 1 } });
  if (event === 'unlike') await Song.findByIdAndUpdate(song._id, { $inc: { likes: -1 } });
  if (event === 'skip') await Song.findByIdAndUpdate(song._id, { $inc: { skips: 1 } });

  // Update user AI profile (in-memory fast update, async save)
  const user = await User.findById(req.user._id);
  user.updateAIProfile(song, event);
  await user.save();

  // Like: also add/remove from likedSongs
  if (event === 'like') {
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { likedSongs: song._id } });
  }
  if (event === 'unlike') {
    await User.findByIdAndUpdate(req.user._id, { $pull: { likedSongs: song._id } });
  }

  res.json({ success: true });
};

// GET /api/songs/trending
exports.getTrending = async (req, res) => {
  const songs = await Song.find({ isPublic: true })
    .sort({ plays: -1, likes: -1 })
    .limit(20);
  res.json({ success: true, songs });
};

// Helper: send song to AI service for embedding generation
async function generateEmbedding(songId) {
  try {
    const song = await Song.findById(songId);
    if (!song) return;

    const response = await axios.post(`${process.env.AI_SERVICE_URL}/embed`, {
      song_id: song._id.toString(),
      features: {
        genre: song.genre,
        mood: song.mood,
        tempo: song.tempo,
        energy: song.energy,
        valence: song.valence,
        acousticness: song.acousticness,
        danceability: song.danceability,
        tags: song.tags,
      },
    });

    if (response.data?.embedding) {
      await Song.findByIdAndUpdate(songId, { embedding: response.data.embedding });
    }
  } catch (err) {
    console.error('Embedding generation failed:', err.message);
  }
}
