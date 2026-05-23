// Google Drive backup integration.
// - Lazy-loads Google Identity Services only on demand (no third-party calls until user clicks Backup).
// - Uses drive.appdata scope: hidden per-app folder, invisible to other apps and the user's Drive UI.
// - Access token lives in JS memory only, never persisted. Cleared on tab close.
//
// Setup: define VITE_GOOGLE_CLIENT_ID at build time. See README.

const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const GIS_SRC = "https://accounts.google.com/gsi/client";

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (resp: TokenResponse) => void;
  error_callback?: (err: unknown) => void;
}

interface TokenClient {
  requestAccessToken: (override?: { prompt?: string }) => void;
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (cfg: TokenClientConfig) => TokenClient;
  revoke: (token: string, done: () => void) => void;
}

interface GoogleGlobal { accounts: { oauth2: GoogleAccountsOAuth2 } }

declare global { interface Window { google?: GoogleGlobal } }

let cachedToken: { value: string; expiresAt: number } | null = null;
let gisLoading: Promise<void> | null = null;

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();

export const isDriveConfigured = (): boolean => CLIENT_ID.length > 0;

const loadGsi = (): Promise<void> => {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;
  gisLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.referrerPolicy = "no-referrer";
    s.onload = () => resolve();
    s.onerror = () => { gisLoading = null; reject(new Error("GIS load failed")); };
    document.head.appendChild(s);
  });
  return gisLoading;
};

const requestToken = async (force: boolean): Promise<string> => {
  if (!CLIENT_ID) throw new Error("Drive not configured");
  if (!force && cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  await loadGsi();
  return new Promise<string>((resolve, reject) => {
    const oauth2 = window.google?.accounts.oauth2;
    if (!oauth2) { reject(new Error("GIS unavailable")); return; }
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) { reject(new Error(resp.error ?? "Sign-in cancelled")); return; }
        cachedToken = { value: resp.access_token, expiresAt: Date.now() + resp.expires_in * 1000 };
        resolve(resp.access_token);
      },
      error_callback: (err) => reject(err instanceof Error ? err : new Error("Sign-in failed")),
    });
    client.requestAccessToken({ prompt: force ? "consent" : "" });
  });
};

export const signIn = (): Promise<string> => requestToken(true);

export const signOut = async (): Promise<void> => {
  const tok = cachedToken?.value;
  cachedToken = null;
  if (!tok) return;
  await loadGsi().catch(() => undefined);
  const oauth2 = window.google?.accounts.oauth2;
  if (oauth2) await new Promise<void>((res) => oauth2.revoke(tok, () => res()));
};

const authedFetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const tok = await requestToken(false);
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${tok}` },
    referrerPolicy: "no-referrer",
  });
  if (res.status === 401) {
    cachedToken = null;
    const fresh = await requestToken(true);
    return fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${fresh}` },
      referrerPolicy: "no-referrer",
    });
  }
  return res;
};

export interface DriveBackup {
  id: string;
  name: string;
  modifiedTime: string;
  size: number;
}

export const listBackups = async (): Promise<DriveBackup[]> => {
  const url = "https://www.googleapis.com/drive/v3/files"
    + "?spaces=appDataFolder"
    + "&fields=files(id,name,modifiedTime,size)"
    + "&orderBy=modifiedTime desc"
    + "&pageSize=50";
  const res = await authedFetch(url);
  if (!res.ok) throw new Error(`List failed (${res.status})`);
  const json = await res.json() as { files?: Array<{ id: string; name: string; modifiedTime: string; size?: string }> };
  return (json.files ?? []).map(f => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
    size: Number(f.size ?? 0),
  }));
};

export const uploadBackup = async (filename: string, payload: Uint8Array): Promise<DriveBackup> => {
  const boundary = "purple_" + Math.random().toString(36).slice(2);
  const meta = JSON.stringify({ name: filename, parents: ["appDataFolder"], mimeType: "application/octet-stream" });
  const enc = new TextEncoder();
  const head = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`);
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + payload.length + tail.length);
  body.set(head, 0); body.set(payload, head.length); body.set(tail, head.length + payload.length);

  const res = await authedFetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const json = await res.json() as { id: string; name: string; modifiedTime: string; size?: string };
  return { id: json.id, name: json.name, modifiedTime: json.modifiedTime, size: Number(json.size ?? payload.length) };
};

export const downloadBackup = async (fileId: string): Promise<Uint8Array> => {
  const res = await authedFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
};

export const deleteBackup = async (fileId: string): Promise<void> => {
  const res = await authedFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`Delete failed (${res.status})`);
};
