const axios        = require('axios');
const Song         = require('../models/Song');
const ListenEvent  = require('../models/ListenEvent');
const User         = require('../models/User');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Helper: always returns songs from DB regardless of AI availability
async function dbFallback(filter = {}, limit = 20) {
  return Song.find({ isPublic: true, ...filter }).sort({ plays: -1, likes: -1 }).limit(limit);
}

/**
 * GET /api/recommendations/home
 * Always returns songs. Uses AI when available, DB trending as fallback.
 */
exports.getHomeFeed = async (req, res) => {
  const user = req.user;

  // Get recent history
  const recentEvents = await ListenEvent.find({ user: user._id })
    .sort({ createdAt: -1 }).limit(50)
    .populate('song', '_id genre mood tempo');

  const listenedIds = [...new Set(
    recentEvents.map(e => e.song?._id?.toString()).filter(Boolean)
  )];

  // Try AI
  try {
    const aiRes = await axios.post(`${AI_URL}/recommend`, {
      user_id:    user._id.toString(),
      ai_profile: {
        genre_weights:     Object.fromEntries(user.aiProfile?.genreWeights || new Map()),
        mood_weights:      Object.fromEntries(user.aiProfile?.moodWeights  || new Map()),
        tempo_preference:  user.aiProfile?.tempoPreference || 120,
      },
      listened_ids:  listenedIds,
      current_mood:  user.currentMood,
      limit:         30,
    }, { timeout: 8000 });

    const songIds = aiRes.data?.recommendations || [];
    if (songIds.length) {
      const songs   = await Song.find({ _id: { $in: songIds } });
      const ordered = songIds.map(id => songs.find(s => s._id.toString() === id)).filter(Boolean);
      if (ordered.length) return res.json({ success: true, songs: ordered, source: 'ai-hybrid' });
    }
  } catch (_) {}

  // DB fallback — personalised by mood/genre weights
  const genreWeights = Object.fromEntries(user.aiProfile?.genreWeights || new Map());
  const topGenre     = Object.entries(genreWeights).sort((a,b) => b[1]-a[1])[0]?.[0];
  const moodFilter   = user.currentMood ? { mood: user.currentMood } : {};

  let songs = await Song.find({ isPublic: true, ...moodFilter })
    .sort({ plays: -1, likes: -1 }).limit(30);

  if (!songs.length) songs = await dbFallback({}, 20);

  // Sort: prefer user's top genre
  if (topGenre) {
    songs = [...songs].sort((a,b) => (b.genre === topGenre ? 1 : 0) - (a.genre === topGenre ? 1 : 0));
  }

  res.json({ success: true, songs, source: 'db-personalised' });
};

/**
 * GET /api/recommendations/similar/:songId
 */
exports.getSimilar = async (req, res) => {
  const song = await Song.findById(req.params.songId);
  if (!song) return res.status(404).json({ success: false, message: 'Song not found' });

  try {
    const aiRes = await axios.post(`${AI_URL}/similar`, {
      song_id:  song._id.toString(),
      features: { genre: song.genre, mood: song.mood, tempo: song.tempo, energy: song.energy,
                  valence: song.valence, acousticness: song.acousticness, danceability: song.danceability, tags: song.tags },
      limit: 10,
    }, { timeout: 8000 });

    const songIds = aiRes.data?.similar || [];
    if (songIds.length) {
      const songs   = await Song.find({ _id: { $in: songIds } });
      const ordered = songIds.map(id => songs.find(s => s._id.toString() === id)).filter(Boolean);
      if (ordered.length) return res.json({ success: true, songs: ordered });
    }
  } catch (_) {}

  const songs = await Song.find({
    _id: { $ne: song._id }, isPublic: true,
    $or: [{ genre: song.genre }, { mood: song.mood }],
  }).limit(10);
  res.json({ success: true, songs, source: 'fallback' });
};

/**
 * GET /api/recommendations/mood/:mood
 * Returns songs matching mood from DB — works without AI service.
 * Also fetches YouTube suggestions via yt-dlp if available.
 */
exports.getMoodRecommendations = async (req, res) => {
  const { mood }  = req.params;
  const user      = req.user;
  const validMoods = ['happy','sad','energetic','focus','chill','gym','romance'];

  if (!validMoods.includes(mood)) {
    return res.status(400).json({ success: false, message: 'Invalid mood' });
  }

  // Try AI first
  try {
    const aiRes = await axios.post(`${AI_URL}/mood-recommend`, {
      user_id:    user._id.toString(),
      mood,
      ai_profile: { genre_weights: Object.fromEntries(user.aiProfile?.genreWeights || new Map()) },
      limit:      20,
    }, { timeout: 8000 });

    const songIds = aiRes.data?.recommendations || [];
    if (songIds.length) {
      const songs   = await Song.find({ _id: { $in: songIds } });
      const ordered = songIds.map(id => songs.find(s => s._id.toString() === id)).filter(Boolean);
      if (ordered.length) return res.json({ success: true, songs: ordered, source: 'ai' });
    }
  } catch (_) {}

  // DB fallback — direct mood query always works
  const songs = await Song.find({ mood, isPublic: true })
    .sort({ plays: -1, likes: -1 }).limit(20);

  // If still no DB songs for this mood, return general trending
  if (!songs.length) {
    const fallback = await dbFallback({}, 15);
    return res.json({ success: true, songs: fallback, source: 'trending-fallback' });
  }

  res.json({ success: true, songs, source: 'db-mood' });
};

/**
 * GET /api/recommendations/search?q=...
 */
exports.smartSearch = async (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'Query required' });

  const textResults = await Song.find(
    { $text: { $search: q }, isPublic: true },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } }).limit(50);

  if (!textResults.length) {
    const regex  = new RegExp(q.split(' ').join('|'), 'i');
    const fuzzy  = await Song.find({
      $or: [{ title: regex }, { artist: regex }, { album: regex }], isPublic: true,
    }).limit(parseInt(limit));
    return res.json({ success: true, songs: fuzzy });
  }

  if (req.user && textResults.length > 1) {
    try {
      const aiRes = await axios.post(`${AI_URL}/rank-search`, {
        user_id:    req.user._id.toString(),
        query:      q,
        candidate_ids: textResults.map(s => s._id.toString()),
        ai_profile: {
          genre_weights: Object.fromEntries(req.user.aiProfile?.genreWeights || new Map()),
          mood_weights:  Object.fromEntries(req.user.aiProfile?.moodWeights  || new Map()),
        },
      }, { timeout: 6000 });

      if (aiRes.data?.ranked_ids) {
        const ranked = aiRes.data.ranked_ids
          .map(id => textResults.find(s => s._id.toString() === id))
          .filter(Boolean).slice(0, parseInt(limit));
        return res.json({ success: true, songs: ranked, source: 'ai-ranked' });
      }
    } catch (_) {}
  }

  res.json({ success: true, songs: textResults.slice(0, parseInt(limit)) });
};
