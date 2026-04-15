const Playlist = require('../models/Playlist');
const Song     = require('../models/Song');
const axios    = require('axios');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// GET /api/playlists
exports.getPlaylists = async (req, res) => {
  const { userId, myPlaylists } = req.query;
  const filter = {};

  if (myPlaylists && req.user) {
    filter.owner = req.user._id;
  } else if (userId) {
    filter.owner = userId;
    filter.isPublic = true;
  } else {
    filter.isPublic = true;
  }

  const playlists = await Playlist.find(filter)
    .populate('owner', 'username avatar')
    .populate('songs', 'title artist coverUrl duration audioUrl genre mood')
    .sort({ createdAt: -1 });

  res.json({ success: true, playlists });
};

// GET /api/playlists/:id
exports.getPlaylist = async (req, res) => {
  const playlist = await Playlist.findById(req.params.id)
    .populate('owner', 'username avatar')
    .populate('songs', 'title artist coverUrl duration audioUrl genre mood tempo energy');

  if (!playlist) return res.status(404).json({ success: false, message: 'Playlist not found' });

  const ownerId = playlist.owner?._id?.toString() || playlist.owner?.toString();
  const userId  = req.user?._id?.toString();
  if (!playlist.isPublic && ownerId !== userId) {
    return res.status(403).json({ success: false, message: 'Private playlist' });
  }
  res.json({ success: true, playlist });
};

// POST /api/playlists
exports.createPlaylist = async (req, res) => {
  const { name, description, isPublic, coverUrl } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name required' });

  const playlist = await Playlist.create({
    name: name.trim(), description, isPublic: isPublic !== false, coverUrl,
    owner: req.user._id,
  });
  res.status(201).json({ success: true, playlist });
};

// PUT /api/playlists/:id
exports.updatePlaylist = async (req, res) => {
  const playlist = await Playlist.findById(req.params.id);
  if (!playlist) return res.status(404).json({ success: false, message: 'Not found' });
  if (playlist.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  const updated = await Playlist.findByIdAndUpdate(req.params.id, req.body, { new: true })
    .populate('songs', 'title artist coverUrl duration audioUrl');
  res.json({ success: true, playlist: updated });
};

// DELETE /api/playlists/:id
exports.deletePlaylist = async (req, res) => {
  const playlist = await Playlist.findById(req.params.id);
  if (!playlist) return res.status(404).json({ success: false, message: 'Not found' });
  if (playlist.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  await playlist.deleteOne();
  res.json({ success: true, message: 'Playlist deleted' });
};

// POST /api/playlists/:id/songs — add song
exports.addSong = async (req, res) => {
  const { songId } = req.body;
  if (!songId) return res.status(400).json({ success: false, message: 'songId required' });

  const playlist = await Playlist.findById(req.params.id);
  if (!playlist) return res.status(404).json({ success: false, message: 'Not found' });
  if (playlist.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }

  // Prevent duplicates
  if (playlist.songs.map(s => s.toString()).includes(songId)) {
    return res.json({ success: true, message: 'Already in playlist' });
  }

  await Playlist.findByIdAndUpdate(req.params.id, { $addToSet: { songs: songId } });
  res.json({ success: true, message: 'Song added' });
};

// DELETE /api/playlists/:id/songs/:songId
exports.removeSong = async (req, res) => {
  const playlist = await Playlist.findById(req.params.id);
  if (!playlist) return res.status(404).json({ success: false, message: 'Not found' });
  if (playlist.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  await Playlist.findByIdAndUpdate(req.params.id, { $pull: { songs: req.params.songId } });
  res.json({ success: true, message: 'Song removed' });
};

/**
 * POST /api/playlists/ai-generate
 * If AI service is unavailable, falls back to picking songs from DB
 * based on mood + user genre preferences — so it ALWAYS works.
 */
exports.generateAIPlaylist = async (req, res) => {
  const { mood, name } = req.body;
  const user  = req.user;
  const moodToUse = mood || user.currentMood || 'chill';

  let songIds = [];
  let reason  = '';

  // Try AI service first
  try {
    const aiRes = await axios.post(`${AI_URL}/generate-playlist`, {
      user_id:    user._id.toString(),
      mood:       moodToUse,
      ai_profile: {
        genre_weights: Object.fromEntries(user.aiProfile?.genreWeights || new Map()),
        mood_weights:  Object.fromEntries(user.aiProfile?.moodWeights  || new Map()),
      },
      limit: 20,
    }, { timeout: 8000 });

    songIds = aiRes.data?.song_ids || [];
    reason  = aiRes.data?.reason   || '';
  } catch (aiErr) {
    console.log('AI service unavailable, using DB fallback for playlist generation');
  }

  // DB fallback — always works even without AI service
  if (!songIds.length) {
    const filter = { isPublic: true };
    if (moodToUse) filter.mood = moodToUse;

    // Get user's top genre if available
    const genreWeights = Object.fromEntries(user.aiProfile?.genreWeights || new Map());
    const topGenre = Object.entries(genreWeights).sort((a,b) => b[1]-a[1])[0]?.[0];

    let songs = await Song.find(filter).sort({ plays: -1, likes: -1 }).limit(30);

    // If mood filter returned no songs, remove it
    if (!songs.length) {
      songs = await Song.find({ isPublic: true }).sort({ plays: -1 }).limit(20);
    }

    // Prioritise user's favourite genre
    if (topGenre) {
      songs.sort((a, b) => (b.genre === topGenre ? 1 : 0) - (a.genre === topGenre ? 1 : 0));
    }

    songIds = songs.slice(0, 20).map(s => s._id);
    reason  = `${moodToUse.charAt(0).toUpperCase() + moodToUse.slice(1)} songs curated for you`;
    if (topGenre) reason += `, featuring your favourite ${topGenre} tracks`;
  }

  if (!songIds.length) {
    return res.status(404).json({ success: false, message: 'No songs found to generate playlist' });
  }

  const playlistName = name || `Your ${moodToUse.charAt(0).toUpperCase() + moodToUse.slice(1)} Mix`;
  const playlist = await Playlist.create({
    name:               playlistName,
    description:        reason || 'AI-curated just for you',
    owner:              user._id,
    songs:              songIds,
    isAIGenerated:      true,
    aiGeneratedReason:  reason,
    isPublic:           false,
  });

  await playlist.populate('songs', 'title artist coverUrl duration audioUrl genre mood');
  res.json({ success: true, playlist });
};
