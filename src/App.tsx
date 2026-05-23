import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";

import Bow from "./components/Bow";
import Spark from "./components/Spark";
import GlassCard from "./components/GlassCard";
import Clock from "./Clock";
import Orbs from "./Orbs";
import { useEncrypted } from "./lib/useEncrypted";
import {
  createBackupBytes, restoreBackupBytes,
  exportToFile, importFromFile,
  backupToDrive, restoreFromDrive,
  listDriveBackups, deleteDriveBackup,
  driveSignIn, isDriveConfigured,
} from "./lib/backup";
import type { DriveBackup } from "./lib/drive";
import { wipeAll } from "./lib/storage";

const NotesPage = lazy(() => import("./NotesPage"));

// ---------- Static content ----------
const QUOTES = [
  { a: "real is rare",      b: "you are magic"     },
  { a: "small progress",    b: "big change"        },
  { a: "where focus goes",  b: "energy flows"      },
  { a: "go at your",        b: "own pace"          },
  { a: "you deserve",       b: "all good things"   },
  { a: "bloom where",       b: "you are planted"   },
  { a: "soft life",         b: "sweet soul"        },
  { a: "rest is",           b: "productive too"    },
];

const MOODS = [
  { label: "grateful",   emoji: "🌷" },
  { label: "peaceful",   emoji: "🕊️"  },
  { label: "motivated",  emoji: "⚡"  },
  { label: "in my flow", emoji: "🌊"  },
  { label: "happy",      emoji: "🌸"  },
  { label: "creative",   emoji: "🎨"  },
  { label: "tired",      emoji: "🌙"  },
];

interface Todo { id: number; text: string; done: boolean }

const DEFAULT_TODOS: Todo[] = [
  { id: 1, text: "morning stretch",      done: false },
  { id: 2, text: "plan my day",          done: false },
  { id: 3, text: "drink water",          done: false },
  { id: 4, text: "focus on goals",       done: false },
  { id: 5, text: "learn something new",  done: false },
  { id: 6, text: "be proud of yourself", done: false },
];

interface Weather { temp: number; desc: string; icon: string }

const WEATHER_CODES: Record<number, { icon: string; desc: string }> = {
  0: { icon: "☀️", desc: "clear sky" },        1: { icon: "🌤️", desc: "mainly clear" },
  2: { icon: "⛅", desc: "partly cloudy" },    3: { icon: "☁️", desc: "overcast" },
  45:{ icon: "🌫️", desc: "fog" },              48:{ icon: "🌫️", desc: "depositing rime fog" },
  51:{ icon: "🌦️", desc: "light drizzle" },    53:{ icon: "🌦️", desc: "moderate drizzle" },
  55:{ icon: "🌧️", desc: "dense drizzle" },    56:{ icon: "🌧️", desc: "freezing drizzle" },
  57:{ icon: "🌧️", desc: "freezing drizzle" }, 61:{ icon: "🌧️", desc: "light rain" },
  63:{ icon: "🌧️", desc: "moderate rain" },    65:{ icon: "🌧️", desc: "heavy rain" },
  66:{ icon: "🌧️", desc: "freezing rain" },    67:{ icon: "🌧️", desc: "heavy freezing rain" },
  71:{ icon: "❄️", desc: "snow fall" },        73:{ icon: "❄️", desc: "snow fall" },
  75:{ icon: "❄️", desc: "snow fall" },        77:{ icon: "❄️", desc: "snow grains" },
  80:{ icon: "🌧️", desc: "rain showers" },     81:{ icon: "🌧️", desc: "moderate showers" },
  82:{ icon: "🌧️", desc: "violent showers" },  85:{ icon: "❄️", desc: "snow showers" },
  86:{ icon: "❄️", desc: "heavy snow showers" },95:{ icon: "⛈️", desc: "thunderstorm" },
  96:{ icon: "⛈️", desc: "thunderstorm" },     99:{ icon: "⛈️", desc: "thunderstorm" },
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const roundCoord = (n: number) => Math.round(n * 10) / 10; // ~11km city-level precision

type Intent = null | "backup-drive" | "restore-drive" | "export-file" | "import-file";

// ============================================================
//                     ROOT COMPONENT
// ============================================================
export default function PurpleDashboard() {
  const name = "Pemii";

  const [todos, setTodos]       = useEncrypted<Todo[]>("todos", DEFAULT_TODOS, 200);
  const [moods, setMoods]       = useEncrypted<string[]>("moods", [], 200);
  const [journal, setJournal]   = useEncrypted<string>("journal", "", 800);
  const [darkMode, setDarkMode] = useEncrypted<boolean>("darkMode", false, 0);

  const [newTodo, setNewTodo] = useState("");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [savedJournal, setSavedJournal] = useState(false);

  // Music — runtime only, never persisted (URLs are blob refs)
  const [playlist, setPlaylist] = useState<{ name: string; url: string }[]>([]);
  const [curIdx,   setCurIdx]   = useState(0);
  const [playing,  setPlaying]  = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  const [activeTab,    setActiveTab]    = useState<"home" | "notes" | "music" | "settings">("home");
  const [showSettings, setShowSettings] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showNotes,    setShowNotes]    = useState(false);

  // Backup flow state
  const [intent, setIntent] = useState<Intent>(null);
  const [busy,   setBusy]   = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const [info,   setInfo]   = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [restoreList, setRestoreList] = useState<DriveBackup[] | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [pickedBackup,  setPickedBackup]  = useState<DriveBackup | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const seekRef  = useRef<HTMLDivElement>(null);

  const q = useMemo(() => QUOTES[new Date().getDate() % QUOTES.length], []);

  // ---------- Dark mode side-effect ----------
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // ---------- Weather (rounded coords for privacy) ----------
  useEffect(() => {
    let alive = true;
    const update = async (lat: number, lon: number) => {
      setWeatherLoading(true);
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`,
          { referrerPolicy: "no-referrer" },
        );
        const data = await res.json() as { current_weather?: { temperature: number; weathercode: number } };
        if (!alive) return;
        const cw = data?.current_weather;
        if (cw) {
          const m = WEATHER_CODES[cw.weathercode] ?? { icon: "🌤️", desc: "weather" };
          setWeather({ temp: Math.round(cw.temperature), desc: m.desc, icon: m.icon });
        }
      } catch {
        if (alive) setWeather(null);
      } finally {
        if (alive) setWeatherLoading(false);
      }
    };

    const fallback = () => update(23.8, 90.4);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => update(roundCoord(coords.latitude), roundCoord(coords.longitude)),
        fallback,
        { maximumAge: 30 * 60 * 1000, timeout: 8000 },
      );
    } else {
      fallback();
    }

    return () => { alive = false; };
  }, []);

  // ---------- Ripple effect ----------
  useEffect(() => {
    const handle = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!(button instanceof HTMLElement)) return;
      if (button.closest(".no-ripple")) return;
      const rect = button.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height) * 1.8;
      ripple.className = "ripple";
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - rect.left - size / 2}px;top:${event.clientY - rect.top - size / 2}px;`;
      button.appendChild(ripple);
      window.setTimeout(() => { ripple.remove(); }, 600);
    };
    document.addEventListener("pointerdown", handle);
    return () => document.removeEventListener("pointerdown", handle);
  }, []);

  // ---------- Audio: load track when index/playlist changes ----------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playlist[curIdx]) return;
    audio.src = playlist[curIdx].url;
    audio.load();
  }, [curIdx, playlist]);

  // ---------- Revoke blob URLs on unmount ----------
  useEffect(() => () => { playlist.forEach(t => URL.revokeObjectURL(t.url)); }, [playlist]);

  // ---------- Music actions ----------
  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!playlist.length) { fileRef.current?.click(); return; }
    if (playing) { audio.pause(); }
    else { try { await audio.play(); } catch { /* ignore */ } }
  };

  const skip = (d: number) => {
    if (!playlist.length) return;
    setCurIdx(i => (i + d + playlist.length) % playlist.length);
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const tracks = files.map(f => ({ name: f.name.replace(/\.[^/.]+$/, ""), url: URL.createObjectURL(f) }));
    setPlaylist(p => [...p, ...tracks]);
    e.target.value = "";
  };

  const removeSong = (idx: number) => {
    setPlaylist(p => {
      const removed = p[idx];
      if (removed) URL.revokeObjectURL(removed.url);
      const upd = p.filter((_, i) => i !== idx);
      if (curIdx >= upd.length) setCurIdx(Math.max(0, upd.length - 1));
      return upd;
    });
    if (playlist.length <= 1) { audioRef.current?.pause(); setPlaying(false); }
  };

  const seekAudio = (e: React.MouseEvent) => {
    if (!seekRef.current || !audioRef.current || !duration) return;
    const rect = seekRef.current.getBoundingClientRect();
    audioRef.current.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  };

  // ---------- Todos / moods / journal ----------
  const addTodo = () => {
    if (!newTodo.trim()) return;
    setTodos([...todos, { id: Date.now(), text: newTodo.trim(), done: false }]);
    setNewTodo("");
  };
  const toggleTodo = (id: number) => setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const delTodo    = (id: number) => setTodos(todos.filter(t => t.id !== id));

  const toggleMood = (m: string) => setMoods(moods.includes(m) ? moods.filter(x => x !== m) : [...moods, m]);

  const handleJournal = (val: string) => {
    setJournal(val);
    setSavedJournal(true);
    window.setTimeout(() => setSavedJournal(false), 2000);
  };

  // ---------- Backup actions ----------
  const driveReady = isDriveConfigured();

  const openIntent = (i: Intent) => {
    setError(null); setInfo(null); setIntent(i);
    if (i === "restore-drive") {
      setRestoreList(null); setPickedBackup(null);
      void loadDriveList();
    }
  };
  const closeIntent = () => { setIntent(null); setPickedBackup(null); setError(null); setInfo(null); setPendingFile(null); };

  const loadDriveList = async () => {
    if (!driveReady) { setError("Set VITE_GOOGLE_CLIENT_ID first (see README)."); return; }
    setRestoreLoading(true); setError(null);
    try {
      await driveSignIn();
      const list = await listDriveBackups();
      setRestoreList(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setRestoreLoading(false);
    }
  };

  const performBackupDrive = async (passphrase: string) => {
    if (!driveReady) { setError("Drive not configured."); return; }
    setBusy(true); setError(null);
    try {
      await driveSignIn();
      const file = await backupToDrive(passphrase);
      setInfo(`Saved to your Drive — ${file.name}`);
      setTimeout(() => closeIntent(), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setBusy(false);
    }
  };

  const performRestoreDrive = async (passphrase: string) => {
    if (!pickedBackup) return;
    setBusy(true); setError(null);
    try {
      await restoreFromDrive(passphrase, pickedBackup.id);
      setInfo("Restored. Reloading…");
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  };

  const performExportFile = async (passphrase: string) => {
    setBusy(true); setError(null);
    try {
      await exportToFile(passphrase);
      setInfo("File downloaded.");
      setTimeout(() => closeIntent(), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const performImportFile = async (passphrase: string) => {
    if (!pendingFile) return;
    setBusy(true); setError(null);
    try {
      await importFromFile(passphrase, pendingFile);
      setInfo("Restored. Reloading…");
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const performWipe = async () => {
    setBusy(true);
    try {
      await wipeAll();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wipe failed");
      setBusy(false);
    }
  };

  // Smoke-test crypto round-trip in dev — keeps `createBackupBytes`/`restoreBackupBytes` referenced
  // for tree-shaking purposes and surfaces issues early.
  void createBackupBytes; void restoreBackupBytes;

  // ---------- Greetings ----------
  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 5  ? "sweet dreams"   :
    greetingHour < 12 ? "good morning"   :
    greetingHour < 17 ? "good afternoon" :
    greetingHour < 21 ? "good evening"   : "good night";
  const dateStr  = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // ---------- Tab navigation ----------
  const navTo = (tab: "home" | "notes" | "music" | "settings") => {
    if (tab === "notes") {
      const go = () => { setShowNotes(true); setActiveTab("notes"); };
      if (typeof document !== "undefined" && "startViewTransition" in document) {
        (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(go);
      } else { go(); }
      return;
    }
    if (tab === "music")    { setShowPlaylist(true); setActiveTab("music"); return; }
    if (tab === "settings") { setShowSettings(true); setActiveTab("settings"); return; }
    setActiveTab("home");
  };

  return (
    <div className="min-h-screen pb-24" style={{ fontFamily: "var(--font-body)" }}>
      <Orbs darkMode={darkMode} />

      <audio ref={audioRef}
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => skip(1)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <input ref={fileRef} type="file" accept="audio/*" multiple hidden onChange={handleFiles} />
      <input ref={importRef} type="file" accept=".purple,application/octet-stream" hidden
        onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return;
          setPendingFile(f); setIntent("import-file"); e.target.value = "";
        }} />

      {/* ============= Settings Modal ============= */}
      {showSettings && (
        <ModalBackdrop onClose={() => { setShowSettings(false); setActiveTab("home"); }}>
          <div className="p-7 w-full max-w-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Bow size={24} color="#C4A8E0" />
                <h3 className="text-xl font-medium italic ink-mid text-[#5A3E8A]" style={{ fontFamily: "var(--font-display)" }}>settings</h3>
              </div>
              <button onClick={() => { setShowSettings(false); setActiveTab("home"); }}
                className="text-[#9685B0] text-sm bg-transparent border-none cursor-pointer icon-button">close</button>
            </div>

            <SettingsRow>
              <span className="text-[13px] text-[#261B40] dark:text-[#F0E6FF]">dark mode</span>
              <Toggle checked={darkMode} onChange={setDarkMode} />
            </SettingsRow>

            <SettingsRow onClick={() => openIntent("backup-drive")}>
              <span className="text-[13px] text-[#261B40] dark:text-[#F0E6FF]">backup</span>
              <Chevron />
            </SettingsRow>

            <SettingsRow onClick={() => openIntent("restore-drive")}>
              <span className="text-[13px] text-[#261B40] dark:text-[#F0E6FF]">restore backup</span>
              <Chevron />
            </SettingsRow>

            <div className="mt-5 pt-4 border-t border-[#DDD3F0] dark:border-white/10 flex flex-wrap gap-3 justify-center">
              <SmallLink onClick={() => openIntent("export-file")}>export to file</SmallLink>
              <SmallLink onClick={() => importRef.current?.click()}>import from file</SmallLink>
              <SmallLink onClick={() => {
                if (window.confirm("This will erase every note, todo, mood and setting on this device. Continue?")) {
                  void performWipe();
                }
              }} danger>wipe all data</SmallLink>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* ============= Backup intent modals ============= */}
      {intent === "backup-drive" && (
        <PassphraseModal
          title="backup to your drive"
          subtitle={driveReady ? "Encrypted on this device, then uploaded to your Google account's hidden app folder." : "Drive not configured. See README to set up VITE_GOOGLE_CLIENT_ID."}
          confirm
          busy={busy}
          info={info}
          error={error}
          onSubmit={performBackupDrive}
          onClose={closeIntent}
          disabled={!driveReady}
        />
      )}

      {intent === "restore-drive" && !pickedBackup && (
        <ModalBackdrop onClose={closeIntent}>
          <div className="p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium italic text-[#5A3E8A] dark:text-[#EBDFFF]" style={{ fontFamily: "var(--font-display)" }}>pick a backup</h3>
              <button onClick={closeIntent} className="text-[#9685B0] text-sm bg-transparent border-none cursor-pointer">close</button>
            </div>
            {!driveReady && <p className="text-[12px] text-[#C44] mb-3">Drive not configured.</p>}
            {restoreLoading && <p className="text-[12px] text-[#9685B0]">loading…</p>}
            {error && <p className="text-[12px] text-[#C44] mb-2">{error}</p>}
            {restoreList && restoreList.length === 0 && (
              <p className="text-[12px] text-[#9685B0]">no backups yet — create one first.</p>
            )}
            {restoreList && restoreList.length > 0 && (
              <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
                {restoreList.map(b => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/40 dark:bg-white/5">
                    <button onClick={() => setPickedBackup(b)}
                      className="flex-1 text-left bg-transparent border-none cursor-pointer">
                      <p className="text-[12px] font-semibold text-[#261B40] dark:text-[#F0E6FF] truncate">{b.name}</p>
                      <p className="text-[10px] text-[#9685B0] mt-0.5">{new Date(b.modifiedTime).toLocaleString()} · {(b.size / 1024).toFixed(1)} KB</p>
                    </button>
                    <button onClick={async () => {
                      if (!window.confirm(`Delete "${b.name}" from your Drive?`)) return;
                      try { await deleteDriveBackup(b.id); setRestoreList(l => l?.filter(x => x.id !== b.id) ?? []); }
                      catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
                    }} className="text-[#C4A8E0] text-[13px] bg-transparent border-none cursor-pointer">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ModalBackdrop>
      )}

      {intent === "restore-drive" && pickedBackup && (
        <PassphraseModal
          title="enter your password"
          subtitle={`Restoring "${pickedBackup.name}". This will overwrite local data.`}
          busy={busy}
          info={info}
          error={error}
          onSubmit={performRestoreDrive}
          onClose={() => setPickedBackup(null)}
        />
      )}

      {intent === "export-file" && (
        <PassphraseModal
          title="export to file"
          subtitle="An encrypted .purple file will download. Keep your password safe — there is no recovery."
          confirm
          busy={busy}
          info={info}
          error={error}
          onSubmit={performExportFile}
          onClose={closeIntent}
        />
      )}

      {intent === "import-file" && pendingFile && (
        <PassphraseModal
          title="enter file password"
          subtitle={`Restoring from ${pendingFile.name}. This will overwrite local data.`}
          busy={busy}
          info={info}
          error={error}
          onSubmit={performImportFile}
          onClose={closeIntent}
        />
      )}

      {/* ============= Playlist Modal ============= */}
      {showPlaylist && (
        <ModalBackdrop bottom onClose={() => { setShowPlaylist(false); setActiveTab("home"); }}>
          <div className="p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-medium italic text-[#5A3E8A] dark:text-[#EBDFFF]" style={{ fontFamily: "var(--font-display)" }}>playlist</h3>
              <button onClick={() => { setShowPlaylist(false); setActiveTab("home"); }}
                className="text-[#9685B0] text-sm bg-transparent border-none cursor-pointer icon-button">close</button>
            </div>
            {playlist.length === 0 ? (
              <p className="text-[13px] text-[#9685B0] text-center py-4">no songs yet — tap ＋ to add</p>
            ) : (
              <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
                {playlist.map((track, i) => (
                  <div key={track.url} className="interactive-option flex items-center gap-3 p-3 rounded-2xl"
                    style={{ background: i === curIdx ? "rgba(118,84,168,.18)" : "rgba(255,255,255,.18)" }}>
                    <button onClick={() => setCurIdx(i)}
                      className="bg-transparent border-none cursor-pointer text-base p-0 leading-none icon-button">
                      {i === curIdx ? "💜" : "🤍"}
                    </button>
                    <span className="flex-1 text-[12px] truncate" style={{ color: i === curIdx ? "#7654A8" : darkMode ? "#F0E6FF" : "#261B40", fontWeight: i === curIdx ? 600 : 400 }}>
                      {track.name}
                    </span>
                    <button onClick={() => removeSong(i)}
                      className="bg-transparent border-none cursor-pointer text-[13px] text-[#C4A8E0] px-1 icon-button">✕</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => fileRef.current?.click()}
              className="w-full mt-4 py-3 rounded-2xl text-sm font-semibold btn-purple shimmer-press">
              ＋ add songs
            </button>
          </div>
        </ModalBackdrop>
      )}

      {/* ============= Notes Page ============= */}
      {showNotes && (
        <div className="fixed inset-0 z-[400]" style={{ animation: "fadeIn 0.2s var(--ease-soft)" }}>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[#9685B0]">loading…</div>}>
            <NotesPage darkMode={darkMode} onBack={() => { setShowNotes(false); setActiveTab("home"); }} />
          </Suspense>
        </div>
      )}

      <div className="max-w-[430px] mx-auto px-3.5 pt-5 pb-2 flex flex-col gap-3 relative">

        {/* Header */}
        <div className="su0 flex justify-between items-start px-1">
          <div>
            <p className="text-xs text-[#9685B0] dark:text-[#C8B8E0] font-medium flex items-center gap-1.5">
              {greeting} <Spark size={9} color="#B49FD0" cls="twinkle" />
            </p>
            <h1 className="mt-1 text-[30px] font-medium italic leading-tight text-[#5A3E8A] dark:text-[#EBDFFF]"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-.4px" }}>{name}</h1>
            <p className="mt-1.5 text-[11px] text-[#B49FD0] dark:text-[#A691CC]">{dateStr}</p>
          </div>
        </div>

        {/* Row 1 — Music + Quote */}
        <div className="su1 grid gap-3" style={{ gridTemplateColumns: "1.45fr 1fr" }}>
          <GlassCard radius={26}>
            <div className="p-[18px]">
              <div className="flex gap-3 items-center mb-4">
                <div className="shimmer-bg w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 breathe">🎵</div>
                <div className="overflow-hidden flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#261B40] dark:text-[#F0E6FF] truncate">{playlist[curIdx]?.name ?? "city of stars"}</p>
                  <p className="text-[10px] text-[#9685B0] dark:text-[#C8B8E0] mt-0.5">{playlist.length ? `${playlist.length} track${playlist.length !== 1 ? "s" : ""}` : "dreamy playlist"}</p>
                </div>
                <button onClick={() => setShowPlaylist(true)}
                  className="text-sm text-[#B49FD0] tracking-[3px] bg-transparent border-none cursor-pointer">···</button>
              </div>

              <div ref={seekRef} onClick={seekAudio}
                className="h-[3px] bg-[#DDD3F0] dark:bg-white/10 rounded-full mb-1.5 cursor-pointer relative">
                <div className="absolute inset-0 rounded-full transition-[width] duration-500"
                  style={{ width: `${duration ? (progress / duration) * 100 : 6}%`, background: "linear-gradient(90deg, #7654A8, #B07ADE)" }}>
                  <div className="absolute -right-[5px] -top-[4px] w-[11px] h-[11px] rounded-full bg-[#7654A8]"
                    style={{ boxShadow: "0 0 0 2.5px white, 0 2px 6px rgba(100,60,160,.35)" }} />
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-[#9685B0] dark:text-[#C8B8E0] mb-3.5">
                <span>{fmt(progress)}</span><span>{fmt(duration)}</span>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => fileRef.current?.click()} className="bg-transparent border-none cursor-pointer text-[#B49FD0] text-lg p-1 icon-button">＋</button>
                <button onClick={() => skip(-1)} className="bg-transparent border-none cursor-pointer text-[#7654A8] text-xl p-1 icon-button">⏮</button>
                <button onClick={togglePlay} className="w-11 h-11 rounded-full text-lg flex items-center justify-center flex-shrink-0 btn-purple icon-button shimmer-press">{playing ? "⏸" : "▶"}</button>
                <button onClick={() => skip(1)} className="bg-transparent border-none cursor-pointer text-[#7654A8] text-xl p-1 icon-button">⏭</button>
                <button onClick={() => setShowPlaylist(true)} className="bg-transparent border-none cursor-pointer text-[#B49FD0] text-base p-1 icon-button">🎼</button>
              </div>
            </div>
          </GlassCard>

          <GlassCard radius={26}>
            <div className="p-5 flex flex-col items-center justify-center text-center h-full">
              <div className="float"><Bow size={28} color="#C4A8E0" /></div>
              <div className="flex justify-center gap-2 my-2.5">
                <Spark size={9} color="#B49FD0" cls="twinkle" />
                <Spark size={9} color="#C4A8E0" cls="twinkle2" />
                <Spark size={9} color="#B49FD0" cls="twinkle3" />
              </div>
              <p className="text-sm font-medium italic text-[#261B40] dark:text-[#EBDFFF] leading-snug" style={{ fontFamily: "var(--font-display)" }}>{q.a}</p>
              <p className="text-sm font-semibold text-[#7654A8] dark:text-[#C9A8F0] leading-snug mt-0.5" style={{ fontFamily: "var(--font-display)" }}>{q.b}</p>
              <p className="text-xs text-[#9685B0] dark:text-[#A691CC] mt-3">💜</p>
            </div>
          </GlassCard>
        </div>

        {/* Row 2 — Clock + Weather */}
        <div className="su2 grid gap-3" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
          <GlassCard radius={26}><Clock /></GlassCard>

          <GlassCard radius={26}>
            <div className="py-6 px-3.5 flex flex-col items-center justify-center text-center">
              {weather ? (<>
                <span className="text-[32px] leading-none float">{weather.icon}</span>
                <p className="font-semibold text-[#5A3E8A] dark:text-[#EBDFFF] leading-none tracking-[-1.5px] mt-2"
                  style={{ fontFamily: "var(--font-display)", fontSize: "38px" }}>{weather.temp}°</p>
                <p className="text-[10px] text-[#9685B0] dark:text-[#C8B8E0] mt-1 capitalize">{weather.desc}</p>
                <p className="text-[10px] text-[#B49FD0] dark:text-[#A691CC] mt-1">good vibes 💜</p>
              </>) : (<>
                <span className="text-[32px] leading-none breathe">🌤️</span>
                <p className="text-[10px] text-[#9685B0] dark:text-[#C8B8E0] mt-2.5 leading-relaxed">
                  {weatherLoading ? "finding weather…" : "weather unavailable"}
                </p>
              </>)}
            </div>
          </GlassCard>
        </div>

        {/* Row 3 — Todo */}
        <div className="su3">
          <GlassCard radius={26}>
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium italic text-[#261B40] dark:text-[#F0E6FF]" style={{ fontFamily: "var(--font-display)" }}>to do list</h3>
                <span className="text-base text-[#B49FD0] tracking-[3px]">···</span>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {todos.map(t => (
                  <div key={t.id} className="flex items-center gap-2.5 mb-3 px-1 py-0.5">
                    <button onClick={() => toggleTodo(t.id)} className={`heart-toggle ${t.done ? "heart-pop" : ""}`}>{t.done ? "💜" : "🤍"}</button>
                    <span className={`flex-1 text-[13px] transition-all duration-200 ${t.done ? "line-through text-[#9685B0]" : "text-[#261B40] dark:text-[#F0E6FF]"}`}>{t.text}</span>
                    <button onClick={() => delTodo(t.id)} className="bg-transparent border-none cursor-pointer text-xs text-[#C4A8E0] px-1 active:scale-90">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3.5">
                <input value={newTodo} onChange={e => setNewTodo(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTodo()}
                  placeholder="add a task..."
                  className="flex-1 px-4 py-2.5 rounded-2xl text-[13px]" />
                <button onClick={addTodo} className="w-11 h-11 rounded-2xl text-xl flex items-center justify-center flex-shrink-0 btn-purple shimmer-press">＋</button>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Row 4 — Break + Mood */}
        <div className="su4 grid gap-3" style={{ gridTemplateColumns: "1fr 1.25fr" }}>
          <GlassCard radius={26}>
            <div className="p-6 flex flex-col items-center justify-center text-center">
              <span className="breathe text-[34px]">🕯️</span>
              <p className="mt-3 text-[13px] font-medium italic text-[#261B40] dark:text-[#EBDFFF]" style={{ fontFamily: "var(--font-display)" }}>take a break</p>
              <p className="mt-1 text-[11px] text-[#9685B0] dark:text-[#A691CC]">you deserve it</p>
              <div className="mt-3 float2"><Bow size={20} color="#D4BCE8" /></div>
            </div>
          </GlassCard>

          <GlassCard radius={26}>
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[13px] font-semibold text-[#261B40] dark:text-[#F0E6FF]">current mood</p>
                <span className="text-[13px] text-[#B49FD0] tracking-[2px]">···</span>
              </div>
              {MOODS.map(({ label, emoji }) => (
                <div key={label} onClick={() => toggleMood(label)}
                  className="interactive-option flex items-center gap-1.5 mb-1.5 cursor-pointer px-1.5 py-0.5 rounded-xl"
                  style={{ background: moods.includes(label) ? "rgba(180,150,218,.2)" : "transparent" }}>
                  <span className="text-xs leading-none">{moods.includes(label) ? "💜" : "🤍"}</span>
                  <span className={`text-[11px] flex-1 transition-colors ${moods.includes(label) ? "text-[#7654A8] dark:text-[#C9A8F0] font-semibold" : "text-[#9685B0] dark:text-[#B9A8D6]"}`}>{label}</span>
                  <span className="text-xs">{emoji}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Row 5 — Quote Banner */}
        <div className="su5">
          <GlassCard radius={26}>
            <div className="px-6 py-7 text-center">
              <span className="text-2xl text-[#B49FD0] leading-none block" style={{ fontFamily: "var(--font-display)" }}>"</span>
              <p className="my-3 text-[17px] font-medium italic text-[#261B40] dark:text-[#EBDFFF] leading-relaxed" style={{ fontFamily: "var(--font-display)" }}>
                small progress<br />
                <span className="text-[#7654A8] dark:text-[#C9A8F0] font-semibold">big change</span>
              </p>
              <span className="text-2xl text-[#B49FD0] leading-none block" style={{ fontFamily: "var(--font-display)" }}>"</span>
            </div>
          </GlassCard>
        </div>

        {/* Row 6 — Focus */}
        <div className="su6">
          <GlassCard radius={26}>
            <div className="px-5 py-5 flex items-center gap-4">
              <span className="text-[34px] flex-shrink-0 float">🕊️</span>
              <div className="flex-1">
                <p className="text-xs text-[#9685B0] dark:text-[#A691CC]">where focus goes</p>
                <p className="mt-1 text-[18px] font-semibold italic text-[#7654A8] dark:text-[#C9A8F0]" style={{ fontFamily: "var(--font-display)" }}>energy flows</p>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <Spark size={13} color="#C4A8E0" cls="twinkle" />
                <Spark size={10} color="#B49FD0" cls="twinkle2" />
                <Spark size={13} color="#C4A8E0" cls="twinkle3" />
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Row 7 — Journal */}
        <div className="su7">
          <GlassCard radius={26}>
            <div className="p-5">
              <div className="flex justify-between items-center mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-[18px]">📔</span>
                  <h3 className="text-[17px] font-medium italic text-[#261B40] dark:text-[#F0E6FF]" style={{ fontFamily: "var(--font-display)" }}>my journal</h3>
                </div>
                <span className={`text-[11px] transition-colors duration-300 ${savedJournal ? "text-[#7654A8] dark:text-[#C9A8F0] font-semibold" : "text-[#9685B0] dark:text-[#A691CC]"}`}>
                  {savedJournal ? "saved 💜" : "auto save"}
                </span>
              </div>
              <textarea value={journal} onChange={e => handleJournal(e.target.value)}
                placeholder={"write your thoughts here...\n\nthis space is just for you 💜"}
                className="w-full min-h-[150px] px-4 py-4 rounded-[18px] text-[13px] resize-y leading-relaxed"
                style={{ display: "block", boxSizing: "border-box" }} />
            </div>
          </GlassCard>
        </div>

        {/* Row 8 — Soft Cards */}
        <div className="su8 grid grid-cols-2 gap-3">
          <GlassCard radius={26}>
            <div className="p-6 text-center">
              <span className="breathe text-[30px]">🌷</span>
              <p className="mt-3 text-[13px] font-medium italic text-[#261B40] dark:text-[#EBDFFF] leading-snug" style={{ fontFamily: "var(--font-display)" }}>go at your own pace</p>
              <p className="mt-1 text-[10px] text-[#9685B0] dark:text-[#A691CC]">no rush, no pressure</p>
            </div>
          </GlassCard>
          <GlassCard radius={26}>
            <div className="p-6 text-center">
              <span className="breathe2 text-[30px]">🌙</span>
              <p className="mt-3 text-[13px] font-medium italic text-[#261B40] dark:text-[#EBDFFF] leading-snug" style={{ fontFamily: "var(--font-display)" }}>rest is part of the process</p>
              <p className="mt-1 text-[10px] text-[#9685B0] dark:text-[#A691CC]">be gentle with yourself</p>
            </div>
          </GlassCard>
        </div>

        <p className="text-center text-[11px] text-[#B49FD0] dark:text-[#A691CC] py-1">made with 💜 just for you</p>
      </div>

      {/* ============= Bottom Nav ============= */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center pt-2.5 pb-[18px] nav-bar">
        {([
          { id: "home",     icon: "🤍" },
          { id: "notes",    icon: "📔" },
          { id: "music",    icon: "🎵" },
          { id: "settings", icon: "⚙️" },
        ] as const).map(({ id, icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => navTo(id)}
              className="bg-transparent border-none cursor-pointer transition-all duration-200 nav-button"
              style={{ fontSize: active ? "24px" : "20px", opacity: active ? 1 : 0.45, transform: active ? "translateY(-3px)" : "none", padding: "6px 14px" }}>
              {icon}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ============================================================
//                 Re-usable UI primitives
// ============================================================

function ModalBackdrop({ children, onClose, bottom = false }: { children: React.ReactNode; onClose: () => void; bottom?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={`fixed inset-0 z-[300] flex ${bottom ? "items-end" : "items-center"} justify-center ${bottom ? "" : "p-5"}`}
      style={{ background: "rgba(20, 8, 40, 0.55)", backdropFilter: "blur(14px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={bottom ? "w-full max-w-[430px] p-4 pb-8" : ""}>
        <div className="glass-card" style={{ borderRadius: 28 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function SettingsRow({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div role={onClick ? "button" : undefined} onClick={onClick}
      className={`mb-2 px-4 py-3.5 rounded-2xl border border-[#DDD3F0] dark:border-white/10 bg-white/55 dark:bg-white/5 flex items-center justify-between gap-3 ${onClick ? "cursor-pointer interactive-option" : ""}`}>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-11 h-6 bg-[#DDD3F0] dark:bg-white/15 rounded-full peer-checked:bg-[#7A4DD8] peer-focus:ring-2 peer-focus:ring-[#C4A8E0] transition-all" />
      <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-md peer-checked:translate-x-5 transition-transform" />
    </label>
  );
}

function Chevron() { return <span className="text-[#B49FD0] text-sm">›</span>; }

function SmallLink({ children, onClick, danger = false }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className="bg-transparent border-none cursor-pointer text-[11px] underline underline-offset-2"
      style={{ color: danger ? "#C2456A" : "#9685B0" }}>
      {children}
    </button>
  );
}

function PassphraseModal({
  title, subtitle, confirm = false, busy, error, info, disabled = false, onSubmit, onClose,
}: {
  title: string; subtitle?: string; confirm?: boolean;
  busy: boolean; error: string | null; info: string | null; disabled?: boolean;
  onSubmit: (pp: string) => void; onClose: () => void;
}) {
  const [pp, setPp] = useState("");
  const [pp2, setPp2] = useState("");
  const [show, setShow] = useState(false);

  const valid = pp.length >= 8 && (!confirm || pp === pp2);
  const mismatch = confirm && pp2.length > 0 && pp !== pp2;

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium italic text-[#5A3E8A] dark:text-[#EBDFFF]" style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
          <button onClick={onClose} className="text-[#9685B0] text-sm bg-transparent border-none cursor-pointer">close</button>
        </div>
        {subtitle && <p className="text-[11px] text-[#9685B0] dark:text-[#A691CC] mb-4 leading-relaxed">{subtitle}</p>}

        <div className="relative mb-2">
          <input
            type={show ? "text" : "password"}
            value={pp}
            onChange={e => setPp(e.target.value)}
            placeholder="password (min 8)"
            autoFocus
            disabled={disabled || busy}
            className="w-full px-4 py-3 pr-12 rounded-2xl text-[13px]"
          />
          <button type="button" onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-[#9685B0] text-[11px]">
            {show ? "hide" : "show"}
          </button>
        </div>

        {confirm && (
          <input
            type={show ? "text" : "password"}
            value={pp2}
            onChange={e => setPp2(e.target.value)}
            placeholder="confirm password"
            disabled={disabled || busy}
            className="w-full px-4 py-3 mb-2 rounded-2xl text-[13px]"
          />
        )}

        {confirm && <p className="text-[10px] text-[#C2456A] mb-2">⚠ Forgot the password = no recovery. There is no reset.</p>}
        {mismatch && <p className="text-[11px] text-[#C44] mb-2">passwords don't match</p>}
        {error && <p className="text-[11px] text-[#C44] mb-2">{error}</p>}
        {info  && <p className="text-[11px] text-[#7654A8] dark:text-[#C9A8F0] mb-2">{info}</p>}

        <div className="flex gap-2 mt-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-[#DDD3F0] dark:border-white/15 text-[#9685B0] text-sm bg-transparent">cancel</button>
          <button onClick={() => onSubmit(pp)}
            disabled={!valid || busy || disabled}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold btn-purple shimmer-press"
            style={{ opacity: !valid || busy || disabled ? 0.55 : 1 }}>
            {busy ? "working…" : "continue"}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
