// Shared audio library — single source of truth for both the home music player
// and the audio notes page. Persisted to localStorage; in-app updates are
// broadcast via a custom event so any open view re-syncs immediately.

export interface AudioNote {
  id: string;
  title: string;
  dataUrl: string;
  duration: number;
  size: number;
  createdAt: number;
}

export const AUDIO_LIBRARY_KEY = "audio_notes_v1";
export const AUDIO_LIBRARY_EVENT = "audio-library-changed";
export const AUDIO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file

export const loadAudioLibrary = (): AudioNote[] => {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(AUDIO_LIBRARY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AudioNote[];
  } catch {
    return [];
  }
};

// Returns true on success. Always dispatches the change event so subscribers
// (including the home music player and the audio notes page) re-read in sync.
export const saveAudioLibrary = (notes: AudioNote[]): boolean => {
  let ok = true;
  try {
    localStorage.setItem(AUDIO_LIBRARY_KEY, JSON.stringify(notes));
  } catch {
    ok = false;
  }
  try {
    window.dispatchEvent(new CustomEvent(AUDIO_LIBRARY_EVENT));
  } catch {
    // ignore — events are best-effort
  }
  return ok;
};

// Subscribe to library changes from anywhere in the app. Also wires the
// browser `storage` event so changes from another tab/window are picked up.
export const subscribeToAudioLibrary = (handler: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => handler();
  const onStorage = (e: StorageEvent) => {
    if (e.key === AUDIO_LIBRARY_KEY) handler();
  };
  window.addEventListener(AUDIO_LIBRARY_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(AUDIO_LIBRARY_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
};

// ── File helpers ──────────────────────────────────────────────────────────

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("could not read file"));
    reader.readAsDataURL(file);
  });

export const probeDuration = (url: string): Promise<number> =>
  new Promise(resolve => {
    const a = new Audio();
    a.preload = "metadata";
    let done = false;
    const finish = (v: number) => { if (!done) { done = true; resolve(v); } };
    a.onloadedmetadata = () => finish(isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => finish(0);
    a.src = url;
    setTimeout(() => finish(0), 4000);
  });

const fmtSize = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

export interface ImportResult {
  added: number;
  skipped: string[];
  storageFull: boolean;
}

// Import a batch of files into the shared library, prepending newest first.
// Used by both the home music card uploader and the audio notes page.
export const importAudioFiles = async (files: File[]): Promise<ImportResult> => {
  const newOnes: AudioNote[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (!file.type.startsWith("audio/")) {
      skipped.push(`${file.name} (not audio)`);
      continue;
    }
    if (file.size > AUDIO_MAX_BYTES) {
      skipped.push(`${file.name} (${fmtSize(file.size)} — over ${fmtSize(AUDIO_MAX_BYTES)} limit)`);
      continue;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const dur = await probeDuration(dataUrl);
      newOnes.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
        dataUrl,
        duration: dur,
        size: file.size,
        createdAt: Date.now(),
      });
    } catch {
      skipped.push(`${file.name} (could not read)`);
    }
  }

  let storageFull = false;
  if (newOnes.length) {
    const next = [...newOnes, ...loadAudioLibrary()];
    const ok = saveAudioLibrary(next);
    if (!ok) storageFull = true;
  }

  return { added: newOnes.length, skipped, storageFull };
};
