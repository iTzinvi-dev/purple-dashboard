import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifestFilename: 'manifest.json',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192x192.png', 'icon-512x512.png', 'icon.svg'],
      manifest: {
        name: 'My Purple Space 💜',
        short_name: 'Purple',
        description: 'Notes & Daily Activities — a soft, dreamy place to journal and track your day.',
        theme_color: '#C8B4E3',
        background_color: '#DDD5EC',
        start_url: '/?source=pwa',
        display: 'standalone',
        scope: '/',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 60, maxAgeSeconds: 24 * 3600 }
            }
          },
          {
            urlPattern: /\/.*\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 }
            }
          },
          {
            urlPattern: /\/.*\.(?:css|js)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
              expiration: { maxEntries: 60 }
            }
          }
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      },
      devOptions: { enabled: true, navigateFallback: '/' }
    })
  ]
})
