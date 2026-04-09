import { useState } from 'react'
import { X, Copy, Check, Share2, ExternalLink } from 'lucide-react'
import useUIStore from '../../store/uiStore'

export default function ShareModal() {
  const { closeModal, modals, selectedSongForShare, toast } = useUIStore()
  const song = selectedSongForShare
  const [copied, setCopied] = useState(false)

  if (!modals.shareModal || !song) return null

  const shareText = `🎵 ${song.title} by ${song.artist} — listening on MelodAI`
  const shareUrl = song.ytUrl || song.jamendoUrl || window.location.href

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast('Copied to clipboard!')
  }

  const handleNativeShare = async () => {
    if (!navigator.share) { handleCopy(); return }
    try {
      await navigator.share({ title: song.title, text: shareText, url: shareUrl })
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-sm mx-4 mb-4 sm:mb-0 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-text-primary flex items-center gap-2">
            <Share2 size={16} className="text-brand" /> Share Song
          </h2>
          <button onClick={() => closeModal('shareModal')} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {/* Song preview */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-overlay mb-4">
          {song.coverUrl && <img src={song.coverUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{song.title}</p>
            <p className="text-xs text-text-muted truncate">{song.artist}</p>
          </div>
        </div>

        <div className="space-y-2">
          <button onClick={handleCopy} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-overlay hover:bg-surface-border/40 transition-colors text-sm text-text-primary">
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>

          {navigator.share && (
            <button onClick={handleNativeShare} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-brand/10 hover:bg-brand/20 border border-brand/30 transition-colors text-sm text-brand">
              <Share2 size={16} />
              Share via…
            </button>
          )}

          {shareUrl !== window.location.href && (
            <a href={shareUrl} target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-overlay hover:bg-surface-border/40 transition-colors text-sm text-text-secondary">
              <ExternalLink size={16} />
              Open original
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
