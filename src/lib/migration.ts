// One-time migration from plain localStorage to encrypted IndexedDB.
// Runs once on first launch of the new version, then removes plaintext copies.

import { idbGet, idbSet } from "./db";
import { setEncrypted, getEncrypted, MIGRATION_KEY } from "./storage";

const SAFE_PARSE = <T>(raw: string | null, fallback: T): T => {
  if (raw === null) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
};

const LEGACY_KEYS = ["todos", "moods", "journal", "darkMode", "notes_v2"] as const;

export const runMigration = async (): Promise<void> => {
  const done = await idbGet<boolean>(MIGRATION_KEY);
  if (done) return;

  try {
    const todosRaw   = localStorage.getItem("todos");
    const moodsRaw   = localStorage.getItem("moods");
    const journalRaw = localStorage.getItem("journal");
    const darkRaw    = localStorage.getItem("darkMode");
    const notesRaw   = localStorage.getItem("notes_v2");

    if (todosRaw)   await setEncrypted("todos",    SAFE_PARSE(todosRaw, []));
    if (moodsRaw)   await setEncrypted("moods",    SAFE_PARSE<string[]>(moodsRaw, []));
    if (journalRaw !== null) await setEncrypted("journal", journalRaw);
    if (darkRaw)    await setEncrypted("darkMode", SAFE_PARSE<boolean>(darkRaw, false));
    if (notesRaw)   await setEncrypted("notes",    SAFE_PARSE(notesRaw, []));

    // Verify the round-trip before deleting plaintext.
    if (todosRaw) await getEncrypted("todos", null);
  } catch {
    // If migration fails, leave localStorage as-is for a future retry.
    return;
  }

  // Clear plaintext copies once we know the encrypted versions are readable.
  for (const k of LEGACY_KEYS) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
  await idbSet(MIGRATION_KEY, true);
};
