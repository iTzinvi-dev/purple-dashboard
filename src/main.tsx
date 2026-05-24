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
// `autoUpdate` mode + `clientsClaim/skipWaiting` in workbox config means the
// new SW activates immediately. We pair that with a one-time controller-change
// reload so the page picks up the freshly-deployed JS too — without that,
// users keep running the precached old bundle until they manually refresh,
// which made post-deploy bug fixes (e.g. the home <-> audio notes link)
// invisible to anyone with the app already open.
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

// When a new SW takes control, reload once so the live page swaps to the new
// JS bundle. Guarded so we only reload a single time per session.
if ('serviceWorker' in navigator) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  })
}
