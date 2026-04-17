/**
 * Extract dominant color from an image URL using canvas sampling.
 * Returns a hex color string or null.
 *
 * Cached per URL to avoid re-processing.
 */
const colorCache = new Map()

export function extractDominantColor(imageUrl) {
  if (!imageUrl) return Promise.resolve(null)
  if (colorCache.has(imageUrl)) return Promise.resolve(colorCache.get(imageUrl))

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 32
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, size, size)

        const data = ctx.getImageData(0, 0, size, size).data
        const counts = {}
        let bestColor = null, bestCount = 0

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2]
          const a = data[i+3]
          if (a < 200) continue
          // Skip near-black and near-white
          const brightness = (r + g + b) / 3
          if (brightness < 30 || brightness > 240) continue
          // Skip low-saturation (gray) colors
          const max = Math.max(r, g, b), min = Math.min(r, g, b)
          if (max - min < 30) continue

          // Bucket to 32-step grid to group similar colors
          const key = `${Math.round(r/32)*32}-${Math.round(g/32)*32}-${Math.round(b/32)*32}`
          counts[key] = (counts[key] || 0) + 1
          if (counts[key] > bestCount) {
            bestCount = counts[key]
            bestColor = [Math.round(r/32)*32, Math.round(g/32)*32, Math.round(b/32)*32]
          }
        }

        if (!bestColor) {
          resolve(null)
          return
        }
        const hex = '#' + bestColor.map(c => c.toString(16).padStart(2, '0')).join('')
        colorCache.set(imageUrl, hex)
        resolve(hex)
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = imageUrl
  })
}
