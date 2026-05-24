/**
 * Backup / restore helpers.
 *
 *  - JSON file: works fully offline, no external deps. Safest, recommended.
 *  - Google Drive: optional. Stores in the hidden "appDataFolder" so we
 *    can only see files this app created — better privacy. Requires a
 *    Google Cloud OAuth Client ID at build time:
 *      VITE_GOOGLE_CLIENT_ID=<your-id>.apps.googleusercontent.com
 *
 * If VITE_GOOGLE_CLIENT_ID is not set, Drive functions throw a friendly
 * error which the UI catches and shows as a setup hint.
 */

import { exportAll, importAll, isValidBackup, type BackupPayload, type ImportMode } from "./storage";

// ─────────────────────────── JSON file ───────────────────────────

export function downloadJsonBackup(): void {
  const payload = exportAll();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `purple-dashboard-backup-${date}.json`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importJsonFile(file: File, mode: ImportMode = "merge"): Promise<{ applied: number; skipped: number }> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("file is not valid JSON");
  }
  if (!isValidBackup(parsed)) {
    throw new Error("not a valid purple-dashboard backup file");
  }
  return importAll(parsed, mode);
}

// ─────────────────────────── Google Drive ───────────────────────────

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || "";
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const BACKUP_FILENAME = "purple-dashboard-backup.json";

export const isDriveConfigured = (): boolean => !!CLIENT_ID;

interface TokenResponse {
  access_token: string;
  expires_in?: number;
  error?: string;
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (resp: TokenResponse) => void;
    error_callback?: (err: unknown) => void;
  }) => { requestAccessToken: (overrides?: { prompt?: string }) => void };
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleAccountsOAuth2 } };
  }
}

let gisLoadingPromise: Promise<void> | null = null;
const loadGoogleIdentityServices = (): Promise<void> => {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadingPromise) return gisLoadingPromise;
  gisLoadingPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) resolve();
      else reject(new Error("Google sign-in failed to initialize"));
    };
    script.onerror = () => reject(new Error("could not reach Google sign-in (offline?)"));
    document.head.appendChild(script);
  });
  return gisLoadingPromise;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

const requestAccessToken = (forcePrompt = false): Promise<string> =>
  new Promise<string>(async (resolve, reject) => {
    if (!isDriveConfigured()) {
      reject(new Error("Google Drive is not configured — set VITE_GOOGLE_CLIENT_ID to enable"));
      return;
    }
    if (!forcePrompt && cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
      resolve(cachedToken.token);
      return;
    }
    try {
      await loadGoogleIdentityServices();
      const oauth2 = window.google!.accounts!.oauth2!;
      const client = oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(`Google sign-in: ${resp.error}`));
            return;
          }
          if (!resp.access_token) {
            reject(new Error("no access token returned"));
            return;
          }
          cachedToken = {
            token: resp.access_token,
            expiresAt: Date.now() + ((resp.expires_in ?? 3600) * 1000),
          };
          resolve(resp.access_token);
        },
        error_callback: (err) => reject(err instanceof Error ? err : new Error("Google sign-in cancelled")),
      });
      client.requestAccessToken({ prompt: forcePrompt ? "consent" : "" });
    } catch (e) {
      reject(e);
    }
  });

const driveFetch = async (url: string, init: RequestInit, token: string): Promise<Response> => {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    cachedToken = null;
    throw new Error("Google session expired — please sign in again");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Drive API error ${res.status}: ${text || res.statusText}`);
  }
  return res;
};

const findExistingBackupFileId = async (token: string): Promise<string | null> => {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name='${BACKUP_FILENAME}' and trashed=false`,
    fields: "files(id,name,modifiedTime)",
    pageSize: "1",
  });
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?${params}`, { method: "GET" }, token);
  const data = (await res.json()) as { files?: Array<{ id: string }> };
  return data.files?.[0]?.id ?? null;
};

/** Upload current data as the single backup file in appDataFolder. */
export async function uploadToDrive(): Promise<{ fileId: string; bytes: number }> {
  const token = await requestAccessToken();
  const payload: BackupPayload = exportAll();
  const body = JSON.stringify(payload, null, 2);

  const existing = await findExistingBackupFileId(token);

  // Use multipart upload so we can set parents (only on create) and content in one request.
  const boundary = `purple_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const metadata: Record<string, unknown> = { name: BACKUP_FILENAME, mimeType: "application/json" };
  if (!existing) metadata.parents = ["appDataFolder"];

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${body}\r\n` +
    `--${boundary}--`;

  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

  const res = await driveFetch(url, {
    method: existing ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body: multipartBody,
  }, token);

  const data = (await res.json()) as { id: string };
  return { fileId: data.id, bytes: new Blob([body]).size };
}

/** Download the most recent backup from Drive and apply it. */
export async function restoreFromDrive(mode: ImportMode = "merge"): Promise<{
  fileId: string;
  applied: number;
  skipped: number;
  exportedAt: string;
}> {
  const token = await requestAccessToken();
  const fileId = await findExistingBackupFileId(token);
  if (!fileId) throw new Error("no backup found in Google Drive");

  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { method: "GET" },
    token,
  );
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Drive backup file is corrupted");
  }
  if (!isValidBackup(parsed)) throw new Error("Drive file is not a purple-dashboard backup");

  const result = importAll(parsed, mode);
  return { fileId, ...result, exportedAt: parsed.exportedAt };
}

/** Forget the local Drive token (does not revoke at Google). */
export function signOutOfDrive(): void {
  cachedToken = null;
}
