/**
 * Local backup / restore — JSON file only.
 *  - Works fully offline
 *  - No third-party dependencies
 *  - Validates payload schema before applying
 */

import { exportAll, importAll, isValidBackup, type ImportMode } from "./storage";

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

export async function importJsonFile(
  file: File,
  mode: ImportMode = "merge",
): Promise<{ applied: number; skipped: number }> {
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
