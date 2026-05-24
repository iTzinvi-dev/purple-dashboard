/**
 * Central registry of localStorage keys used by the app + helpers
 * for backup/restore. Whenever a new feature adds a key, add it here
 * so it's automatically included in exports/imports.
 */

export const STORAGE_KEYS = [
  "notes_v2",              // NotesPage
  "audio_notes_v1",        // AudioNotesPage
  "pomodoro_settings_v1",  // ProductivityPage
  "pomodoro_count_v1",     // ProductivityPage
  "todos",                 // dashboard todos
  "moods",                 // dashboard moods
  "journal",               // dashboard journal
  "darkMode",              // settings
  "favorites_v1",          // favorites tab
  "onboarded_v1",          // onboarding completion
] as const;

export type BackupPayload = {
  app: "purple-dashboard";
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
};

const safeGet = (k: string): string | null => {
  try { return localStorage.getItem(k); } catch { return null; }
};

const safeSet = (k: string, v: string): boolean => {
  try { localStorage.setItem(k, v); return true; } catch { return false; }
};

const safeRemove = (k: string): boolean => {
  try { localStorage.removeItem(k); return true; } catch { return false; }
};

/** Returns a snapshot of all known keys that have a value set. */
export function exportAll(): BackupPayload {
  const data: Record<string, string> = {};
  for (const key of STORAGE_KEYS) {
    const val = safeGet(key);
    if (val !== null) data[key] = val;
  }
  return {
    app: "purple-dashboard",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

/** Validates an unknown payload against our schema. */
export function isValidBackup(obj: unknown): obj is BackupPayload {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  if (o.app !== "purple-dashboard") return false;
  if (o.version !== 1) return false;
  if (!o.data || typeof o.data !== "object") return false;
  // Every value must be a string (since localStorage stores strings)
  for (const v of Object.values(o.data as Record<string, unknown>)) {
    if (typeof v !== "string") return false;
  }
  return true;
}

export type ImportMode = "merge" | "replace";

/**
 * Apply a previously-exported backup. In "merge" mode, only writes keys
 * present in the backup. In "replace" mode, also clears any current
 * known keys not present in the backup.
 */
export function importAll(payload: BackupPayload, mode: ImportMode = "merge"): {
  applied: number;
  skipped: number;
} {
  let applied = 0;
  let skipped = 0;

  // Only restore keys we know about — defends against polluted backups
  for (const key of STORAGE_KEYS) {
    if (key in payload.data) {
      if (safeSet(key, payload.data[key])) applied++; else skipped++;
    }
  }

  if (mode === "replace") {
    for (const key of STORAGE_KEYS) {
      if (!(key in payload.data)) safeRemove(key);
    }
  }

  return { applied, skipped };
}

/** Wipe all known app data from localStorage. */
export function clearAll(): number {
  let removed = 0;
  for (const key of STORAGE_KEYS) {
    if (safeGet(key) !== null && safeRemove(key)) removed++;
  }
  return removed;
}

/** Approximate bytes used by our keys in localStorage (UTF-16 = 2 bytes/char). */
export function approximateBytes(): { total: number; perKey: Record<string, number> } {
  const perKey: Record<string, number> = {};
  let total = 0;
  for (const key of STORAGE_KEYS) {
    const val = safeGet(key);
    if (val === null) continue;
    const bytes = (key.length + val.length) * 2;
    perKey[key] = bytes;
    total += bytes;
  }
  return { total, perKey };
}

export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}
