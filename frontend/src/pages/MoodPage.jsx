import { useState } from 'react'
import { Loader2, Play, Sparkles } from 'lucide-react'
import { recommendAPI, playlistsAPI } from '../services/api'
import usePlayerStore from '../store/playerStore'
import useAuthStore from '../store/authStore'
import useUIStore from '../store/uiStore'
import SongRow from '../components/songs/SongRow'
import { SkeletonRow } from '../components/ui/Skeleton'

const MOODS = [
  { id: 'happy',    emoji: '😄', label: 'Happy',     desc: 'Uplifting, feel-good tracks',        gradient: 'from-yellow-500/30 to-orange-500/20' },
  { id: 'sad',      emoji: '😢', label: 'Melancholy', desc: 'Emotional, introspective music',    gradient: 'from-blue-500/30 to-indigo-500/20' },
  { id: 'energetic',emoji: '⚡', label: 'Energetic',  desc: 'High-energy bangers',               gradient: 'from-orange-500/30 to-red-500/20' },
  { id: 'focus',    emoji: '🎯', label: 'Focus',      desc: 'Concentration & deep work',         gradient: 'from-green-500/30 to-teal-500/20' },
  { id: 'chill',    emoji: '😌', label: 'Chill',      desc: 'Relaxed & easy listening',          gradient: 'from-cyan-500/30 to-blue-500/20' },
  { id: 'gym',      emoji: '💪', label: 'Gym',        desc: 'Maximum power for workouts',        gradient: 'from-red-500/30 to-orange-500/20' },
  { id: 'romance',  emoji: '💜', label: 'Romance',    desc: 'Warm, smooth & heartfelt',          gradient: 'from-pink-500/30 to-purple-500/20' },
]

export default function MoodPage() {
  const [activeMood, setActiveMood] = useState(null)
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const { playSong } = usePlayerStore()
  const { setMood } = useAuthStore()
  const { toast } = useUIStore()

  const selectMood = async (mood) => {
    setActiveMood(mood)
    setLoading(true)
    await setMood(mood.id)
    try {
      const { data } = await recommendAPI.getMood(mood.id)
      setSongs(data.songs || [])
      if (data.songs?.length) playSong(data.songs[0], data.songs)
    } catch {
      toast('Could not load mood songs', 'error')
    } finally {
      setLoading(false)
    }
  }

  const saveAsPlaylist = async () => {
    if (!activeMood) return
    setSaving(true)
    try {
      const { data } = await playlistsAPI.generateAI({ mood: activeMood.id, name: `${activeMood.label} Radio` })
      toast(`"${data.playlist.name}" saved to your library! 🎵`)
    } catch {
      toast('Could not save playlist', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="pt-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-1 flex items-center gap-2">
          <Sparkles className="text-brand" size={22} /> Mood Radio
        </h1>
        <p className="text-text-muted text-sm">AI-picks songs that match exactly how you feel right now.</p>
      </div>

      {/* Mood grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8">
        {MOODS.map((mood) => (
          <button
            key={mood.id}
            onClick={() => selectMood(mood)}
            className={`
              flex flex-col items-start gap-2 p-4 rounded-2xl text-left
              bg-gradient-to-br ${mood.gradient}
              border transition-all duration-200 active:scale-95
              ${activeMood?.id === mood.id
                ? 'border-brand shadow-lg shadow-brand/20 scale-[1.02]'
                : 'border-surface-border/30 hover:border-surface-border hover:scale-[1.01]'
              }
            `}
          >
            <span className="text-3xl">{mood.emoji}</span>
            <div>
              <p className="font-semibold text-text-primary text-sm">{mood.label}</p>
              <p className="text-xs text-text-muted mt-0.5">{mood.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Results */}
      {activeMood && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">
              {activeMood.emoji} {activeMood.label} Radio
            </h2>
            <div className="flex gap-2">
              {songs.length > 0 && (
                <>
                  <button
                    onClick={() => playSong(songs[0], songs)}
                    className="btn-primary flex items-center gap-2 text-sm"
                  >
                    <Play size={14} fill="currentColor" /> Play All
                  </button>
                  <button
                    onClick={saveAsPlaylist}
                    disabled={saving}
                    className="btn-ghost flex items-center gap-2 text-sm border border-surface-border"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Save Playlist
                  </button>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-1">{Array(8).fill(0).map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : songs.length === 0 ? (
            <p className="text-text-muted text-center py-12">No songs found for this mood.</p>
          ) : (
            <div className="space-y-1">
              {songs.map((song, i) => (
                <SongRow key={song._id} song={song} index={i} queue={songs} showIndex />
              ))}
            </div>
          )}
        </div>
      )}

      {!activeMood && (
        <div className="text-center py-12 text-text-muted">
          <p>Select a mood above to start your radio station 🎵</p>
        </div>
      )}
    </div>
  )
}
