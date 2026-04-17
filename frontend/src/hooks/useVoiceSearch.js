/**
 * useVoiceSearch — Web Speech API voice search
 * Returns: { listening, transcript, startListening, stopListening, supported }
 */
import { useState, useRef, useCallback } from 'react'

export default function useVoiceSearch(onResult) {
  const [listening,   setListening]   = useState(false)
  const [transcript,  setTranscript]  = useState('')
  const recognitionRef = useRef(null)

  const supported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const startListening = useCallback(() => {
    if (!supported) return

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognitionRef.current = recognition

    recognition.lang            = 'en-IN'   // works for Hindi+English both
    recognition.continuous      = false
    recognition.interimResults  = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => setListening(true)

    recognition.onresult = (e) => {
      const text = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('')
      setTranscript(text)
      if (e.results[0].isFinal) {
        onResult?.(text)
        setListening(false)
      }
    }

    recognition.onerror = () => setListening(false)
    recognition.onend   = () => setListening(false)

    recognition.start()
  }, [supported, onResult])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, transcript, startListening, stopListening, supported }
}
