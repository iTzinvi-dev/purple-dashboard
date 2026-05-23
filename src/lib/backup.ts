// Backup payload format and end-to-end create/restore helpers.
// Wire format: a JSON envelope with base64 fields. Compact, portable, encrypted.

import {
  deriveKeyFromPassphrase, encryptBytes, decryptBytes,
  randomBytes, bytesToBase64, base64ToBytes,
  PBKDF2_ITERATIONS, SALT_BYTES,
} from "./crypto";
import { dumpAll, replaceAll } from "./storage";
import * as drive from "./drive";

export const BACKUP_VERSION = 1;

interface BackupEnvelope {
  app: "purple-dashboard";
  version: number;
  iter: number;
  salt: string;        // base64
  iv: string;          // base64
  ciphertext: string;  // base64
  createdAt: number;
}

const buildEnvelope = async (passphrase: string, plain: Uint8Array): Promise<Uint8Array> => {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKeyFromPassphrase(passphrase, salt);
  const { iv, ct } = await encryptBytes(key, plain);
  const env: BackupEnvelope = {
    app: "purple-dashboard",
    version: BACKUP_VERSION,
    iter: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ct),
    createdAt: Date.now(),
  };
  return new TextEncoder().encode(JSON.stringify(env));
};

const openEnvelope = async (passphrase: string, payload: Uint8Array): Promise<Uint8Array> => {
  const text = new TextDecoder().decode(payload);
  let env: BackupEnvelope;
  try { env = JSON.parse(text) as BackupEnvelope; }
  catch { throw new Error("Backup file is not valid"); }
  if (env.app !== "purple-dashboard") throw new Error("Not a Purple backup file");
  if (env.version !== BACKUP_VERSION) throw new Error(`Unsupported backup version ${env.version}`);

  const salt = base64ToBytes(env.salt);
  const iv = base64ToBytes(env.iv);
  const ct = base64ToBytes(env.ciphertext);
  const key = await deriveKeyFromPassphrase(passphrase, salt, env.iter);
  try {
    return await decryptBytes(key, { iv, ct });
  } catch {
    throw new Error("Wrong password or corrupted backup");
  }
};

// Build an encrypted backup blob from current local data.
export const createBackupBytes = async (passphrase: string): Promise<Uint8Array> => {
  const data = await dumpAll();
  const plain = new TextEncoder().encode(JSON.stringify(data));
  return buildEnvelope(passphrase, plain);
};

// Decrypt an envelope and write its contents into local storage.
export const restoreBackupBytes = async (passphrase: string, payload: Uint8Array): Promise<void> => {
  const plain = await openEnvelope(passphrase, payload);
  const obj = JSON.parse(new TextDecoder().decode(plain)) as Record<string, unknown>;
  await replaceAll(obj);
};

// Local file export — works fully offline, no Google account needed.
export const exportToFile = async (passphrase: string): Promise<void> => {
  const bytes = await createBackupBytes(passphrase);
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href = url;
  a.download = `purple-backup-${stamp}.purple`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const importFromFile = async (passphrase: string, file: File): Promise<void> => {
  const buf = new Uint8Array(await file.arrayBuffer());
  await restoreBackupBytes(passphrase, buf);
};

// Drive flows.
export const backupToDrive = async (passphrase: string): Promise<drive.DriveBackup> => {
  const bytes = await createBackupBytes(passphrase);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return drive.uploadBackup(`purple-backup-${stamp}.purple`, bytes);
};

export const restoreFromDrive = async (passphrase: string, fileId: string): Promise<void> => {
  const bytes = await drive.downloadBackup(fileId);
  await restoreBackupBytes(passphrase, bytes);
};

export const listDriveBackups = drive.listBackups;
export const deleteDriveBackup = drive.deleteBackup;
export const driveSignIn = drive.signIn;
export const driveSignOut = drive.signOut;
export const isDriveConfigured = drive.isDriveConfigured;
