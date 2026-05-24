import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register the service worker so the app works offline.
// `autoUpdate` mode + `clientsClaim/skipWaiting` in workbox config means
// new SW activates immediately. We just trigger a one-time refresh on update.
registerSW({
  immediate: true,
  onNeedRefresh() {
    // New version ready — auto-update is enabled, so we just refresh next nav.
    // (Could surface a UI banner here in future.)
  },
  onOfflineReady() {
    // Could log or surface a UI confirmation. Silent by design.
  },
  onRegisterError(error) {
    console.warn('SW registration failed', error)
  },
})
