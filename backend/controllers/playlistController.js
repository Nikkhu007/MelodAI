const Playlist = require('../models/Playlist');
const Song = require('../models/Song');
const axios = require('axios');

// GET /api/playlists
exports.getPlaylists = async (req, res) => {
  const { userId, myPlaylists } = req.query;
  const filter = { isPublic: true };

  if (myPlaylists && req.user) filter.owner = req.user._id;
  else if (userId) filter.owner = userId;

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
  if (!playlist.isPublic && playlist.owner._id.toString() !== req.user?._id?.toString()) {
    return res.status(403).json({ success: false, message: 'Private playlist' });
  }
  res.json({ success: true, playlist });
};

// POST /api/playlists
exports.createPlaylist = async (req, res) => {
  const { name, description, isPublic, coverUrl } = req.body;
  const playlist = await Playlist.create({
    name, description, isPublic, coverUrl,
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
  const playlist = await Playlist.findById(req.params.id);
  if (!playlist) return res.status(404).json({ success: false, message: 'Not found' });
  if (playlist.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  await Playlist.findByIdAndUpdate(req.params.id, { $addToSet: { songs: songId } });
  res.json({ success: true, message: 'Song added' });
};

// DELETE /api/playlists/:id/songs/:songId — remove song
exports.removeSong = async (req, res) => {
  const playlist = await Playlist.findById(req.params.id);
  if (!playlist) return res.status(404).json({ success: false, message: 'Not found' });
  if (playlist.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized' });
  }
  await Playlist.findByIdAndUpdate(req.params.id, { $pull: { songs: req.params.songId } });
  res.json({ success: true, message: 'Song removed' });
};

// POST /api/playlists/ai-generate — ask AI to create a playlist for user
exports.generateAIPlaylist = async (req, res) => {
  const { mood, name } = req.body;
  const user = req.user;

  try {
    // Ask AI service to pick songs
    const aiRes = await axios.post(`${process.env.AI_SERVICE_URL}/generate-playlist`, {
      user_id: user._id.toString(),
      mood: mood || user.currentMood,
      ai_profile: {
        genre_weights: Object.fromEntries(user.aiProfile?.genreWeights || new Map()),
        mood_weights: Object.fromEntries(user.aiProfile?.moodWeights || new Map()),
      },
      limit: 20,
    });

    const songIds = aiRes.data?.song_ids || [];
    if (!songIds.length) {
      return res.status(500).json({ success: false, message: 'AI could not generate playlist' });
    }

    const playlistName = name || `Your ${mood || 'Personalized'} Mix`;
    const playlist = await Playlist.create({
      name: playlistName,
      description: aiRes.data?.reason || 'AI-curated just for you',
      owner: user._id,
      songs: songIds,
      isAIGenerated: true,
      aiGeneratedReason: aiRes.data?.reason || '',
      isPublic: false,
    });

    await playlist.populate('songs', 'title artist coverUrl duration audioUrl');
    res.json({ success: true, playlist });
  } catch (err) {
    console.error('AI playlist generation error:', err.message);
    res.status(500).json({ success: false, message: 'AI service error' });
  }
};
