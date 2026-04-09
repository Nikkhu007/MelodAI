import { useState } from 'react'

export function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch { return initialValue }
  })
  const setValue = val => {
    const toStore = val instanceof Function ? val(stored) : val
    setStored(toStore)
    try { localStorage.setItem(key, JSON.stringify(toStore)) } catch {}
  }
  return [stored, setValue]
}
