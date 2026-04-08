import { Play, Pause, ListMusic } from 'lucide-react'
import usePlayerStore from '../../store/playerStore'

const MOOD_GRADIENT = {
  happy: 'from-yellow-600/30 to-orange-600/20',
  sad: 'from-blue-600/30 to-indigo-600/20',
  energetic: 'from-orange-600/30 to-red-600/20',
  focus: 'from-green-600/30 to-teal-600/20',
  chill: 'from-cyan-600/30 to-blue-600/20',
  gym: 'from-red-600/30 to-orange-600/20',
  romance: 'from-pink-600/30 to-purple-600/20',
}

export default function SongCard({ song, queue = [] }) {
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayerStore()
  const isActive = currentSong?._id === song._id

  const handlePlay = (e) => {
    e.preventDefault()
    if (isActive) togglePlay()
    else playSong(song, queue)
  }

  return (
    <div
      className={`card-hover group relative rounded-2xl overflow-hidden cursor-pointer
        bg-gradient-to-br ${MOOD_GRADIENT[song.mood] || 'from-surface-raised to-surface-overlay'}
        border border-surface-border/30 p-3`}
    >
      {/* Cover art */}
      <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-surface-overlay">
        {song.coverUrl
          ? <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
          : <div className="w-full h-full flex items-center justify-center text-text-muted bg-surface-raised">
              <ListMusic size={32} />
            </div>
        }
        {/* Play overlay */}
        <button
          onClick={handlePlay}
          className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center glow shadow-lg hover:scale-110 transition-transform">
            {isActive && isPlaying
              ? <Pause size={22} fill="white" className="text-white" />
              : <Play size={22} fill="white" className="text-white ml-1" />
            }
          </div>
        </button>
        {/* Active indicator */}
        {isActive && isPlaying && (
          <div className="absolute bottom-2 right-2 bg-black/60 rounded px-1.5 py-1">
            <span className="playing-bars flex gap-0.5 items-end h-3">
              <span className="!h-3" /><span className="!h-3" /><span className="!h-3" />
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <p className={`text-sm font-semibold truncate ${isActive ? 'text-brand' : 'text-text-primary'}`}>
        {song.title}
      </p>
      <p className="text-xs text-text-muted truncate mt-0.5">{song.artist}</p>
      {song.genre && (
        <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-surface-border/60 text-text-muted capitalize">
          {song.genre}
        </span>
      )}
    </div>
  )
}
