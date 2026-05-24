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
  onOfflineReady() {
    // Tell the app via a custom event so it can flash a toast.
    window.dispatchEvent(new CustomEvent('pwa-offline-ready'))
  },
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('pwa-update-available'))
  },
  onRegisterError(error) {
    console.warn('SW registration failed', error)
  },
})
