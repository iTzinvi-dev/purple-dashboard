import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifestFilename: "manifest.json",
      includeAssets: ["favicon.svg", "apple-touch-icon.png", "icon-192x192.png", "icon-512x512.png", "icon.svg"],
      manifest: {
        name: "My Purple Space",
        short_name: "Purple",
        description: "A soft, dreamy place to journal and track your day. Local-first and encrypted.",
        theme_color: "#C8B4E3",
        background_color: "#DDD5EC",
        start_url: "/?source=pwa",
        display: "standalone",
        scope: "/",
        orientation: "portrait",
        icons: [
          { src: "icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        // Never cache user data, only the app shell + open-meteo (best-effort offline weather).
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "weather-cache",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "image-assets",
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600 },
            },
          },
          {
            urlPattern: /\.(?:woff2?|ttf|otf)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "font-assets",
              expiration: { maxEntries: 30, maxAgeSeconds: 90 * 24 * 3600 },
            },
          },
        ],
        navigateFallback: "/index.html",
        // Never cache OAuth or Drive API responses — they hold credentials/user data.
        navigateFallbackDenylist: [/^\/api\//, /accounts\.google\.com/, /googleapis\.com/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: { enabled: false, navigateFallback: "/" },
    }),
  ],
});
