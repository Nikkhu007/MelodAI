/**
 * User Controller — v3 Maximum Level
 *
 * Endpoints:
 *   GET    /api/users/me               profile + liked songs
 *   PUT    /api/users/profile          update username/bio/avatar
 *   PUT    /api/users/password         change password
 *   GET    /api/users/history          paginated listen history + stats
 *   GET    /api/users/liked            liked songs with full metadata
 *   GET    /api/users/stats            personal listening analytics
 *   POST   /api/users/follow/:id       follow a user
 *   DELETE /api/users/follow/:id       unfollow
 *   GET    /api/users/:id              public profile
 *   DELETE /api/users/me               deactivate account
 *   GET    /api/users/ai-profile       AI taste profile summary
 */
const User        = require('../models/User')
const Song        = require('../models/Song')
const Playlist    = require('../models/Playlist')
const ListenEvent = require('../models/ListenEvent')
const AppError    = require('../utils/AppError')

// ── GET /api/users/me ─────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('likedSongs', 'title artist coverUrl duration audioUrl genre mood')
    .select('-password')
  res.json({ success: true, user })
}

// ── PUT /api/users/profile ────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  const { username, avatar, bio } = req.body
  if (username && (username.length < 3 || username.length > 30))
    throw AppError.badRequest('Username must be 3–30 characters')
  if (username && !/^[a-zA-Z0-9_]+$/.test(username))
    throw AppError.badRequest('Username: letters, numbers, underscores only')
  if (bio && bio.length > 300)
    throw AppError.badRequest('Bio max 300 characters')

  if (username) {
    const taken = await User.findOne({ username, _id: { $ne: req.user._id } }).lean()
    if (taken) throw AppError.conflict('Username already taken')
  }

  const updates = {}
  if (username !== undefined) updates.username = username.trim()
  if (avatar   !== undefined) updates.avatar   = avatar
  if (bio      !== undefined) updates.bio      = bio.trim()

  const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true }).select('-password')
  res.json({ success: true, user: updated })
}

// ── PUT /api/users/password ───────────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || !newPassword) throw AppError.badRequest('Both passwords required')
  if (newPassword.length < 6)           throw AppError.badRequest('New password min 6 chars')
  if (newPassword === currentPassword)  throw AppError.badRequest('New password must differ from current')

  const user  = await User.findById(req.user._id).select('+password')
  const valid = await user.comparePassword(currentPassword)
  if (!valid) throw AppError.unauthorized('Current password is incorrect')

  user.password = newPassword
  await user.save()
  res.json({ success: true, message: 'Password changed successfully' })
}

// ── GET /api/users/history ────────────────────────────────────────────────────
exports.getHistory = async (req, res) => {
  const { limit = 100, page = 1, event: filterEvent } = req.query
  const lim  = Math.min(parseInt(limit), 200)
  const skip = (parseInt(page) - 1) * lim

  const match = { user: req.user._id }
  if (filterEvent) match.event = filterEvent

  const [events, total] = await Promise.all([
    ListenEvent.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .populate('song', 'title artist coverUrl duration audioUrl genre mood')
      .lean(),
    ListenEvent.countDocuments(match),
  ])

  res.json({
    success: true,
    events,
    pagination: { page: parseInt(page), limit: lim, total, pages: Math.ceil(total/lim) },
  })
}

// ── GET /api/users/liked ──────────────────────────────────────────────────────
exports.getLiked = async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('likedSongs', 'title artist album coverUrl duration audioUrl genre mood tempo energy plays likes')
    .select('likedSongs')
    .lean()
  res.json({ success: true, songs: user.likedSongs || [] })
}

// ── GET /api/users/stats ──────────────────────────────────────────────────────
exports.getMyStats = async (req, res) => {
  const userId = req.user._id
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalEvents,
    last30Events,
    genreBreakdown,
    moodBreakdown,
    topSongs,
    dailyActivity,
    completionCount,
    likeCount,
  ] = await Promise.all([
    // Total listen count
    ListenEvent.countDocuments({ user: userId, event: 'play' }),

    // Last 30 days events for time listened
    ListenEvent.find({ user: userId, createdAt: { $gte: since30 } })
      .select('listenDuration event createdAt').lean(),

    // Top genres
    ListenEvent.aggregate([
      { $match: { user: userId, event: 'play' } },
      { $lookup: { from: 'songs', localField: 'song', foreignField: '_id', as: 'songData' } },
      { $unwind: { path: '$songData', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$songData.genre', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),

    // Top moods
    ListenEvent.aggregate([
      { $match: { user: userId, event: 'play', mood: { $ne: null } } },
      { $group: { _id: '$mood', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),

    // Top 5 most played songs
    ListenEvent.aggregate([
      { $match: { user: userId, event: 'play', song: { $ne: null } } },
      { $group: { _id: '$song', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'songs', localField: '_id', foreignField: '_id', as: 'song' } },
      { $unwind: '$song' },
      { $project: { count: 1, 'song.title': 1, 'song.artist': 1, 'song.coverUrl': 1 } },
    ]),

    // Daily activity (last 7 days)
    ListenEvent.aggregate([
      { $match: { user: userId, event: 'play', createdAt: { $gte: new Date(Date.now() - 7*86400000) } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      }},
      { $sort: { _id: 1 } },
    ]),

    ListenEvent.countDocuments({ user: userId, event: 'complete' }),
    ListenEvent.countDocuments({ user: userId, event: 'like' }),
  ])

  const totalListenMs = last30Events.reduce((acc, e) => acc + (e.listenDuration || 0), 0)
  const totalPlays    = last30Events.filter(e => e.event === 'play').length

  // Listening streak
  const playDays = [...new Set(
    (await ListenEvent.find({ user: userId, event: 'play' }).select('createdAt').lean())
      .map(e => new Date(e.createdAt).toDateString())
  )].reverse()

  let streak = 0
  for (let i = 0; i < playDays.length; i++) {
    const expected = new Date(Date.now() - i * 86400000).toDateString()
    if (playDays[i] === expected) streak++
    else break
  }

  res.json({
    success: true,
    stats: {
      totalPlays,
      totalPlaysAllTime: totalEvents,
      totalListenTime:   Math.round(totalListenMs),
      completionCount,
      likeCount,
      streak,
      completionRate:  totalPlays > 0 ? Math.round((completionCount / totalPlays) * 100) : 0,
      topGenres:       genreBreakdown,
      topMoods:        moodBreakdown,
      topSongs,
      dailyActivity,
      aiProfile: {
        genreWeights: Object.fromEntries(req.user.aiProfile?.genreWeights || new Map()),
        moodWeights:  Object.fromEntries(req.user.aiProfile?.moodWeights  || new Map()),
        totalPlays:   req.user.aiProfile?.totalPlays || 0,
      },
    },
  })
}

// ── GET /api/users/ai-profile ─────────────────────────────────────────────────
exports.getAIProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select('aiProfile currentMood').lean()
  const gw = Object.entries(Object.fromEntries(user.aiProfile?.genreWeights || new Map()))
    .sort((a,b) => b[1]-a[1]).slice(0,5)
  const mw = Object.entries(Object.fromEntries(user.aiProfile?.moodWeights || new Map()))
    .sort((a,b) => b[1]-a[1]).slice(0,5)

  res.json({
    success: true,
    profile: {
      topGenres:       gw.map(([genre, score]) => ({ genre, score })),
      topMoods:        mw.map(([mood, score])  => ({ mood, score })),
      tempoPreference: user.aiProfile?.tempoPreference || 120,
      totalPlays:      user.aiProfile?.totalPlays || 0,
      currentMood:     user.currentMood,
      lastUpdated:     user.aiProfile?.lastUpdated,
    },
  })
}

// ── POST /api/users/follow/:id ────────────────────────────────────────────────
exports.followUser = async (req, res, next) => {
  const targetId = req.params.id
  if (targetId === req.user._id.toString()) return next(AppError.badRequest('Cannot follow yourself'))

  const [me, target] = await Promise.all([
    User.findById(req.user._id),
    User.findById(targetId),
  ])
  if (!target) return next(AppError.notFound('User not found'))

  const alreadyFollowing = me.following.map(id=>id.toString()).includes(targetId)
  if (alreadyFollowing) return res.json({ success: true, message: 'Already following' })

  await Promise.all([
    User.findByIdAndUpdate(req.user._id, { $addToSet: { following: targetId } }),
    User.findByIdAndUpdate(targetId,     { $addToSet: { followers: req.user._id } }),
  ])
  res.json({ success: true, message: `Following ${target.username}` })
}

// ── DELETE /api/users/follow/:id ──────────────────────────────────────────────
exports.unfollowUser = async (req, res, next) => {
  const targetId = req.params.id
  const target   = await User.findById(targetId).select('username').lean()
  if (!target) return next(AppError.notFound('User not found'))

  await Promise.all([
    User.findByIdAndUpdate(req.user._id, { $pull: { following: targetId } }),
    User.findByIdAndUpdate(targetId,     { $pull: { followers: req.user._id } }),
  ])
  res.json({ success: true, message: `Unfollowed ${target.username}` })
}

// ── GET /api/users/:id — public profile ───────────────────────────────────────
exports.getProfile = async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .select('username avatar bio followers following createdAt')
    .lean()
  if (!user) return next(AppError.notFound('User not found'))

  const [playlists, songsUploaded] = await Promise.all([
    Playlist.find({ owner: req.params.id, isPublic: true })
      .select('name coverUrl songs createdAt').lean(),
    Song.countDocuments({ uploadedBy: req.params.id, isPublic: true }),
  ])

  res.json({
    success: true,
    user: {
      ...user,
      followerCount:  user.followers?.length || 0,
      followingCount: user.following?.length || 0,
      isFollowing: req.user ? user.followers?.some(id => id.toString() === req.user._id.toString()) : false,
    },
    playlists,
    songsUploaded,
  })
}

// ── DELETE /api/users/me — deactivate account ─────────────────────────────────
exports.deactivateAccount = async (req, res) => {
  const { password } = req.body
  if (!password) throw AppError.badRequest('Password required to deactivate account')

  const user = await User.findById(req.user._id).select('+password')
  if (!await user.comparePassword(password)) throw AppError.unauthorized('Incorrect password')

  await User.findByIdAndUpdate(req.user._id, { isActive: false })
  res.json({ success: true, message: 'Account deactivated. Contact support to restore.' })
}
