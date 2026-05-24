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
      injectRegister: false, // we register explicitly from main.tsx for full control
      manifestFilename: 'manifest.webmanifest',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icon-192x192.png',
        'icon-512x512.png',
        'icon.svg',
      ],
      manifest: {
        name: 'My Purple Space 💜',
        short_name: 'Purple',
        description: 'A soft, dreamy space to journal, track your day, and find a little quiet.',
        theme_color: '#C8B4E3',
        background_color: '#EDE5FA',
        start_url: '/?source=pwa',
        display: 'standalone',
        scope: '/',
        orientation: 'portrait',
        categories: ['lifestyle', 'productivity'],
        icons: [
          { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the full app shell (HTML + JS + CSS + images + fonts)
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff,woff2}'],
        // Make navigation requests fall back to the cached index.html for full offline support
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          // Google Fonts CSS
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 3600 },
            },
          },
          // Google Fonts files
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Weather API — try network first, fall back to cache, fast timeout
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 20, maxAgeSeconds: 6 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Same-origin images
          {
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-assets',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
})
