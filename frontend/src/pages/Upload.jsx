import { Upload as UploadIcon } from 'lucide-react'
import useUIStore from '../store/uiStore'
import UploadModal from '../components/songs/UploadModal'

export default function Upload() {
  const { openModal, modals } = useUIStore()

  return (
    <div className="pt-6 animate-fade-in flex flex-col items-center justify-center min-h-[60vh]">
      <div className="glass-card p-10 flex flex-col items-center gap-5 max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand/20 flex items-center justify-center">
          <UploadIcon size={32} className="text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text-primary mb-1">Upload Music</h1>
          <p className="text-text-muted text-sm">Add songs to the MelodAI library. AI will automatically generate embeddings and recommendations.</p>
        </div>
        <button
          onClick={() => openModal('uploadSong')}
          className="btn-primary w-full"
        >
          Upload a Song
        </button>
      </div>
      {modals.uploadSong && <UploadModal />}
    </div>
  )
}
