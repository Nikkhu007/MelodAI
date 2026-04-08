import { Link } from 'react-router-dom'
import { Play, ListMusic, Sparkles } from 'lucide-react'
import usePlayerStore from '../../store/playerStore'

export default function PlaylistCard({ playlist }) {
  const { playSong } = usePlayerStore()

  const handlePlay = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const songs = playlist.songs || []
    if (songs.length > 0) playSong(songs[0], songs)
  }

  return (
    <Link to={`/playlist/${playlist._id}`} className="group block card-hover">
      <div className="relative rounded-2xl overflow-hidden bg-surface-raised border border-surface-border/30 p-3">
        {/* Cover grid */}
        <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-surface-overlay">
          {playlist.coverUrl ? (
            <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          ) : (
            <div className="w-full h-full grid grid-cols-2 gap-0.5">
              {(playlist.songs || []).slice(0, 4).map((song, i) => (
                song?.coverUrl
                  ? <img key={i} src={song.coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  : <div key={i} className="bg-surface-border flex items-center justify-center"><ListMusic size={16} className="text-text-muted" /></div>
              ))}
              {(playlist.songs || []).length === 0 && (
                <div className="col-span-2 row-span-2 flex items-center justify-center">
                  <ListMusic size={32} className="text-text-muted" />
                </div>
              )}
            </div>
          )}

          {/* Play button overlay */}
          <button
            onClick={handlePlay}
            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center glow hover:scale-110 transition-transform">
              <Play size={22} fill="white" className="text-white ml-1" />
            </div>
          </button>

          {/* AI badge */}
          {playlist.isAIGenerated && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-brand/90 text-white text-[10px] px-2 py-0.5 rounded-full">
              <Sparkles size={10} />
              AI
            </div>
          )}
        </div>

        <p className="text-sm font-semibold text-text-primary truncate">{playlist.name}</p>
        <p className="text-xs text-text-muted mt-0.5 truncate">
          {playlist.songs?.length || 0} songs
          {playlist.owner?.username && ` · ${playlist.owner.username}`}
        </p>
        {playlist.isAIGenerated && playlist.aiGeneratedReason && (
          <p className="text-[10px] text-brand/70 mt-1 truncate">{playlist.aiGeneratedReason}</p>
        )}
      </div>
    </Link>
  )
}
