# Purple Dashboard

A soft, dreamy PWA for daily journaling, todos, mood tracking and notes — designed to be local-first, encrypted at rest, and fully usable offline.

## Privacy & security model

| Layer | What it protects |
|---|---|
| **AES-GCM-256 encryption at rest** | Every entry (todos, notes, journal, settings, drawings) is encrypted in IndexedDB. Browser extensions or raw IDB dumps see only ciphertext. |
| **Local-first** | No accounts required. No analytics. No telemetry. The app works fully offline. |
| **Self-hosted fonts** | No Google Fonts CDN — no third-party connection on page load. |
| **City-level geolocation** | Coordinates rounded to ~11km before sending to the weather API. |
| **CSP headers** | Outbound network is allow-listed: only `api.open-meteo.com` and (optionally) Google Drive. |
| **Optional Drive backup** | Re-encrypted with a passphrase derived via PBKDF2-SHA256 (600k iterations) **before** upload. Google sees only ciphertext. Stored in `appDataFolder` (hidden, app-only scope). Forgot the passphrase = the backup is unrecoverable. There is no reset. |
| **In-memory tokens** | Drive OAuth access tokens never touch persistent storage. |

## Setup

```bash
npm install
npm run dev
```

### Optional — enable Google Drive backup

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Enable the **Google Drive API** in your project.
3. Create an **OAuth 2.0 Client ID** of type *Web application*.
4. Add your origin (e.g. `https://your-app.vercel.app`, plus `http://localhost:5173` for dev) under *Authorized JavaScript origins*.
5. Copy the Client ID into a local `.env` file:

   ```env
   VITE_GOOGLE_CLIENT_ID=xxxxxxxxxx-xxxxxxxxx.apps.googleusercontent.com
   ```

6. On Vercel (or wherever you deploy), set the same `VITE_GOOGLE_CLIENT_ID` environment variable in the project settings, then redeploy.

The scope used is `drive.appdata` only — the backup file is invisible in your Drive UI and inaccessible to other apps. If `VITE_GOOGLE_CLIENT_ID` is unset, the **Backup** and **Restore backup** options simply do nothing; **Export to file / Import from file** continue to work fully offline.

## Backup format

Backups are JSON envelopes with base64 fields:

```json
{
  "app": "purple-dashboard",
  "version": 1,
  "iter": 600000,
  "salt": "…",
  "iv": "…",
  "ciphertext": "…",
  "createdAt": 1737000000000
}
```

The same envelope is used for both Drive backups and local `.purple` files, so you can move data between the two freely.

## Scripts

```bash
npm run dev      # local dev server
npm run build    # production build
npm run preview  # serve the production build
npm run lint     # eslint
```

## Stack

React 19 · TypeScript · Vite · Tailwind v4 · vite-plugin-pwa · Web Crypto · IndexedDB.
