import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],

      // Service worker config
      workbox: {
        // Cache all static assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Cache API responses for offline
        runtimeCaching: [
          {
            urlPattern: /^\/api\/songs\?/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-songs',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: /^\/api\/songs\/trending/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-trending',
              expiration: { maxEntries: 10, maxAgeSeconds: 600 },
            },
          },
          {
            // Cache cover images
            urlPattern: /picsum\.photos|cloudinary\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cover-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 * 7 },
            },
          },
        ],
      },

      // App manifest — this is what makes it installable
      manifest: {
        name:             'MelodAI — AI Music Streaming',
        short_name:       'MelodAI',
        description:      'AI-powered music streaming with YouTube, lyrics, mood radio and more',
        theme_color:      '#6c47ff',
        background_color: '#0a0a0f',
        display:          'standalone',      // fullscreen, no browser bar
        orientation:      'portrait',
        start_url:        '/',
        scope:            '/',
        lang:             'en',
        categories:       ['music', 'entertainment'],

        icons: [
          { src: '/pwa-192.png',  sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png',  sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png',  sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],

        // App shortcuts (long press on icon)
        shortcuts: [
          { name: 'Search Music',  short_name: 'Search',  url: '/search',  icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'Mood Radio',    short_name: 'Mood',    url: '/mood',    icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
          { name: 'Liked Songs',   short_name: 'Liked',   url: '/liked',   icons: [{ src: '/pwa-192.png', sizes: '192x192' }] },
        ],

        // Screenshots for app store-like install prompt
        screenshots: [
          { src: '/screenshot-mobile.png', sizes: '390x844', type: 'image/png', form_factor: 'narrow' },
        ],
      },
    }),
  ],

  server: {
    port:       5173,
    strictPort: false,
    host:       '0.0.0.0',
    proxy: {
      '/api': {
        target:       'http://localhost:5000',
        changeOrigin: true,
        secure:       false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('[Vite Proxy] Backend not reachable:', err.message)
          })
        },
      },
    },
  },

  build: {
    outDir:    'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom', 'react-router-dom'],
          motion:  ['framer-motion'],
          zustand: ['zustand'],
        },
      },
    },
  },
})
