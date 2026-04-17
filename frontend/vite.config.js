import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,   // if 5173 taken, try next port automatically
    proxy: {
      // ALL /api requests → backend regardless of what port Vite is on
      '/api': {
        target:      'http://localhost:5000',
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
