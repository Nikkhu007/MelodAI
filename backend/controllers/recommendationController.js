const axios = require('axios');
const Song = require('../models/Song');
const ListenEvent = require('../models/ListenEvent');
const User = require('../models/User');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * GET /api/recommendations/home
 * AI-personalized home feed — hybrid recommendations
 */
exports.getHomeFeed = async (req, res) => {
  const user = req.user;

  try {
    // Build user context for AI
    const recentEvents = await ListenEvent.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('song', '_id genre mood tempo');

    const listenedIds = [...new Set(recentEvents.map(e => e.song?._id?.toString()).filter(Boolean))];

    const aiRes = await axios.post(`${AI_URL}/recommend`, {
      user_id: user._id.toString(),
      ai_profile: {
        genre_weights: Object.fromEntries(user.aiProfile?.genreWeights || new Map()),
        mood_weights: Object.fromEntries(user.aiProfile?.moodWeights || new Map()),
        tempo_preference: user.aiProfile?.tempoPreference || 120,
      },
      listened_ids: listenedIds,
      current_mood: user.currentMood,
      limit: 30,
    });

    const songIds = aiRes.data?.recommendations || [];
    const songs = await Song.find({ _id: { $in: songIds } });

    // Preserve AI ranking order
    const ordered = songIds
      .map(id => songs.find(s => s._id.toString() === id))
      .filter(Boolean);

    res.json({ success: true, songs: ordered, source: 'ai-hybrid' });
  } catch (err) {
    console.error('AI recommend error:', err.message);
    // Graceful fallback: return trending songs
    const songs = await Song.find({ isPublic: true }).sort({ plays: -1 }).limit(20);
    res.json({ success: true, songs, source: 'fallback-trending' });
  }
};

/**
 * GET /api/recommendations/similar/:songId
 * Content-based: find songs similar to given song
 */
exports.getSimilar = async (req, res) => {
  const song = await Song.findById(req.params.songId);
  if (!song) return res.status(404).json({ success: false, message: 'Song not found' });

  try {
    const aiRes = await axios.post(`${AI_URL}/similar`, {
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
      limit: 10,
    });

    const songIds = aiRes.data?.similar || [];
    const songs = await Song.find({ _id: { $in: songIds } });
    const ordered = songIds.map(id => songs.find(s => s._id.toString() === id)).filter(Boolean);

    res.json({ success: true, songs: ordered });
  } catch (err) {
    // Fallback: same genre/mood
    const songs = await Song.find({
      _id: { $ne: song._id },
      $or: [{ genre: song.genre }, { mood: song.mood }],
      isPublic: true,
    }).limit(10);
    res.json({ success: true, songs, source: 'fallback' });
  }
};

/**
 * GET /api/recommendations/mood/:mood
 * Mood-based recommendations
 */
exports.getMoodRecommendations = async (req, res) => {
  const { mood } = req.params;
  const user = req.user;

  try {
    const aiRes = await axios.post(`${AI_URL}/mood-recommend`, {
      user_id: user._id.toString(),
      mood,
      ai_profile: {
        genre_weights: Object.fromEntries(user.aiProfile?.genreWeights || new Map()),
      },
      limit: 20,
    });

    const songIds = aiRes.data?.recommendations || [];
    const songs = await Song.find({ _id: { $in: songIds } });
    const ordered = songIds.map(id => songs.find(s => s._id.toString() === id)).filter(Boolean);
    res.json({ success: true, songs: ordered });
  } catch (err) {
    const songs = await Song.find({ mood, isPublic: true }).sort({ plays: -1 }).limit(20);
    res.json({ success: true, songs, source: 'fallback' });
  }
};

/**
 * GET /api/recommendations/search?q=query
 * AI-ranked search results
 */
exports.smartSearch = async (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'Query required' });

  // Text search first
  const textResults = await Song.find(
    { $text: { $search: q }, isPublic: true },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } }).limit(50);

  if (!textResults.length) {
    // Fuzzy fallback
    const regex = new RegExp(q.split(' ').join('|'), 'i');
    const fuzzy = await Song.find({
      $or: [{ title: regex }, { artist: regex }, { album: regex }],
      isPublic: true,
    }).limit(parseInt(limit));
    return res.json({ success: true, songs: fuzzy });
  }

  // Re-rank with AI if user is logged in
  if (req.user && textResults.length > 1) {
    try {
      const aiRes = await axios.post(`${AI_URL}/rank-search`, {
        user_id: req.user._id.toString(),
        query: q,
        candidate_ids: textResults.map(s => s._id.toString()),
        ai_profile: {
          genre_weights: Object.fromEntries(req.user.aiProfile?.genreWeights || new Map()),
          mood_weights: Object.fromEntries(req.user.aiProfile?.moodWeights || new Map()),
        },
      });

      if (aiRes.data?.ranked_ids) {
        const ranked = aiRes.data.ranked_ids
          .map(id => textResults.find(s => s._id.toString() === id))
          .filter(Boolean)
          .slice(0, parseInt(limit));
        return res.json({ success: true, songs: ranked, source: 'ai-ranked' });
      }
    } catch (_) {}
  }

  res.json({ success: true, songs: textResults.slice(0, parseInt(limit)) });
};
