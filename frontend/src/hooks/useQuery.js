/**
 * useQuery — Production-grade data fetching hook
 *
 * Features:
 *  - Stale-while-revalidate (return cached data instantly, refresh in bg)
 *  - Background refetch on window focus
 *  - Automatic retry on error (3 attempts)
 *  - Dependent queries (enabled flag)
 *  - Pagination helpers
 *  - Optimistic update helper
 *  - Abort on unmount
 */
import { useState, useEffect, useCallback, useRef } from 'react'

const globalCache = new Map()  // key -> { data, ts, ttlMs }

function isFresh(entry) {
  return entry && Date.now() - entry.ts < entry.ttlMs
}

export function useQuery(key, fetcher, options = {}) {
  const {
    ttl        = 5 * 60 * 1000,
    enabled    = true,
    onSuccess,
    onError,
    refetchOnFocus = true,
    initialData,
  } = options

  const cached    = globalCache.get(key)
  const [data,    setData]    = useState(cached?.data ?? initialData ?? null)
  const [loading, setLoading] = useState(enabled && !isFresh(cached))
  const [error,   setError]   = useState(null)
  const mountedRef = useRef(true)
  const abortRef   = useRef(null)

  const run = useCallback(async (force = false) => {
    if (!enabled) return
    const entry = globalCache.get(key)
    if (!force && isFresh(entry)) {
      if (mountedRef.current) setData(entry.data)
      return
    }

    // Abort previous request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    if (mountedRef.current) setLoading(true)

    let attempts = 0
    while (attempts < 3) {
      try {
        const result = await fetcher(abortRef.current.signal)
        if (!mountedRef.current) return
        globalCache.set(key, { data: result, ts: Date.now(), ttlMs: ttl })
        setData(result)
        setError(null)
        onSuccess?.(result)
        return
      } catch (err) {
        if (err?.name === 'AbortError' || err?.name === 'CanceledError') return
        attempts++
        if (attempts >= 3) {
          if (!mountedRef.current) return
          setError(err)
          onError?.(err)
          return
        }
        await new Promise(r => setTimeout(r, 1000 * attempts))
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    }
  }, [key, enabled, ttl])

  useEffect(() => {
    mountedRef.current = true
    run()
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [key, enabled])

  // Refetch on window focus (like React Query)
  useEffect(() => {
    if (!refetchOnFocus || !enabled) return
    const handler = () => {
      const entry = globalCache.get(key)
      if (!isFresh(entry)) run(true)
    }
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [key, enabled])

  const refetch          = useCallback(() => run(true), [run])
  const invalidate       = useCallback(() => { globalCache.delete(key); run(true) }, [key, run])
  const optimisticUpdate = useCallback((newData) => {
    const entry = globalCache.get(key)
    if (entry) globalCache.set(key, { ...entry, data: newData })
    setData(newData)
  }, [key])

  return { data, loading, error, refetch, invalidate, optimisticUpdate }
}

export function useInfiniteQuery(key, fetcher, options = {}) {
  const { pageSize = 20, ttl = 5 * 60 * 1000, enabled = true } = options
  const [pages,    setPages]    = useState([])
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(false)
  const [hasMore,  setHasMore]  = useState(true)
  const [error,    setError]    = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const loadPage = useCallback(async (p) => {
    if (!enabled || loading) return
    setLoading(true)
    try {
      const result = await fetcher(p, pageSize)
      if (!mountedRef.current) return
      setPages(prev => p === 1 ? [result] : [...prev, result])
      setHasMore((result.data || result).length >= pageSize)
      setPage(p)
    } catch (err) {
      if (mountedRef.current) setError(err)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [enabled, fetcher, pageSize])

  useEffect(() => { loadPage(1) }, [key, enabled])

  const loadMore  = useCallback(() => { if (hasMore && !loading) loadPage(page + 1) }, [hasMore, loading, page, loadPage])
  const refresh   = useCallback(() => loadPage(1), [loadPage])
  const allItems  = pages.flatMap(p => p.data || p)

  return { pages, allItems, loading, hasMore, error, loadMore, refresh }
}

export function invalidateQuery(keyPrefix) {
  for (const k of globalCache.keys()) {
    if (k.startsWith(keyPrefix)) globalCache.delete(k)
  }
}

export function prefetchQuery(key, fetcher, ttl = 5 * 60 * 1000) {
  if (isFresh(globalCache.get(key))) return Promise.resolve()
  return fetcher().then(data => globalCache.set(key, { data, ts: Date.now(), ttlMs: ttl })).catch(() => {})
}
