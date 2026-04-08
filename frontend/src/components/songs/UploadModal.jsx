import { useState, useRef } from 'react'
import { X, Upload, Music, Image, CheckCircle, AlertCircle } from 'lucide-react'
import useUIStore from '../../store/uiStore'
import { uploadAPI, songsAPI } from '../../services/api'

const GENRES = ['pop','rock','hiphop','rnb','electronic','classical','jazz','indie','metal','country','latin','folk','ambient','other']
const MOODS = ['happy','sad','energetic','focus','chill','gym','romance']

export default function UploadModal() {
  const { closeModal, toast } = useUIStore()
  const audioRef = useRef()
  const imageRef = useRef()

  const [form, setForm] = useState({
    title: '', artist: '', album: '', genre: 'pop', mood: 'chill',
    tempo: 120, energy: 0.5, valence: 0.5, acousticness: 0.5, danceability: 0.5,
    tags: '', releaseYear: new Date().getFullYear(),
  })
  const [audioFile, setAudioFile] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [audioProgress, setAudioProgress] = useState(0)
  const [step, setStep] = useState('form') // form | uploading | done | error
  const [errorMsg, setErrorMsg] = useState('')

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleCoverChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setCoverFile(f)
    setCoverPreview(URL.createObjectURL(f))
  }

  const handleAudioChange = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setAudioFile(f)
    // Try to read duration
    const audio = new Audio(URL.createObjectURL(f))
    audio.onloadedmetadata = () => set('duration', Math.round(audio.duration))
    if (!form.title) set('title', f.name.replace(/\.[^.]+$/, ''))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!audioFile) { toast('Please select an audio file', 'error'); return }
    if (!form.title || !form.artist) { toast('Title and artist are required', 'error'); return }

    setStep('uploading')
    try {
      // 1. Upload audio
      const { data: audioData } = await uploadAPI.audio(audioFile, setAudioProgress)

      // 2. Upload cover if provided
      let coverUrl = ''
      if (coverFile) {
        const { data: coverData } = await uploadAPI.image(coverFile)
        coverUrl = coverData.url
      }

      // 3. Create song record
      await songsAPI.create({
        ...form,
        audioUrl: audioData.url,
        coverUrl,
        duration: form.duration || audioData.duration || 180,
        tags: form.tags,
      })

      setStep('done')
      toast('Song uploaded successfully! 🎵')
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Upload failed')
      setStep('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8">
      <div className="glass-card w-full max-w-lg mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-text-primary">Upload Song</h2>
          <button onClick={() => closeModal('uploadSong')} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {step === 'done' ? (
          <div className="flex flex-col items-center py-10 gap-4">
            <CheckCircle size={48} className="text-green-400" />
            <p className="text-text-primary font-medium">Upload complete!</p>
            <p className="text-text-muted text-sm text-center">Your song is being processed and will appear shortly.</p>
            <button className="btn-primary" onClick={() => closeModal('uploadSong')}>Done</button>
          </div>
        ) : step === 'error' ? (
          <div className="flex flex-col items-center py-10 gap-4">
            <AlertCircle size={48} className="text-red-400" />
            <p className="text-text-primary font-medium">Upload failed</p>
            <p className="text-text-muted text-sm text-center">{errorMsg}</p>
            <button className="btn-primary" onClick={() => setStep('form')}>Try Again</button>
          </div>
        ) : step === 'uploading' ? (
          <div className="flex flex-col items-center py-10 gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-brand border-t-transparent animate-spin" />
            <p className="text-text-primary font-medium">Uploading...</p>
            <div className="w-full bg-surface-border rounded-full h-2">
              <div className="bg-brand h-2 rounded-full transition-all duration-300" style={{ width: `${audioProgress}%` }} />
            </div>
            <p className="text-text-muted text-sm">{audioProgress}%</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* File pickers */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => audioRef.current?.click()}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed transition-colors
                  ${audioFile ? 'border-brand/60 bg-brand/5 text-brand' : 'border-surface-border text-text-muted hover:border-brand/40'}`}
              >
                <Music size={24} />
                <span className="text-xs text-center">{audioFile ? audioFile.name.substring(0, 20) + '…' : 'Select Audio'}</span>
              </button>
              <button
                type="button"
                onClick={() => imageRef.current?.click()}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed transition-colors overflow-hidden relative
                  ${coverFile ? 'border-brand/60' : 'border-surface-border text-text-muted hover:border-brand/40'}`}
              >
                {coverPreview
                  ? <img src={coverPreview} alt="cover" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                  : <Image size={24} />
                }
                <span className="relative z-10 text-xs">{coverFile ? 'Cover set' : 'Cover Art'}</span>
              </button>
            </div>

            <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioChange} />
            <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Title *</label>
                <input className="input-field" value={form.title} onChange={(e) => set('title', e.target.value)} required />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Artist *</label>
                <input className="input-field" value={form.artist} onChange={(e) => set('artist', e.target.value)} required />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Album</label>
                <input className="input-field" value={form.album} onChange={(e) => set('album', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Year</label>
                <input className="input-field" type="number" value={form.releaseYear} onChange={(e) => set('releaseYear', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Genre</label>
                <select className="input-field" value={form.genre} onChange={(e) => set('genre', e.target.value)}>
                  {GENRES.map(g => <option key={g} value={g} className="bg-surface-raised capitalize">{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Mood</label>
                <select className="input-field" value={form.mood} onChange={(e) => set('mood', e.target.value)}>
                  {MOODS.map(m => <option key={m} value={m} className="bg-surface-raised capitalize">{m}</option>)}
                </select>
              </div>
            </div>

            {/* AI features */}
            <div>
              <p className="text-xs text-text-muted mb-2">AI Audio Features</p>
              <div className="grid grid-cols-2 gap-3">
                {[['Tempo (BPM)', 'tempo', 40, 220, 1], ['Energy', 'energy', 0, 1, 0.01], ['Valence', 'valence', 0, 1, 0.01], ['Danceability', 'danceability', 0, 1, 0.01]].map(([label, key, min, max, step]) => (
                  <div key={key}>
                    <div className="flex justify-between mb-1">
                      <label className="text-xs text-text-muted">{label}</label>
                      <span className="text-xs text-brand">{form[key]}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={form[key]}
                      onChange={(e) => set(key, parseFloat(e.target.value))}
                      className="w-full"
                      style={{ background: `linear-gradient(to right, #6c47ff ${((form[key]-min)/(max-min))*100}%, #2d2d3d ${((form[key]-min)/(max-min))*100}%)` }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted mb-1 block">Tags (comma-separated)</label>
              <input className="input-field" placeholder="e.g. lofi, study, beats" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
            </div>

            <button type="submit" className="btn-primary w-full">
              <Upload size={16} className="inline mr-2" />
              Upload Song
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
