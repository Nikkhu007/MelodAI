import { useEffect, useRef, useCallback } from 'react'

export function useInfiniteScroll(onLoadMore, { threshold = 0.1, enabled = true } = {}) {
  const sentinelRef = useRef(null)

  const observe = useCallback(() => {
    if (!sentinelRef.current || !enabled) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onLoadMore()
    }, { threshold })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [onLoadMore, enabled, threshold])

  useEffect(() => {
    const cleanup = observe()
    return cleanup
  }, [observe])

  return sentinelRef
}
