// High-level encrypted storage API.
// Master key is generated on first run and lives in IndexedDB (no user lock).
// All persisted records (todos, notes, journal, settings, etc.) are encrypted at rest.
//
// Threat model — protects against:
//   - Casual IDB / disk dumps reading user data in plain text
//   - Browser extensions or other apps reading the same-origin key/value store directly
// Does NOT protect against active malware in the page or attackers with full device access
// (a future optional lock-screen feature can layer passphrase wrapping on top).

import {
  generateMasterKey, exportRawKey, importRawKey,
  encryptJson, decryptJson, type EncryptedBlob,
} from "./crypto";
import { idbGet, idbSet, idbDel, idbClear, idbKeys } from "./db";

const MASTER_KEY = "meta:master";
const MIGRATION_KEY = "meta:migrated";
const PREFIX = "data:";

let masterKey: CryptoKey | null = null;
let initPromise: Promise<void> | null = null;

const ensureKey = async (): Promise<CryptoKey> => {
  if (masterKey) return masterKey;
  const stored = await idbGet<Uint8Array>(MASTER_KEY);
  if (stored) {
    masterKey = await importRawKey(stored);
  } else {
    const k = await generateMasterKey();
    const raw = await exportRawKey(k);
    await idbSet(MASTER_KEY, raw);
    masterKey = k;
  }
  return masterKey;
};

export const initStorage = (): Promise<void> => {
  if (initPromise) return initPromise;
  initPromise = (async () => { await ensureKey(); })();
  return initPromise;
};

export const getEncrypted = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const k = await ensureKey();
    const blob = await idbGet<EncryptedBlob>(PREFIX + key);
    if (!blob) return fallback;
    return await decryptJson<T>(k, blob);
  } catch {
    return fallback;
  }
};

export const setEncrypted = async (key: string, value: unknown): Promise<void> => {
  const k = await ensureKey();
  const blob = await encryptJson(k, value);
  await idbSet(PREFIX + key, blob);
};

export const removeEncrypted = (key: string): Promise<void> => idbDel(PREFIX + key);

// Read every encrypted record into a plain object — used for export/backup.
export const dumpAll = async (): Promise<Record<string, unknown>> => {
  const k = await ensureKey();
  const all = await idbKeys();
  const out: Record<string, unknown> = {};
  for (const key of all) {
    if (typeof key !== "string" || !key.startsWith(PREFIX)) continue;
    const blob = await idbGet<EncryptedBlob>(key);
    if (!blob) continue;
    try {
      out[key.slice(PREFIX.length)] = await decryptJson<unknown>(k, blob);
    } catch {
      // skip corrupt entries; never throw on backup
    }
  }
  return out;
};

// Replace local data with an external object (used during restore).
export const replaceAll = async (data: Record<string, unknown>): Promise<void> => {
  const k = await ensureKey();
  const all = await idbKeys();
  for (const key of all) {
    if (typeof key === "string" && key.startsWith(PREFIX)) await idbDel(key);
  }
  for (const [k2, v] of Object.entries(data)) {
    const blob = await encryptJson(k, v);
    await idbSet(PREFIX + k2, blob);
  }
};

// Wipe everything — including master key. Next launch starts fresh.
export const wipeAll = async (): Promise<void> => {
  await idbClear();
  masterKey = null;
  initPromise = null;
};

export { MIGRATION_KEY };
