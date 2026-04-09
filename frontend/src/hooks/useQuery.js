/**
 * useQuery — lightweight data fetching with caching, loading, error states.
 * Avoids adding React Query as a dep while giving the same core API.
 */
import { useState, useEffect, useCallback, useRef } from 'react'

const globalCache = new Map()

export function useQuery(key, fetcher, options = {}) {
  const { ttl = 5 * 60 * 1000, enabled = true, onSuccess, onError } = options

  const [data,    setData]    = useState(() => globalCache.get(key)?.data ?? null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const mountedRef = useRef(true)

  const run = useCallback(async (force = false) => {
    if (!enabled) return
    const cached = globalCache.get(key)
    if (!force && cached && Date.now() < cached.expiry) {
      setData(cached.data)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      if (!mountedRef.current) return
      globalCache.set(key, { data: result, expiry: Date.now() + ttl })
      setData(result)
      onSuccess?.(result)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err)
      onError?.(err)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [key, enabled])

  useEffect(() => {
    mountedRef.current = true
    run()
    return () => { mountedRef.current = false }
  }, [key, enabled])

  const refetch = () => run(true)
  const invalidate = () => { globalCache.delete(key); run(true) }

  return { data, loading, error, refetch, invalidate }
}

export function invalidateCache(keyPrefix) {
  for (const k of globalCache.keys()) {
    if (k.startsWith(keyPrefix)) globalCache.delete(k)
  }
}
