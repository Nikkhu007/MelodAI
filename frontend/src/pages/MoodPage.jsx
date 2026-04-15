import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Play, Sparkles, RefreshCw, ListPlus, Heart, Plus } from 'lucide-react'
import { recommendAPI, playlistsAPI, youtubeAPI, songsAPI } from '../services/api'
import usePlayerStore from '../store/playerStore'
import useAuthStore from '../store/authStore'
import useUIStore from '../store/uiStore'
import SongRow from '../components/songs/SongRow'
import { SkeletonRow } from '../components/ui/Skeleton'

// Jamendo tags per mood
const JAMENDO_ID = import.meta.env.VITE_JAMENDO_CLIENT_ID || 'b6747d04'
const MOOD_JAMENDO_TAGS = {
  happy:     'happy+upbeat+fun',
  sad:       'sad+melancholy+emotional',
  energetic: 'energetic+powerful+intense',
  focus:     'focus+concentration+study+ambient',
  chill:     'chill+relax+smooth',
  gym:       'workout+sport+powerful+energetic',
  romance:   'romantic+love+sensual',
}
// YouTube search queries per mood
const MOOD_YT_QUERIES = {
  happy:     'happy feel good songs 2024',
  sad:       'sad emotional songs hindi',
  energetic: 'high energy songs workout 2024',
  focus:     'deep focus study music concentration',
  chill:     'chill relaxing music vibes',
  gym:       'gym workout motivation music',
  romance:   'romantic songs hindi 2024',
}

async function fetchJamendoByMood(mood, limit = 15) {
  const tags = MOOD_JAMENDO_TAGS[mood] || mood
  const p = new URLSearchParams({
    client_id: JAMENDO_ID, format: 'json', limit,
    tags, include: 'musicinfo', audioformat: 'mp32', imagesize: 500, order: 'popularity_week',
  })
  const r = await fetch(`https://api.jamendo.com/v3.0/tracks/?${p}`)
  const j = await r.json()
  return (j.results || []).map(t => ({
    _id: `jamendo_${t.id}`, title: t.name, artist: t.artist_name,
    album: t.album_name || '', duration: t.duration || 0,
    audioUrl: t.audio, coverUrl: t.image || '',
    genre: (t.musicinfo?.tags?.genres?.[0] || 'other').toLowerCase(),
    mood, isJamendo: true, jamendoUrl: t.shareurl,
  }))
}

const MOODS = [
  { id: 'happy',     emoji: '😄', label: 'Happy',     desc: 'Uplifting feel-good tracks',    gradient: 'from-yellow-500/30 to-orange-500/20', accent: 'text-yellow-400' },
  { id: 'sad',       emoji: '😢', label: 'Melancholy', desc: 'Emotional & introspective',     gradient: 'from-blue-500/30 to-indigo-500/20',  accent: 'text-blue-400' },
  { id: 'energetic', emoji: '⚡', label: 'Energetic',  desc: 'High-energy bangers',           gradient: 'from-orange-500/30 to-red-500/20',   accent: 'text-orange-400' },
  { id: 'focus',     emoji: '🎯', label: 'Focus',      desc: 'Concentration & deep work',     gradient: 'from-green-500/30 to-teal-500/20',   accent: 'text-green-400' },
  { id: 'chill',     emoji: '😌', label: 'Chill',      desc: 'Relaxed easy listening',        gradient: 'from-cyan-500/30 to-blue-500/20',    accent: 'text-cyan-400' },
  { id: 'gym',       emoji: '💪', label: 'Gym',        desc: 'Maximum power for workouts',    gradient: 'from-red-500/30 to-orange-500/20',   accent: 'text-red-400' },
  { id: 'romance',   emoji: '💜', label: 'Romance',    desc: 'Warm smooth & heartfelt',       gradient: 'from-pink-500/30 to-purple-500/20',  accent: 'text-pink-400' },
]

export default function MoodPage() {
  const [activeMood, setActiveMood] = useState(null)
  const [songs, setSongs]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [source, setSource]         = useState('')
  const { playSong } = usePlayerStore()
  const { setMood }  = useAuthStore()
  const { toast }    = useUIStore()

  const selectMood = async (mood) => {
    setActiveMood(mood)
    setLoading(true)
    setSongs([])
    await setMood(mood.id)

    let collected = []

    // 1. DB songs matching this mood
    try {
      const { data } = await recommendAPI.getMood(mood.id)
      if (data.songs?.length) {
        collected = [...collected, ...data.songs]
        setSource(data.source || 'db')
      }
    } catch {}

    // 2. Jamendo songs for this mood
    try {
      const jamendo = await fetchJamendoByMood(mood.id, 15)
      const existing = new Set(collected.map(s => s._id))
      collected = [...collected, ...jamendo.filter(s => !existing.has(s._id))]
    } catch {}

    // 3. YouTube songs for this mood (if yt-dlp available)
    try {
      const { data: check } = await youtubeAPI.check()
      if (check.installed) {
        const { data } = await youtubeAPI.search(MOOD_YT_QUERIES[mood.id], 10)
        const ytSongs = (data.songs || []).map(s => ({
          ...s, audioUrl: youtubeAPI.streamUrl(s.ytId)
        }))
        const existing = new Set(collected.map(s => s._id))
        collected = [...collected, ...ytSongs.filter(s => !existing.has(s._id))]
      }
    } catch {}

    setSongs(collected)
    setLoading(false)

    // Auto-play first song
    if (collected.length) playSong(collected[0], collected)
  }

  const saveAsPlaylist = async () => {
    if (!activeMood) return
    setSaving(true)
    try {
      const { data } = await playlistsAPI.generateAI({ mood: activeMood.id, name: `${activeMood.label} Radio` })
      toast(`"${data.playlist.name}" saved to your library! 🎵`)
    } catch { toast('Could not save playlist', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="pt-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-1 flex items-center gap-2">
          <Sparkles className="text-brand" size={22} /> Mood Radio
        </h1>
        <p className="text-text-muted text-sm">Songs from your library, Jamendo & YouTube — all matched to your mood.</p>
      </div>

      {/* Mood grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
        {MOODS.map(mood => (
          <motion.button
            key={mood.id}
            whileTap={{ scale: 0.96 }}
            onClick={() => selectMood(mood)}
            className={`flex flex-col items-start gap-2 p-4 rounded-2xl text-left
              bg-gradient-to-br ${mood.gradient}
              border transition-all duration-200
              ${activeMood?.id === mood.id
                ? 'border-brand shadow-lg shadow-brand/20 scale-[1.02]'
                : 'border-surface-border/30 hover:border-surface-border hover:scale-[1.01]'
              }`}
          >
            <span className="text-2xl">{mood.emoji}</span>
            <div>
              <p className="font-semibold text-text-primary text-sm">{mood.label}</p>
              <p className="text-xs text-text-muted mt-0.5">{mood.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Results */}
      <AnimatePresence>
        {activeMood && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-lg font-semibold text-text-primary">
                {activeMood.emoji} {activeMood.label} Radio
                {songs.length > 0 && <span className="text-sm text-text-muted font-normal ml-2">({songs.length} songs)</span>}
              </h2>
              <div className="flex gap-2">
                {songs.length > 0 && (
                  <>
                    <button onClick={() => playSong(songs[0], songs)} className="btn-primary flex items-center gap-2 text-sm py-1.5 px-3">
                      <Play size={14} fill="currentColor" /> Play All
                    </button>
                    <button onClick={saveAsPlaylist} disabled={saving}
                      className="btn-ghost flex items-center gap-2 text-sm border border-surface-border py-1.5">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      Save Playlist
                    </button>
                    <button onClick={() => selectMood(activeMood)} className="btn-ghost p-2 border border-surface-border" title="Refresh">
                      <RefreshCw size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <div className="space-y-1">{Array(8).fill(0).map((_,i) => <SkeletonRow key={i} />)}</div>
            ) : songs.length === 0 ? (
              <p className="text-text-muted text-center py-12">No songs found for this mood.</p>
            ) : (
              <div className="space-y-0.5">
                {songs.map((song, i) => (
                  <SongRow key={song._id + i} song={song} index={i} queue={songs} showIndex />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!activeMood && (
        <div className="text-center py-12 text-text-muted">
          <p>Select a mood above to start your radio station 🎵</p>
        </div>
      )}
    </div>
  )
}
