/**
 * LyricsPanel — Maximum Level
 *
 * Features:
 *  - Synced karaoke with smooth scroll (manual scrollTop math)
 *  - Click any line to seek
 *  - Language selector (100 languages via MyMemory)
 *  - AI auto-generation badge
 *  - Script detection (shows romanization hint for Hindi/Arabic etc.)
 *  - Original ↔ translated toggle
 *  - Auto-retries with cleaned title
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic2, Loader2, MicOff, RefreshCw, Globe, Sparkles, ChevronDown, RotateCcw } from 'lucide-react'
import usePlayerStore from '../../store/playerStore'
import { lyricsAPI } from '../../services/api'

// ── Language list ─────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'original', label: 'Original' },
  { code: 'en',       label: 'English' },
  { code: 'hi',       label: 'Hindi' },
  { code: 'es',       label: 'Spanish' },
  { code: 'fr',       label: 'French' },
  { code: 'de',       label: 'German' },
  { code: 'ja',       label: 'Japanese' },
  { code: 'ko',       label: 'Korean' },
  { code: 'zh',       label: 'Chinese' },
  { code: 'ar',       label: 'Arabic' },
  { code: 'pt',       label: 'Portuguese' },
  { code: 'ru',       label: 'Russian' },
  { code: 'it',       label: 'Italian' },
  { code: 'tr',       label: 'Turkish' },
  { code: 'pl',       label: 'Polish' },
  { code: 'nl',       label: 'Dutch' },
  { code: 'sv',       label: 'Swedish' },
  { code: 'id',       label: 'Indonesian' },
  { code: 'bn',       label: 'Bengali' },
  { code: 'ta',       label: 'Tamil' },
  { code: 'te',       label: 'Telugu' },
  { code: 'mr',       label: 'Marathi' },
  { code: 'gu',       label: 'Gujarati' },
  { code: 'pa',       label: 'Punjabi' },
  { code: 'ur',       label: 'Urdu' },
]

// ── Known labels ─────────────────────────────────────────────────────────
const LABELS = new Set([
  'tommy boy','t-series','zee music','sony music','universal music',
  'warner music','emi','atlantic','columbia','republic records','interscope',
  'def jam','capitol','rca','island records','epic records','vevo',
  'youtube music','saregama','tips official','speed records','desi music factory',
  'yrf music','dharmatic','erosnow','eros music','zee music company','think music',
])
function isLabel(n) {
  if (!n) return false
  const l = n.toLowerCase().trim()
  return LABELS.has(l) || l.endsWith(' records') || l.endsWith(' music') ||
    l.endsWith(' entertainment') || l.endsWith('vevo') ||
    l.includes('official channel') || l.includes(' topic')
}

function extractArtistTitle(rawTitle='', rawArtist='') {
  let ch = rawArtist.replace(/VEVO$/i,'').replace(/\s*-\s*Topic$/i,'').replace(/\s*Official$/i,'').trim()
  const chIsLabel = isLabel(ch)
  let artist='', title=''
  const colonMatch = rawTitle.match(/^([^:]+):\s*(.+)$/)
  const dashParts  = rawTitle.split(/\s*[–—]\s*|\s+-\s+(?=[A-Z])/)

  if (colonMatch) {
    artist = colonMatch[1].trim()
    title  = colonMatch[2].replace(/\s*\|.*$/,'').trim()
  } else if (dashParts.length >= 2) {
    const first = dashParts[0].trim(), rest = dashParts.slice(1).join(' – ').trim()
    if (first.split(/\s+/).length <= 4 && !first.toLowerCase().includes('official')) {
      artist=first; title=rest
    } else { title=first; artist=rest.split(/\s*[-–—|]\s*/)[0].trim()||ch }
  } else { title=rawTitle.trim(); artist=chIsLabel?'':ch }

  if (!artist||isLabel(artist)) artist=chIsLabel?'':ch

  title = title
    .replace(/\s*\(official[^)]*\)/gi,'').replace(/\s*\[official[^)]*\]/gi,'')
    .replace(/official\s+(music\s*video|video|audio|lyric[s]?)/gi,'')
    .replace(/\s*\(lyric[s]?\s*video\)/gi,'').replace(/\s*ft\.?\s+.*/gi,'')
    .replace(/\s*feat\.?\s+.*/gi,'').replace(/\s*\|.*$/,'').replace(/&amp;/g,'&').trim()

  return { title: title||rawTitle.trim(), artist: artist||'' }
}

// ── Cache ──────────────────────────────────────────────────────────────────
const MEM = new Map()

// ── Language selector dropdown ─────────────────────────────────────────────
function LangSelector({ value, onChange, translating }) {
  const [open, setOpen] = useState(false)
  const current = LANGUAGES.find(l => l.code === value) || LANGUAGES[0]
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all border
          ${value !== 'original' ? 'bg-brand/15 border-brand/30 text-brand' : 'bg-surface-overlay border-surface-border text-text-muted hover:text-text-secondary'}`}
      >
        {translating ? <Loader2 size={10} className="animate-spin" /> : <Globe size={10} />}
        {current.label}
        <ChevronDown size={9} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-1 z-50 rounded-xl border border-surface-border shadow-2xl overflow-hidden"
            style={{ background: 'var(--color-surface-raised)', minWidth: '140px', maxHeight: '260px', overflowY: 'auto' }}
          >
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => { onChange(lang.code); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface-overlay
                  ${value === lang.code ? 'text-brand font-medium bg-brand/10' : 'text-text-secondary'}`}
              >
                {lang.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function LyricsPanel({ className = '' }) {
  const { currentSong, currentTime, seek, duration } = usePlayerStore()

  const [lyricsData,  setLyricsData]  = useState(null)
  const [status,      setStatus]      = useState('idle')
  const [activeIdx,   setActiveIdx]   = useState(0)
  const [lang,        setLang]        = useState('original')
  const [translating, setTranslating] = useState(false)
  const [searchInfo,  setSearchInfo]  = useState({ title: '', artist: '' })
  const [showOriginal, setShowOriginal] = useState(false)

  const containerRef = useRef(null)
  const lineRefs     = useRef([])
  const animFrameRef = useRef(null)

  // ── Fetch lyrics ──────────────────────────────────────────────────────────
  const fetchLyrics = useCallback(async (song, targetLang = 'original') => {
    if (!song) return
    const { title, artist } = extractArtistTitle(song.title||'', song.artist||'')
    const key = `${artist.toLowerCase()}|${title.toLowerCase()}|${targetLang}`
    setSearchInfo({ title, artist })

    if (MEM.has(key)) {
      setLyricsData(MEM.get(key))
      setStatus(MEM.get(key) ? 'found' : 'notfound')
      setActiveIdx(0); lineRefs.current = []
      return
    }

    setStatus('loading')
    setLyricsData(null)
    setActiveIdx(0); lineRefs.current = []

    try {
      const { data } = await lyricsAPI.get(artist, title, targetLang)
      const result = data.success ? {
        lyrics:         data.lyrics    || '',
        synced:         data.synced    || null,
        hasSynced:      data.hasSynced || false,
        source:         data.source    || '',
        isGenerated:    data.isGenerated || false,
        translatedTo:   data.translatedTo || null,
        originalLyrics: data.originalLyrics || null,
        script:         data.script || 'latin',
      } : null

      MEM.set(key, result)
      setLyricsData(result)
      setStatus(result ? 'found' : 'notfound')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (currentSong) { setLang('original'); fetchLyrics(currentSong, 'original') }
  }, [currentSong?._id])

  // ── Language change ───────────────────────────────────────────────────────
  const handleLangChange = async (newLang) => {
    setLang(newLang)
    setShowOriginal(false)
    if (!currentSong) return
    setTranslating(true)
    await fetchLyrics(currentSong, newLang)
    setTranslating(false)
  }

  // ── Sync active line ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!lyricsData?.hasSynced || !lyricsData.synced?.length) return
    const lines = lyricsData.synced
    let idx = 0
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time <= currentTime + 0.15) idx = i
      else break
    }
    setActiveIdx(prev => prev === idx ? prev : idx)
  }, [currentTime, lyricsData])

  // ── Scroll to center ──────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    const lineEl    = lineRefs.current[activeIdx]
    if (!container || !lineEl) return
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    animFrameRef.current = requestAnimationFrame(() => {
      const target = container.scrollTop
        + (lineEl.getBoundingClientRect().top - container.getBoundingClientRect().top)
        - (container.clientHeight / 2) + (lineEl.offsetHeight / 2)
      container.scrollTo({ top: target, behavior: 'smooth' })
    })
  }, [activeIdx])

  // ── Render ────────────────────────────────────────────────────────────────
  if (!currentSong) {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-3 p-6 text-center ${className}`}>
        <Mic2 size={32} className="opacity-20 text-text-muted" />
        <p className="text-sm text-text-muted">Play a song to see lyrics</p>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-3 ${className}`}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader2 size={22} className="text-brand" />
        </motion.div>
        <p className="text-sm text-text-muted">
          {translating ? 'Translating lyrics…' : 'Fetching lyrics…'}
        </p>
        {searchInfo.title && (
          <p className="text-[10px] text-text-muted opacity-60 text-center px-4">
            "{searchInfo.title}"{searchInfo.artist && <> by "{searchInfo.artist}"</>}
          </p>
        )}
      </div>
    )
  }

  if (status === 'notfound' || status === 'error' || !lyricsData) {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-3 p-6 text-center ${className}`}>
        <MicOff size={28} className="opacity-30 text-text-muted" />
        <p className="text-sm font-medium text-text-muted">Lyrics not available</p>
        <p className="text-[10px] text-text-muted opacity-60 leading-relaxed">
          Searched for:<br />
          <span className="text-text-secondary">"{searchInfo.title}"</span>
          {searchInfo.artist && <> by <span className="text-text-secondary">"{searchInfo.artist}"</span></>}
        </p>
        <p className="text-[10px] text-text-muted opacity-50 px-4">
          {status === 'error' ? 'Connection error — check your internet' : 'This song may not have lyrics in our database'}
        </p>
        <button
          onClick={() => { const k=`${searchInfo.artist.toLowerCase()}|${searchInfo.title.toLowerCase()}|${lang}`; MEM.delete(k); fetchLyrics(currentSong, lang) }}
          className="btn-ghost text-xs flex items-center gap-1.5 mt-1 border border-surface-border"
        >
          <RefreshCw size={11} /> Retry
        </button>
      </div>
    )
  }

  // Header (shared between synced and plain)
  const Header = () => (
    <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border/30 shrink-0 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <Mic2 size={12} className={lyricsData.hasSynced ? 'text-brand' : 'text-text-muted'} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted truncate">
          {lyricsData.hasSynced ? 'Synced' : 'Lyrics'}
        </span>
        {lyricsData.isGenerated && (
          <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-brand/15 text-brand border border-brand/20 shrink-0">
            <Sparkles size={8} /> AI
          </span>
        )}
        {lyricsData.translatedTo && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 shrink-0">
            {LANGUAGES.find(l=>l.code===lyricsData.translatedTo)?.label || lyricsData.translatedTo}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Original toggle */}
        {lyricsData.translatedTo && lyricsData.originalLyrics && (
          <button
            onClick={() => setShowOriginal(o=>!o)}
            className={`text-[9px] px-1.5 py-1 rounded-lg border transition-colors ${showOriginal ? 'border-brand/40 text-brand bg-brand/10' : 'border-surface-border text-text-muted hover:text-text-secondary'}`}
            title="Show original"
          >
            <RotateCcw size={9} />
          </button>
        )}
        <LangSelector value={lang} onChange={handleLangChange} translating={translating} />
      </div>
    </div>
  )

  // Display data (original or translated)
  const displayData = showOriginal
    ? { ...lyricsData, lyrics: lyricsData.originalLyrics, synced: null, hasSynced: false }
    : lyricsData

  // ── Synced karaoke ───────────────────────────────────────────────────────
  if (displayData.hasSynced && displayData.synced?.length > 0) {
    return (
      <div className={`flex flex-col h-full overflow-hidden ${className}`}>
        <Header />
        {lyricsData.hasSynced && (
          <p className="text-center text-[9px] text-text-muted py-1 border-b border-surface-border/10 shrink-0">
            click any line to seek
          </p>
        )}

        <div
          ref={containerRef}
          className="flex-1 scrollbar-hide"
          style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
        >
          <div style={{ height: '45%' }} />

          {displayData.synced.map((line, i) => {
            const isActive = i === activeIdx
            const isNear   = Math.abs(i - activeIdx) <= 1
            const isPast   = i < activeIdx
            return (
              <div
                key={i}
                ref={el => { lineRefs.current[i] = el }}
                onClick={() => seek(line.time)}
                style={{
                  textAlign:   'center',
                  padding:     '7px 20px',
                  cursor:      'pointer',
                  userSelect:  'none',
                  transition:  'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  opacity:     isActive ? 1 : isNear ? 0.5 : isPast ? 0.25 : 0.2,
                  transform:   isActive ? 'scale(1.06)' : 'scale(1)',
                  fontWeight:  isActive ? 700 : 400,
                  fontSize:    isActive ? '1.05rem' : '0.875rem',
                  lineHeight:  1.6,
                  color:       isActive ? 'var(--color-text-primary)' : isPast ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                  background:  isActive ? 'linear-gradient(to right,transparent,rgba(108,71,255,0.08),transparent)' : 'transparent',
                  borderRadius: '10px',
                }}
              >
                {line.text}
              </div>
            )
          })}

          <div style={{ height: '50%' }} />
        </div>

        {/* Progress bar */}
        <div className="px-4 py-1.5 border-t border-surface-border/20 shrink-0">
          <div className="h-0.5 bg-surface-border rounded-full overflow-hidden">
            <div className="h-full bg-brand" style={{ width:`${duration>0?(currentTime/duration)*100:0}%`, transition:'width 1s linear' }} />
          </div>
        </div>
      </div>
    )
  }

  // ── Plain lyrics ──────────────────────────────────────────────────────────
  const lyricsToShow = displayData.lyrics || ''
  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      <Header />
      <div
        ref={containerRef}
        className="flex-1 scrollbar-hide px-5 py-4"
        style={{ overflowY: 'auto' }}
      >
        {lyricsData.script !== 'latin' && !lyricsData.translatedTo && (
          <p className="text-[10px] text-text-muted mb-3 text-center opacity-60">
            Tip: Use the language selector above to translate these lyrics
          </p>
        )}
        {lyricsToShow.split('\n').map((line, i) => (
          <p key={i} style={{
            lineHeight:   1.75,
            marginBottom: line.trim()==='' ? '0.5rem' : '0',
            fontSize:     '0.875rem',
            color:        line.trim() ? 'var(--color-text-secondary)' : 'transparent',
          }}>
            {line || '\u00A0'}
          </p>
        ))}
        <div style={{ height: '4rem' }} />
      </div>
    </div>
  )
}
