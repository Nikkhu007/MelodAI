// vite.config.js
import { defineConfig } from "file:///D:/code/.vscode/melodai/melodai/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///D:/code/.vscode/melodai/melodai/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///D:/code/.vscode/melodai/melodai/frontend/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "masked-icon.svg"],
      // Service worker config
      workbox: {
        // Cache all static assets
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Cache API responses for offline
        runtimeCaching: [
          {
            urlPattern: /^\/api\/songs\?/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "api-songs",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 }
            }
          },
          {
            urlPattern: /^\/api\/songs\/trending/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-trending",
              expiration: { maxEntries: 10, maxAgeSeconds: 600 }
            }
          },
          {
            // Cache cover images
            urlPattern: /picsum\.photos|cloudinary\.com/,
            handler: "CacheFirst",
            options: {
              cacheName: "cover-images",
              expiration: { maxEntries: 200, maxAgeSeconds: 86400 * 7 }
            }
          }
        ]
      },
      // App manifest — this is what makes it installable
      manifest: {
        name: "MelodAI \u2014 AI Music Streaming",
        short_name: "MelodAI",
        description: "AI-powered music streaming with YouTube, lyrics, mood radio and more",
        theme_color: "#6c47ff",
        background_color: "#0a0a0f",
        display: "standalone",
        // fullscreen, no browser bar
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        lang: "en",
        categories: ["music", "entertainment"],
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ],
        // App shortcuts (long press on icon)
        shortcuts: [
          { name: "Search Music", short_name: "Search", url: "/search", icons: [{ src: "/pwa-192.png", sizes: "192x192" }] },
          { name: "Mood Radio", short_name: "Mood", url: "/mood", icons: [{ src: "/pwa-192.png", sizes: "192x192" }] },
          { name: "Liked Songs", short_name: "Liked", url: "/liked", icons: [{ src: "/pwa-192.png", sizes: "192x192" }] }
        ],
        // Screenshots for app store-like install prompt
        screenshots: [
          { src: "/screenshot-mobile.png", sizes: "390x844", type: "image/png", form_factor: "narrow" }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    strictPort: false,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("error", (err) => {
            console.log("[Vite Proxy] Backend not reachable:", err.message);
          });
        }
      }
    }
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
          zustand: ["zustand"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxjb2RlXFxcXC52c2NvZGVcXFxcbWVsb2RhaVxcXFxtZWxvZGFpXFxcXGZyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxjb2RlXFxcXC52c2NvZGVcXFxcbWVsb2RhaVxcXFxtZWxvZGFpXFxcXGZyb250ZW5kXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9jb2RlLy52c2NvZGUvbWVsb2RhaS9tZWxvZGFpL2Zyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnXG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIFZpdGVQV0Eoe1xuICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ2FwcGxlLXRvdWNoLWljb24ucG5nJywgJ21hc2tlZC1pY29uLnN2ZyddLFxuXG4gICAgICAvLyBTZXJ2aWNlIHdvcmtlciBjb25maWdcbiAgICAgIHdvcmtib3g6IHtcbiAgICAgICAgLy8gQ2FjaGUgYWxsIHN0YXRpYyBhc3NldHNcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnLHdvZmYyfSddLFxuICAgICAgICAvLyBDYWNoZSBBUEkgcmVzcG9uc2VzIGZvciBvZmZsaW5lXG4gICAgICAgIHJ1bnRpbWVDYWNoaW5nOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL15cXC9hcGlcXC9zb25nc1xcPy8sXG4gICAgICAgICAgICBoYW5kbGVyOiAnU3RhbGVXaGlsZVJldmFsaWRhdGUnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdhcGktc29uZ3MnLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7IG1heEVudHJpZXM6IDUwLCBtYXhBZ2VTZWNvbmRzOiAzMDAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXlxcL2FwaVxcL3NvbmdzXFwvdHJlbmRpbmcvLFxuICAgICAgICAgICAgaGFuZGxlcjogJ05ldHdvcmtGaXJzdCcsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ2FwaS10cmVuZGluZycsXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHsgbWF4RW50cmllczogMTAsIG1heEFnZVNlY29uZHM6IDYwMCB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIENhY2hlIGNvdmVyIGltYWdlc1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL3BpY3N1bVxcLnBob3Rvc3xjbG91ZGluYXJ5XFwuY29tLyxcbiAgICAgICAgICAgIGhhbmRsZXI6ICdDYWNoZUZpcnN0JyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnY292ZXItaW1hZ2VzJyxcbiAgICAgICAgICAgICAgZXhwaXJhdGlvbjogeyBtYXhFbnRyaWVzOiAyMDAsIG1heEFnZVNlY29uZHM6IDg2NDAwICogNyB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcblxuICAgICAgLy8gQXBwIG1hbmlmZXN0IFx1MjAxNCB0aGlzIGlzIHdoYXQgbWFrZXMgaXQgaW5zdGFsbGFibGVcbiAgICAgIG1hbmlmZXN0OiB7XG4gICAgICAgIG5hbWU6ICAgICAgICAgICAgICdNZWxvZEFJIFx1MjAxNCBBSSBNdXNpYyBTdHJlYW1pbmcnLFxuICAgICAgICBzaG9ydF9uYW1lOiAgICAgICAnTWVsb2RBSScsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAgICAgICdBSS1wb3dlcmVkIG11c2ljIHN0cmVhbWluZyB3aXRoIFlvdVR1YmUsIGx5cmljcywgbW9vZCByYWRpbyBhbmQgbW9yZScsXG4gICAgICAgIHRoZW1lX2NvbG9yOiAgICAgICcjNmM0N2ZmJyxcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyMwYTBhMGYnLFxuICAgICAgICBkaXNwbGF5OiAgICAgICAgICAnc3RhbmRhbG9uZScsICAgICAgLy8gZnVsbHNjcmVlbiwgbm8gYnJvd3NlciBiYXJcbiAgICAgICAgb3JpZW50YXRpb246ICAgICAgJ3BvcnRyYWl0JyxcbiAgICAgICAgc3RhcnRfdXJsOiAgICAgICAgJy8nLFxuICAgICAgICBzY29wZTogICAgICAgICAgICAnLycsXG4gICAgICAgIGxhbmc6ICAgICAgICAgICAgICdlbicsXG4gICAgICAgIGNhdGVnb3JpZXM6ICAgICAgIFsnbXVzaWMnLCAnZW50ZXJ0YWlubWVudCddLFxuXG4gICAgICAgIGljb25zOiBbXG4gICAgICAgICAgeyBzcmM6ICcvcHdhLTE5Mi5wbmcnLCAgc2l6ZXM6ICcxOTJ4MTkyJywgdHlwZTogJ2ltYWdlL3BuZycgfSxcbiAgICAgICAgICB7IHNyYzogJy9wd2EtNTEyLnBuZycsICBzaXplczogJzUxMng1MTInLCB0eXBlOiAnaW1hZ2UvcG5nJyB9LFxuICAgICAgICAgIHsgc3JjOiAnL3B3YS01MTIucG5nJywgIHNpemVzOiAnNTEyeDUxMicsIHR5cGU6ICdpbWFnZS9wbmcnLCBwdXJwb3NlOiAnYW55IG1hc2thYmxlJyB9LFxuICAgICAgICBdLFxuXG4gICAgICAgIC8vIEFwcCBzaG9ydGN1dHMgKGxvbmcgcHJlc3Mgb24gaWNvbilcbiAgICAgICAgc2hvcnRjdXRzOiBbXG4gICAgICAgICAgeyBuYW1lOiAnU2VhcmNoIE11c2ljJywgIHNob3J0X25hbWU6ICdTZWFyY2gnLCAgdXJsOiAnL3NlYXJjaCcsICBpY29uczogW3sgc3JjOiAnL3B3YS0xOTIucG5nJywgc2l6ZXM6ICcxOTJ4MTkyJyB9XSB9LFxuICAgICAgICAgIHsgbmFtZTogJ01vb2QgUmFkaW8nLCAgICBzaG9ydF9uYW1lOiAnTW9vZCcsICAgIHVybDogJy9tb29kJywgICAgaWNvbnM6IFt7IHNyYzogJy9wd2EtMTkyLnBuZycsIHNpemVzOiAnMTkyeDE5MicgfV0gfSxcbiAgICAgICAgICB7IG5hbWU6ICdMaWtlZCBTb25ncycsICAgc2hvcnRfbmFtZTogJ0xpa2VkJywgICB1cmw6ICcvbGlrZWQnLCAgIGljb25zOiBbeyBzcmM6ICcvcHdhLTE5Mi5wbmcnLCBzaXplczogJzE5MngxOTInIH1dIH0sXG4gICAgICAgIF0sXG5cbiAgICAgICAgLy8gU2NyZWVuc2hvdHMgZm9yIGFwcCBzdG9yZS1saWtlIGluc3RhbGwgcHJvbXB0XG4gICAgICAgIHNjcmVlbnNob3RzOiBbXG4gICAgICAgICAgeyBzcmM6ICcvc2NyZWVuc2hvdC1tb2JpbGUucG5nJywgc2l6ZXM6ICczOTB4ODQ0JywgdHlwZTogJ2ltYWdlL3BuZycsIGZvcm1fZmFjdG9yOiAnbmFycm93JyB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KSxcbiAgXSxcblxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiAgICAgICA1MTczLFxuICAgIHN0cmljdFBvcnQ6IGZhbHNlLFxuICAgIGhvc3Q6ICAgICAgICcwLjAuMC4wJyxcbiAgICBwcm94eToge1xuICAgICAgJy9hcGknOiB7XG4gICAgICAgIHRhcmdldDogICAgICAgJ2h0dHA6Ly9sb2NhbGhvc3Q6NTAwMCcsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiAgICAgICBmYWxzZSxcbiAgICAgICAgY29uZmlndXJlOiAocHJveHkpID0+IHtcbiAgICAgICAgICBwcm94eS5vbignZXJyb3InLCAoZXJyKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW1ZpdGUgUHJveHldIEJhY2tlbmQgbm90IHJlYWNoYWJsZTonLCBlcnIubWVzc2FnZSlcbiAgICAgICAgICB9KVxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiAgICAnZGlzdCcsXG4gICAgc291cmNlbWFwOiBmYWxzZSxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgdmVuZG9yOiAgWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxuICAgICAgICAgIG1vdGlvbjogIFsnZnJhbWVyLW1vdGlvbiddLFxuICAgICAgICAgIHp1c3RhbmQ6IFsnenVzdGFuZCddLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBc1QsU0FBUyxvQkFBb0I7QUFDblYsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUV4QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixRQUFRO0FBQUEsTUFDTixjQUFjO0FBQUEsTUFDZCxlQUFlLENBQUMsZUFBZSx3QkFBd0IsaUJBQWlCO0FBQUE7QUFBQSxNQUd4RSxTQUFTO0FBQUE7QUFBQSxRQUVQLGNBQWMsQ0FBQyxzQ0FBc0M7QUFBQTtBQUFBLFFBRXJELGdCQUFnQjtBQUFBLFVBQ2Q7QUFBQSxZQUNFLFlBQVk7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNQLFdBQVc7QUFB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
