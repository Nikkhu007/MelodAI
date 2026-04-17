/**
 * SongRadio — auto-queue similar songs when the queue is running low.
 * Mounts once in Layout, watches the queue silently.
 *
 * Works by calling /api/recommendations/similar/:songId
 * Adds 10 more songs to the queue when < 2 songs remain.
 */
import { useEffect, useRef } from 'react'
import usePlayerStore from '../../store/playerStore'
import { youtubeAPI } from '../../services/api'

export default function SongRadio() {
  const fetchingRef = useRef(false)

  useEffect(() => {
    const unsub = usePlayerStore.subscribe((state, prev) => {
      const { currentSong, queue, queueIndex, isPlaying } = state
      if (!currentSong || !isPlaying) return

      const remaining = queue.length - queueIndex - 1
      if (remaining >= 3 || fetchingRef.current) return

      // Queue is running low — fetch more songs
      fetchingRef.current = true
      loadMoreSongs(currentSong, queue, state.addToQueue)
        .finally(() => { fetchingRef.current = false })
    })
    return unsub
  }, [])

  return null
}

async function loadMoreSongs(currentSong, existingQueue, addToQueue) {
  const existingIds = new Set(existingQueue.map(s => s._id))

  try {
    // Use YouTube to find similar songs based on current song
    const query = currentSong.isYouTube
      ? `${currentSong.artist} similar songs`
      : `${currentSong.artist} ${currentSong.genre || ''} songs`

    const { data } = await youtubeAPI.search(query.trim(), 15, false)
    const newSongs = (data.songs || [])
      .filter(s => !existingIds.has(s._id))
      .map(s => ({ ...s, audioUrl: youtubeAPI.streamUrl(s.ytId) }))
      .slice(0, 8)

    for (const song of newSongs) {
      addToQueue(song)
    }
  } catch {}
}
