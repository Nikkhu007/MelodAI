const Playlist = require('../models/Playlist');
const Song     = require('../models/Song');
const axios    = require('axios');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Determine if a song ID is external (YouTube / Jamendo)
 * vs a MongoDB ObjectId.
 */
function isExternalId(id) {
  return typeof id === 'string' && (
    id.startsWith('yt_') ||
    id.startsWith('jamendo_') ||
    id.startsWith('itunes_')
  )
}

/**
 * Merge DB songs + external songs into one ordered array for the client.
 * Both arrays are combined and sorted by their insertion order.
 */
async function buildSongList(playlist) {
  // Populate DB songs
  const dbSongs = await Song.find({ _id: { $in: playlist.songs } })
    .select('title artist coverUrl duration audioUrl genre mood tempo energy')
    .lean()

  // Map DB songs preserving order
  const dbMap = {}
  dbSongs.forEach(s => { dbMap[s._id.toString()] = s })
  const orderedDb = playlist.songs
    .map(id => dbMap[id.toString()])
    .filter(Boolean)

  // External songs — reconstruct audioUrl for YouTube
  const orderedExternal = (playlist.externalSongs || []).map(s => {
    const song = { ...s }
    if (song.isYouTube && song.ytId && !song.audioUrl) {
      song.audioUrl = `/api/youtube/stream/${song.ytId}`
    }
    song._id = song.externalId   // give it an _id for the frontend
    return song
  })

  // Combine: DB songs first, then external (playlists are append-ordered)
  return [...orderedDb, ...orderedExternal]
}

// GET /api/playlists
exports.getPlaylists = async (req, res) => {
  const { userId, myPlaylists } = req.query
  const filter = {}

  if (myPlaylists && req.user) filter.owner = req.user._id
  else if (userId)             { filter.owner = userId; filter.isPublic = true }
  else                         filter.isPublic = true

  const playlists = await Playlist.find(filter)
    .populate('owner', 'username avatar')
    .populate('songs', 'title artist coverUrl duration audioUrl genre mood')
    .sort({ createdAt: -1 })
    .lean()

  // Attach externalSongs count to each playlist
  const withCounts = playlists.map(pl => ({
    ...pl,
    totalSongs: (pl.songs?.length || 0) + (pl.externalSongs?.length || 0),
  }))

  res.json({ success: true, playlists: withCounts })
}

// GET /api/playlists/:id
exports.getPlaylist = async (req, res) => {
  const playlist = await Playlist.findById(req.params.id)
    .populate('owner', 'username avatar')
    .lean()

  if (!playlist) return res.status(404).json({ success: false, message: 'Playlist not found' })

  const ownerId = playlist.owner?._id?.toString() || playlist.owner?.toString()
  if (!playlist.isPublic && ownerId !== req.user?._id?.toString()) {
    return res.status(403).json({ success: false, message: 'Private playlist' })
  }

  const songs = await buildSongList(playlist)
  res.json({ success: true, playlist: { ...playlist, songs } })
}

// POST /api/playlists
exports.createPlaylist = async (req, res) => {
  const { name, description, isPublic, coverUrl } = req.body
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name required' })

  const playlist = await Playlist.create({
    name: name.trim(), description, isPublic: isPublic !== false, coverUrl,
    owner: req.user._id,
  })
  res.status(201).json({ success: true, playlist })
}

// PUT /api/playlists/:id
exports.updatePlaylist = async (req, res) => {
  const playlist = await Playlist.findById(req.params.id)
  if (!playlist) return res.status(404).json({ success: false, message: 'Not found' })
  if (playlist.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' })
  }
  const updated = await Playlist.findByIdAndUpdate(req.params.id, req.body, { new: true })
  res.json({ success: true, playlist: updated })
}

// DELETE /api/playlists/:id
exports.deletePlaylist = async (req, res) => {
  const playlist = await Playlist.findById(req.params.id)
  if (!playlist) return res.status(404).json({ success: false, message: 'Not found' })
  if (playlist.owner.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Not authorized' })
  }
  await playlist.deleteOne()
  res.json({ success: true, message: 'Playlist deleted' })
}

/**
 * POST /api/playlists/:id/songs
 * Accepts BOTH MongoDB ObjectId songs (from DB) AND external songs
 * (YouTube / Jamendo). External songs pass their full metadata in
 * `songData` so we can store them without a DB record.
 */
exports.addSong = async (req, res) => {
  const { songId, songData } = req.body

  if (!songId) return res.status(400).json({ success: false, message: 'songId required' })

  const playlist = await Playlist.findById(req.params.id)
  if (!playlist) return res.status(404).json({ success: false, message: 'Playlist not found' })
  if (playlist.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized' })
  }

  if (isExternalId(songId)) {
    // External song (YouTube / Jamendo) — store metadata inline
    const alreadyAdded = playlist.externalSongs.some(s => s.externalId === songId)
    if (alreadyAdded) return res.json({ success: true, message: 'Already in playlist' })

    const meta = songData || {}
    await Playlist.findByIdAndUpdate(req.params.id, {
      $push: {
        externalSongs: {
          externalId: songId,
          title:      meta.title    || '',
          artist:     meta.artist   || '',
          album:      meta.album    || '',
          duration:   meta.duration || 0,
          audioUrl:   meta.audioUrl || '',
          coverUrl:   meta.coverUrl || '',
          genre:      meta.genre    || 'other',
          mood:       meta.mood     || 'chill',
          isYouTube:  meta.isYouTube  || songId.startsWith('yt_'),
          isJamendo:  meta.isJamendo  || songId.startsWith('jamendo_'),
          ytId:       meta.ytId      || (songId.startsWith('yt_') ? songId.replace('yt_', '') : ''),
          jamendoUrl: meta.jamendoUrl || '',
        },
      },
    })
  } else {
    // DB song — just add ObjectId
    const alreadyAdded = playlist.songs.map(s => s.toString()).includes(songId)
    if (alreadyAdded) return res.json({ success: true, message: 'Already in playlist' })

    await Playlist.findByIdAndUpdate(req.params.id, { $addToSet: { songs: songId } })
  }

  res.json({ success: true, message: 'Song added to playlist' })
}

// DELETE /api/playlists/:id/songs/:songId
exports.removeSong = async (req, res) => {
  const { songId } = req.params
  const playlist   = await Playlist.findById(req.params.id)
  if (!playlist) return res.status(404).json({ success: false, message: 'Not found' })
  if (playlist.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'Not authorized' })
  }

  if (isExternalId(songId)) {
    await Playlist.findByIdAndUpdate(req.params.id, {
      $pull: { externalSongs: { externalId: songId } },
    })
  } else {
    await Playlist.findByIdAndUpdate(req.params.id, { $pull: { songs: songId } })
  }

  res.json({ success: true, message: 'Song removed' })
}

// POST /api/playlists/ai-generate
exports.generateAIPlaylist = async (req, res) => {
  const { mood, name } = req.body
  const user    = req.user
  const moodToUse = mood || user.currentMood || 'chill'

  let songIds = []
  let reason  = ''

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
    }, { timeout: 8000 })

    songIds = aiRes.data?.song_ids || []
    reason  = aiRes.data?.reason   || ''
  } catch (_) {}

  // DB fallback — always works
  if (!songIds.length) {
    const filter = { isPublic: true, ...(moodToUse ? { mood: moodToUse } : {}) }
    let songs    = await Song.find(filter).sort({ plays: -1, likes: -1 }).limit(30)
    if (!songs.length) songs = await Song.find({ isPublic: true }).sort({ plays: -1 }).limit(20)

    const genreWeights = Object.fromEntries(user.aiProfile?.genreWeights || new Map())
    const topGenre     = Object.entries(genreWeights).sort((a,b) => b[1]-a[1])[0]?.[0]
    if (topGenre) songs.sort((a,b) => (b.genre === topGenre ? 1 : 0) - (a.genre === topGenre ? 1 : 0))

    songIds = songs.slice(0, 20).map(s => s._id)
    reason  = `${moodToUse.charAt(0).toUpperCase() + moodToUse.slice(1)} songs curated for you`
    if (topGenre) reason += `, featuring your favourite ${topGenre} tracks`
  }

  if (!songIds.length) {
    return res.status(404).json({ success: false, message: 'No songs found to generate playlist' })
  }

  const playlistName = name || `Your ${moodToUse.charAt(0).toUpperCase() + moodToUse.slice(1)} Mix`
  const playlist = await Playlist.create({
    name: playlistName, description: reason || 'AI-curated just for you',
    owner: user._id, songs: songIds,
    isAIGenerated: true, aiGeneratedReason: reason, isPublic: false,
  })

  await playlist.populate('songs', 'title artist coverUrl duration audioUrl genre mood')
  res.json({ success: true, playlist })
}
