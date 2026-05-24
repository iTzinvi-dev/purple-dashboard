import { useState, useEffect, useRef, lazy, Suspense } from "react";
import PetalCanvas from "./PetalCanvas";
import { approximateBytes, clearAll, formatBytes } from "./storage";
import { downloadJsonBackup, importJsonFile } from "./backup";
import {
  type AudioNote,
  loadAudioLibrary,
  subscribeToAudioLibrary,
} from "./audioLibrary";

// Lazy-load page components — initial dashboard renders fast.
const NotesPage        = lazy(() => import("./NotesPage"));
const AudioNotesPage   = lazy(() => import("./AudioNotesPage"));
const ProductivityPage = lazy(() => import("./ProductivityPage"));
const StarPage         = lazy(() => import("./StarPage"));

const PageFallback = () => (
  <div className="page-surface" style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <span style={{ fontSize: 28 }} className="breathe">💜</span>
  </div>
);

const QUOTES = [
  { a: "real is rare",      b: "you are magic"      },
  { a: "small progress",    b: "big change"          },
  { a: "where focus goes",  b: "energy flows"        },
  { a: "go at your",        b: "own pace"            },
  { a: "you deserve",       b: "all good things"     },
  { a: "bloom where",       b: "you are planted"     },
  { a: "soft life",         b: "sweet soul"          },
  { a: "rest is",           b: "productive too"      },
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

const DEFAULT_TODOS = [
  { id: 1, text: "morning stretch",      done: false },
  { id: 2, text: "plan my day",          done: false },
  { id: 3, text: "drink water",          done: false },
  { id: 4, text: "focus on goals",       done: false },
  { id: 5, text: "learn something new",  done: false },
  { id: 6, text: "be proud of yourself", done: false },
];

interface Weather { temp: number; desc: string; icon: string; }

const getJson = <T,>(key: string, fallback: T): T => {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
};

const getString = (key: string, fallback: string): string => {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch { return fallback; }
};

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { void 0; } },
};

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const Bow = ({ size = 28, color = "#C4A8E0" }) => (
  <svg width={size} height={size * 0.6} viewBox="0 0 60 36" fill="none" aria-hidden>
    <path d="M30 18 C20 8, 2 4, 2 18 C2 28, 20 28, 30 18Z" fill={color} opacity=".9"/>
    <path d="M30 18 C40 8, 58 4, 58 18 C58 28, 40 28, 30 18Z" fill={color} opacity=".9"/>
    <circle cx="30" cy="18" r="4" fill={color}/>
    <path d="M28 20 C26 26, 22 32, 18 34" stroke={color} strokeWidth="2" strokeLinecap="round" opacity=".6"/>
    <path d="M32 20 C34 26, 38 32, 42 34" stroke={color} strokeWidth="2" strokeLinecap="round" opacity=".6"/>
  </svg>
);

const Spark = ({ size = 11, color = "#C4A8E0", cls = "twinkle" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={cls} aria-hidden
    style={{ display: "inline-block", flexShrink: 0 }}>
    <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" fill={color}/>
  </svg>
);

const GL = ({ children, radius = 26 }: { children: React.ReactNode; radius?: number }) => (
  <div className="glass-card" style={{ borderRadius: radius }}>{children}</div>
);

type Overlay = null | "notes" | "audio" | "productivity" | "star";

export default function PurpleDashboard() {
  const [time, setTime] = useState(new Date());
  const name = "Pemii";
  const [todos, setTodos] = useState(() => getJson<typeof DEFAULT_TODOS>("todos", DEFAULT_TODOS));
  const [newTodo, setNewTodo] = useState("");
  const [moods, setMoods] = useState<string[]>(() => getJson<string[]>("moods", []));
  const [journal, setJournal] = useState(() => getString("journal", ""));
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => getJson("darkMode", false));
  const [tempDarkMode, setTempDarkMode] = useState(() => getJson("darkMode", false));
  const [showSettings, setShowSettings] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  // Music player draws its tracks from the shared audio notes library so the
  // home dashboard and the audio notes page stay in sync — uploads from either
  // place flow into the same store.
  const [audioLibrary, setAudioLibrary] = useState<AudioNote[]>(() => loadAudioLibrary());
  const [curIdx,       setCurIdx]       = useState(0);
  const [playing,      setPlaying]      = useState(false);
  const [duration,     setDuration]     = useState(0);
  const [progress,     setProgress]     = useState(0);
  const [saved,        setSaved]        = useState(false);
  const [activeTab,    setActiveTab]    = useState("home");
  const [overlayPage,  setOverlayPage]  = useState<Overlay>(null);

  // Settings panel
  const [settingsTab,    setSettingsTab]    = useState<"appearance" | "backup" | "privacy">("appearance");
  const [backupBusy,     setBackupBusy]     = useState<string | null>(null);
  const [backupMsg,      setBackupMsg]      = useState<string | null>(null);
  const [backupErr,      setBackupErr]      = useState<string | null>(null);
  const [importMode,     setImportMode]     = useState<"merge" | "replace">("merge");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [storageBytes,   setStorageBytes]   = useState(0);
  const importFileRef = useRef<HTMLInputElement>(null);

  // PWA install prompt
  const [installEvent, setInstallEvent] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [showInstallPill, setShowInstallPill] = useState(false);

  // Online/offline status
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const audioRef = useRef<HTMLAudioElement>(null);
  const seekRef  = useRef<HTMLDivElement>(null);
  const jTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const q        = QUOTES[new Date().getDate() % QUOTES.length];

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Weather (best effort, single fetch on mount)
  useEffect(() => {
    const codeMap: Record<number, { icon: string; desc: string }> = {
      0: { icon: "☀️", desc: "clear sky" }, 1: { icon: "🌤️", desc: "mainly clear" },
      2: { icon: "⛅", desc: "partly cloudy" }, 3: { icon: "☁️", desc: "overcast" },
      45: { icon: "🌫️", desc: "fog" }, 48: { icon: "🌫️", desc: "fog" },
      51: { icon: "🌦️", desc: "light drizzle" }, 53: { icon: "🌦️", desc: "drizzle" },
      55: { icon: "🌧️", desc: "drizzle" }, 61: { icon: "🌧️", desc: "light rain" },
      63: { icon: "🌧️", desc: "rain" }, 65: { icon: "🌧️", desc: "heavy rain" },
      71: { icon: "❄️", desc: "snow" }, 80: { icon: "🌧️", desc: "showers" },
      95: { icon: "⛈️", desc: "thunderstorm" },
    };

    const updateWeather = async (lat: number, lon: number) => {
      setWeatherLoading(true);
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`);
        const data = await res.json();
        const current = data?.current_weather;
        if (current) {
          const mapped = codeMap[current.weathercode] ?? { icon: "🌤️", desc: "weather" };
          setWeather({ temp: Math.round(current.temperature), desc: mapped.desc, icon: mapped.icon });
        }
      } catch { setWeather(null); }
      finally { setWeatherLoading(false); }
    };

    const fallback = () => updateWeather(23.8, 90.4);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => updateWeather(coords.latitude, coords.longitude),
        fallback,
        { timeout: 6000 },
      );
    } else { fallback(); }
  }, []);

  // Dark-mode side-effect on <html>
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // PWA lifecycle toasts
  const [pwaToast, setPwaToast] = useState<null | { kind: "ready" | "update"; msg: string }>(null);
  useEffect(() => {
    const onReady = () => {
      setPwaToast({ kind: "ready", msg: "offline ready 💜 your space works without wifi" });
      setTimeout(() => setPwaToast(null), 4500);
    };
    const onUpdate = () => {
      setPwaToast({ kind: "update", msg: "fresh updates ready — refresh anytime ✨" });
      setTimeout(() => setPwaToast(null), 6000);
    };
    window.addEventListener("pwa-offline-ready", onReady);
    window.addEventListener("pwa-update-available", onUpdate);
    return () => {
      window.removeEventListener("pwa-offline-ready", onReady);
      window.removeEventListener("pwa-update-available", onUpdate);
    };
  }, []);

  // Online/offline tracking
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // PWA install prompt capture
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as unknown as { prompt: () => Promise<void> });
      // Show pill once after small delay if user hasn't dismissed before
      if (ls.get("install_dismissed_v1") !== "true") {
        setTimeout(() => setShowInstallPill(true), 8000);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Lightweight ripple effect on every button (no per-button setup)
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!(button instanceof HTMLElement)) return;
      if (button.closest(".no-ripple")) return;

      const rect = button.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height) * 1.7;
      ripple.className = "ripple";
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      button.appendChild(ripple);
      window.setTimeout(() => { ripple.remove(); }, 500);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  // Subscribe to audio library changes (uploads/deletes from anywhere in the
  // app, including the audio notes page) so the home player stays in sync.
  useEffect(() => {
    const reload = () => {
      const next = loadAudioLibrary();
      setAudioLibrary(next);
      // If the currently selected track was removed (or library is empty),
      // clamp the index and stop playback so the audio element doesn't keep
      // a stale src.
      setCurIdx(i => {
        if (next.length === 0) return 0;
        return Math.min(i, next.length - 1);
      });
      if (next.length === 0) {
        audioRef.current?.pause();
      }
    };
    return subscribeToAudioLibrary(reload);
  }, []);

  // Wire the <audio> element to whatever track is currently selected.
  // Recreating the src on track change forces a reload; we preserve play state
  // so navigating prev/next while playing keeps playing.
  useEffect(() => {
    const audio = audioRef.current;
    const track = audioLibrary[curIdx];
    if (!audio) return;
    if (!track) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }
    const wasPlaying = playing;
    audio.src = track.dataUrl;
    audio.load();
    if (wasPlaying) audio.play().catch(() => { void 0; });
    // We deliberately key off the track id so swapping libraries (e.g. delete
    // then re-add) still triggers the reload even if curIdx didn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curIdx, audioLibrary[curIdx]?.id]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    // Empty library — point them at the audio notes page (the inner 🎵 tab),
    // which is the single source of truth for adding/managing audio. The
    // home music card is play-only by design so users don't have two places
    // to "create" tracks from.
    if (!audioLibrary.length) {
      setActiveTab("music");
      setOverlayPage("audio");
      return;
    }
    if (playing) audio.pause();
    else { try { await audio.play(); } catch { void 0; } }
  };

  const skip = (d: number) => {
    if (!audioLibrary.length) return;
    setCurIdx(i => (i + d + audioLibrary.length) % audioLibrary.length);
  };

  const seekAudio = (e: React.MouseEvent) => {
    if (!seekRef.current || !audioRef.current || !duration) return;
    const rect = seekRef.current.getBoundingClientRect();
    audioRef.current.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  };

  const addTodo    = () => { if (!newTodo.trim()) return; const u = [...todos, { id: Date.now(), text: newTodo.trim(), done: false }]; setTodos(u); setNewTodo(""); ls.set("todos", JSON.stringify(u)); };
  const toggleTodo = (id: number) => { const u = todos.map(t => t.id === id ? { ...t, done: !t.done } : t); setTodos(u); ls.set("todos", JSON.stringify(u)); };
  const delTodo    = (id: number) => { const u = todos.filter(t => t.id !== id); setTodos(u); ls.set("todos", JSON.stringify(u)); };

  const toggleMood = (m: string) => {
    const u = moods.includes(m) ? moods.filter(x => x !== m) : [...moods, m];
    setMoods(u); ls.set("moods", JSON.stringify(u));
  };

  const handleJournal = (val: string) => {
    setJournal(val); clearTimeout(jTimer.current);
    jTimer.current = setTimeout(() => { ls.set("journal", val); setSaved(true); setTimeout(() => setSaved(false), 2000); }, 800);
  };

  const saveSettings = () => {
    setDarkMode(tempDarkMode);
    ls.set("darkMode", JSON.stringify(tempDarkMode));
    setShowSettings(false);
  };

  // ── Backup / Restore ──
  const refreshStorageBytes = () => setStorageBytes(approximateBytes().total);

  const flashMsg = (msg: string) => {
    setBackupMsg(msg); setBackupErr(null);
    window.setTimeout(() => setBackupMsg(null), 4000);
  };
  const flashErr = (err: unknown) => {
    const msg = err instanceof Error ? err.message : "something went wrong";
    setBackupErr(msg); setBackupMsg(null);
    window.setTimeout(() => setBackupErr(null), 6000);
  };

  const onExportFile = () => {
    try { downloadJsonBackup(); flashMsg("backup file downloaded 💜"); }
    catch (e) { flashErr(e); }
  };

  const onImportFilePick = () => importFileRef.current?.click();

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setBackupBusy("reading file...");
    try {
      const result = await importJsonFile(file, importMode);
      flashMsg(`imported ${result.applied} item${result.applied === 1 ? "" : "s"} — refresh to see changes`);
      refreshStorageBytes();
    } catch (e) { flashErr(e); }
    finally { setBackupBusy(null); }
  };

  const onClearAll = () => {
    const removed = clearAll();
    setShowClearConfirm(false);
    flashMsg(`cleared ${removed} item${removed === 1 ? "" : "s"} — refresh to see changes`);
    refreshStorageBytes();
  };

  useEffect(() => { if (showSettings) refreshStorageBytes(); }, [showSettings]); // eslint-disable-line react-hooks/set-state-in-effect

  const promptInstall = async () => {
    if (!installEvent) return;
    try { await installEvent.prompt(); } catch { /* ignore */ }
    setShowInstallPill(false);
    setInstallEvent(null);
  };
  const dismissInstall = () => {
    ls.set("install_dismissed_v1", "true");
    setShowInstallPill(false);
  };

  const h        = time.getHours();
  const greeting = h < 5 ? "sweet dreams" : h < 12 ? "good morning" : h < 17 ? "good afternoon" : h < 21 ? "good evening" : "good night";
  const timeStr  = time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateStr  = time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen pb-24"
      style={{
        background: "var(--bg-app)",
        color: "var(--text-primary)",
      }}>

      <PetalCanvas />

      <audio ref={audioRef}
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => skip(1)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Offline banner */}
      {!isOnline && (
        <div className="offline-banner">
          🌙 you're offline — your space still works, weather will be back soon
        </div>
      )}

      {/* PWA lifecycle toast (offline ready / update available) */}
      {pwaToast && (
        <div className="pwa-toast" role="status">
          {pwaToast.msg}
        </div>
      )}

      {/* PWA install pill */}
      {showInstallPill && installEvent && (
        <div className="install-pill">
          <span>✨ install for offline access</span>
          <button onClick={promptInstall}>install</button>
          <button onClick={dismissInstall} aria-label="dismiss" style={{ padding: "4px 10px" }}>✕</button>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 overlay-bg"
          style={{ background: "rgba(35,18,65,.55)", backdropFilter: "blur(14px)" }}
          onClick={e => e.target === e.currentTarget && setShowSettings(false)}>
          <div className="glass-card w-full max-w-md page-enter" style={{ borderRadius: 28, maxHeight: "min(86vh, 700px)", display: "flex", flexDirection: "column" }}>
            <div className="px-6 pt-6 pb-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-card)" }}>
              <Bow size={22} color="var(--accent-2)" />
              <h3 className="text-xl font-medium italic"
                style={{ fontFamily: "var(--font-display)", color: "var(--text-secondary)", flex: 1 }}>settings</h3>
              <button onClick={() => setShowSettings(false)}
                className="bg-transparent border-none cursor-pointer text-base"
                style={{ color: "var(--text-muted)" }}>✕</button>
            </div>

            <div className="flex px-4 pt-2" style={{ gap: 4 }}>
              {(["appearance", "backup", "privacy"] as const).map(t => (
                <button key={t} onClick={() => setSettingsTab(t)}
                  className={`settings-tab ${settingsTab === t ? "active" : ""}`}>
                  {t === "appearance" ? "🎨 look" : t === "backup" ? "☁️ backup" : "🔒 privacy"}
                </button>
              ))}
            </div>

            <div className="px-6 py-5" style={{ overflowY: "auto" }}>

              {settingsTab === "appearance" && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-3xl"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border-soft)" }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest mb-0.5"
                          style={{ color: "var(--text-muted)" }}>dark mode</p>
                        <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>soft on the eyes at night</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={tempDarkMode} onChange={e => setTempDarkMode(e.target.checked)}
                          className="sr-only peer" />
                        <div className="w-11 h-6 rounded-full peer-checked:bg-[#7A4DD8] transition-all"
                          style={{ background: "var(--border-soft)" }} />
                        <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-md peer-checked:translate-x-5 transition-transform" />
                      </label>
                    </div>
                  </div>

                  <p className="text-[11px] text-center" style={{ color: "var(--text-faint)" }}>
                    animations slow down automatically if your device prefers reduced motion 💜
                  </p>

                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { setTempDarkMode(darkMode); setShowSettings(false); }}
                      className="flex-1 py-3 rounded-2xl text-sm icon-button"
                      style={{ border: "1px solid var(--border-soft)", color: "var(--text-muted)", background: "transparent", cursor: "pointer" }}>cancel</button>
                    <button onClick={saveSettings}
                      className="flex-1 py-3 rounded-2xl text-sm font-semibold btn-purple shimmer-press">apply</button>
                  </div>
                </div>
              )}

              {settingsTab === "backup" && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-3xl"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border-soft)" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-widest mb-2"
                      style={{ color: "var(--text-muted)" }}>local backup file</p>
                    <p className="text-[11px] mb-3" style={{ color: "var(--text-faint)" }}>
                      download a JSON file you can keep anywhere — Drive, iCloud, email to yourself.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={onExportFile} disabled={!!backupBusy}
                        className="flex-1 btn-soft">⬇ export</button>
                      <button onClick={onImportFilePick} disabled={!!backupBusy}
                        className="flex-1 btn-soft">⬆ import</button>
                    </div>
                    <input ref={importFileRef} type="file" accept="application/json,.json" hidden onChange={onImportFile} />
                  </div>

                  <div className="p-3 rounded-2xl flex gap-1"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border-soft)" }}>
                    {(["merge", "replace"] as const).map(m => (
                      <button key={m} onClick={() => setImportMode(m)}
                        className="flex-1 py-2 rounded-xl text-[11px] font-semibold"
                        style={{
                          background: importMode === m ? "linear-gradient(135deg, #7654A8, #A870D8)" : "transparent",
                          color: importMode === m ? "white" : "var(--text-muted)",
                          border: "none",
                          cursor: "pointer",
                        }}>
                        {m === "merge" ? "merge with current" : "replace current"}
                      </button>
                    ))}
                  </div>

                  <p className="text-[10px] text-center" style={{ color: "var(--text-faint)" }}>
                    using {formatBytes(storageBytes)} of local storage
                  </p>

                  {backupBusy && <div className="status-line">⏳ {backupBusy}</div>}
                  {backupMsg  && <div className="status-line">{backupMsg}</div>}
                  {backupErr  && <div className="status-line error">⚠ {backupErr}</div>}
                </div>
              )}

              {settingsTab === "privacy" && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-3xl"
                    style={{ background: "var(--bg-input)", border: "1px solid var(--border-soft)" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-widest mb-2"
                      style={{ color: "var(--text-muted)" }}>your data is yours</p>
                    <ul className="text-[11px] leading-relaxed pl-4" style={{ color: "var(--text-secondary)", listStyle: "disc" }}>
                      <li>all notes, audio, and journal text stay <strong>on this device</strong> by default</li>
                      <li>uninstalling the app or clearing browser data will erase everything</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-3xl"
                    style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-widest mb-1"
                      style={{ color: "var(--danger)" }}>danger zone</p>
                    <p className="text-[11px] mb-3" style={{ color: "var(--text-secondary)" }}>
                      this erases all notes, audio notes, todos, mood, journal, and pomodoro stats from this device.
                    </p>
                    {!showClearConfirm ? (
                      <button onClick={() => setShowClearConfirm(true)} className="btn-danger w-full">clear all data</button>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => setShowClearConfirm(false)}
                          className="flex-1 btn-soft">cancel</button>
                        <button onClick={onClearAll}
                          className="flex-1 btn-danger"
                          style={{ background: "var(--danger)", color: "white" }}>yes, erase</button>
                      </div>
                    )}
                  </div>

                  {backupMsg && <div className="status-line">{backupMsg}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Playlist Modal */}
      {showPlaylist && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center overlay-bg"
          style={{ background: "rgba(35,18,65,.52)", backdropFilter: "blur(14px)" }}
          onClick={e => e.target === e.currentTarget && setShowPlaylist(false)}>
          <div className="w-full max-w-[430px] p-4 pb-8 page-enter">
            <GL radius={28}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg font-medium italic" style={{ fontFamily: "var(--font-display)", color: "var(--text-secondary)" }}>🎵 playlist</h3>
                  <button onClick={() => setShowPlaylist(false)} className="text-sm bg-transparent border-none cursor-pointer icon-button" style={{ color: "var(--text-muted)" }}>close</button>
                </div>
                {audioLibrary.length === 0 ? (
                  <p className="text-[13px] text-center py-4" style={{ color: "var(--text-muted)" }}>no audio yet — open the library to add some 💜</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
                    {audioLibrary.map((track, i) => (
                      <div key={track.id} className="interactive-option flex items-center gap-3 p-3 rounded-2xl"
                        style={{ background: i === curIdx ? "var(--accent-soft)" : "var(--bg-input)" }}>
                        <button onClick={() => { setCurIdx(i); setShowPlaylist(false); }}
                          className="bg-transparent border-none cursor-pointer text-base p-0 leading-none icon-button">
                          {i === curIdx ? "💜" : "🤍"}
                        </button>
                        <span className="flex-1 text-[12px] truncate" style={{ color: i === curIdx ? "var(--accent)" : "var(--text-primary)", fontWeight: i === curIdx ? 600 : 400 }}>
                          {track.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Library management lives in the audio notes page (the inner 🎵
                    tab). The home music card is play-only — one source of truth
                    avoids the "did this audio actually save?" confusion. */}
                <div className="flex mt-4">
                  <button onClick={() => { setShowPlaylist(false); setActiveTab("music"); setOverlayPage("audio"); }}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold btn-purple shimmer-press">
                    open audio library
                  </button>
                </div>
              </div>
            </GL>
          </div>
        </div>
      )}

      {/* Dashboard */}
      <div className="max-w-[430px] mx-auto px-3.5 pt-5 pb-2 flex flex-col gap-3 relative z-10">

        <div className="su0 flex justify-between items-start px-1">
          <div>
            <p className="text-xs text-[#9685B0] font-medium flex items-center gap-1.5">
              {greeting} <Spark size={9} color="#B49FD0" cls="twinkle" />
            </p>
            <h1 className="mt-1 text-[30px] font-medium italic leading-tight text-[#5A3E8A]"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-.4px" }}>{name}</h1>
            <p className="mt-1.5 text-[11px] text-[#B49FD0]">{dateStr}</p>
          </div>
          <button onClick={() => { setTempDarkMode(darkMode); setShowSettings(true); }}
            aria-label="settings"
            className="w-10 h-10 flex items-center justify-center text-lg icon-button nav-button flex-shrink-0"
            style={{ borderRadius: "50%", background: "var(--bg-card-soft)", border: "1px solid var(--border-card)", boxShadow: "0 2px 14px rgba(120,80,190,.08)" }}>⚙️</button>
        </div>

        {/* Music + Quote */}
        <div className="su1 grid gap-3" style={{ gridTemplateColumns: "1.45fr 1fr" }}>
          <GL radius={26}>
            <div className="p-[18px]">
              <div className="flex gap-3 items-center mb-4">
                <div className="shimmer-bg w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">🎵</div>
                <div className="overflow-hidden flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#261B40] truncate">{audioLibrary[curIdx]?.title ?? "your audio library"}</p>
                  <p className="text-[10px] text-[#9685B0] mt-0.5">{audioLibrary.length ? `${audioLibrary.length} track${audioLibrary.length !== 1 ? "s" : ""}` : "tap ▶ to open library"}</p>
                </div>
                <button onClick={() => setShowPlaylist(true)}
                  className="text-sm text-[#B49FD0] tracking-[3px] bg-transparent border-none cursor-pointer">···</button>
              </div>

              <div ref={seekRef} onClick={seekAudio}
                className="h-[3px] bg-[#DDD3F0] rounded-full mb-1.5 cursor-pointer relative">
                <div className="absolute inset-0 rounded-full transition-[width] duration-300"
                  style={{ width: `${duration ? (progress/duration)*100 : 6}%`, background: "linear-gradient(90deg, #7654A8, #B07ADE)" }}>
                  <div className="absolute -right-[5px] -top-[4px] w-[11px] h-[11px] rounded-full bg-[#7654A8]"
                    style={{ boxShadow: "0 0 0 2.5px white, 0 2px 6px rgba(100,60,160,.35)" }} />
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-[#9685B0] mb-3.5">
                <span>{fmt(progress)}</span><span>{fmt(duration)}</span>
              </div>

              <div className="flex items-center justify-around">
                <button onClick={() => skip(-1)}
                  className="bg-transparent border-none cursor-pointer text-[#7654A8] text-xl p-1 icon-button">⏮</button>
                <button onClick={togglePlay}
                  className="w-11 h-11 rounded-full text-lg flex items-center justify-center flex-shrink-0 btn-purple icon-button shimmer-press">
                  {playing ? "⏸" : "▶"}
                </button>
                <button onClick={() => skip(1)}
                  className="bg-transparent border-none cursor-pointer text-[#7654A8] text-xl p-1 icon-button">⏭</button>
                <button onClick={() => setShowPlaylist(true)}
                  className="bg-transparent border-none cursor-pointer text-[#B49FD0] text-base p-1 icon-button">🎼</button>
              </div>
            </div>
          </GL>

          <GL radius={26}>
            <div className="p-5 flex flex-col items-center justify-center text-center h-full">
              <div className="float"><Bow size={28} color="#C4A8E0" /></div>
              <div className="flex justify-center gap-2 my-2.5">
                <Spark size={9} color="#B49FD0" cls="twinkle" />
                <Spark size={9} color="#C4A8E0" cls="twinkle2" />
                <Spark size={9} color="#B49FD0" cls="twinkle3" />
              </div>
              <p className="text-sm font-medium italic text-[#261B40] leading-snug" style={{ fontFamily: "var(--font-display)" }}>{q.a}</p>
              <p className="text-sm font-semibold text-[#7654A8] leading-snug mt-0.5" style={{ fontFamily: "var(--font-display)" }}>{q.b}</p>
              <p className="text-xs text-[#9685B0] mt-3">💜</p>
            </div>
          </GL>
        </div>

        {/* Clock + Weather */}
        <div className="su2 grid gap-3" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
          <GL radius={26}>
            <div className="px-5 py-6 text-center">
              <p className="font-semibold text-[#5A3E8A] leading-none tracking-[-2.5px]"
                style={{ fontFamily: "var(--font-display)", fontSize: "44px" }}>{timeStr}</p>
              <div className="flex justify-center items-center gap-1.5 mt-2">
                <Spark size={9} color="#B49FD0" cls="twinkle" />
                <p className="text-[11px] text-[#9685B0] font-medium">make a wish</p>
                <Spark size={9} color="#B49FD0" cls="twinkle2" />
              </div>
              <div className="flex justify-center items-center gap-3 mt-3">
                <span className="breathe text-[22px]">⭐</span>
                <div className="float"><Bow size={22} color="#D0B8EA" /></div>
                <span className="breathe2 text-[22px]">⭐</span>
              </div>
            </div>
          </GL>

          <GL radius={26}>
            <div className="py-6 px-3.5 flex flex-col items-center justify-center text-center">
              {weather ? (<>
                <span className="text-[32px] leading-none float">{weather.icon}</span>
                <p className="font-semibold text-[#5A3E8A] leading-none tracking-[-1.5px] mt-2"
                  style={{ fontFamily: "var(--font-display)", fontSize: "38px" }}>{weather.temp}°</p>
                <p className="text-[10px] text-[#9685B0] mt-1 capitalize">{weather.desc}</p>
                <p className="text-[10px] text-[#B49FD0] mt-1">good vibes 💜</p>
              </>) : (<>
                <span className="text-[32px] leading-none breathe">🌤️</span>
                <p className="text-[10px] text-[#9685B0] mt-2.5 leading-relaxed">
                  {weatherLoading ? "finding weather..." : isOnline ? "weather unavailable" : "offline"}
                </p>
              </>)}
            </div>
          </GL>
        </div>

        {/* Todo */}
        <div className="su3">
          <GL radius={26}>
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium italic text-[#261B40]"
                  style={{ fontFamily: "var(--font-display)" }}>to do list</h3>
                <span className="text-base text-[#B49FD0] tracking-[3px]">···</span>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {todos.map(t => (
                  <div key={t.id} className="flex items-center gap-2.5 mb-3 px-1 py-0.5">
                    <button onClick={() => toggleTodo(t.id)}
                      className={`heart-toggle ${t.done ? "heart-pop" : ""}`}>
                      {t.done ? "💜" : "🤍"}
                    </button>
                    <span className={`flex-1 text-[13px] ${t.done ? "line-through text-[#9685B0]" : "text-[#261B40]"}`}>
                      {t.text}
                    </span>
                    <button onClick={() => delTodo(t.id)}
                      className="bg-transparent border-none cursor-pointer text-xs text-[#C4A8E0] px-1">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3.5">
                <input value={newTodo} onChange={e => setNewTodo(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTodo()}
                  placeholder="add a task... 💜"
                  className="flex-1 px-4 py-2.5 rounded-2xl border border-[#DDD3F0] bg-white/60 text-[#261B40] text-[13px]" />
                <button onClick={addTodo}
                  className="w-11 h-11 rounded-2xl text-xl flex items-center justify-center flex-shrink-0 btn-purple shimmer-press">＋</button>
              </div>
            </div>
          </GL>
        </div>

        {/* Break + Mood */}
        <div className="su4 grid gap-3" style={{ gridTemplateColumns: "1fr 1.25fr" }}>
          <GL radius={26}>
            <div className="p-6 flex flex-col items-center justify-center text-center">
              <span className="breathe text-[34px]">🕯️</span>
              <p className="mt-3 text-[13px] font-medium italic text-[#261B40]"
                style={{ fontFamily: "var(--font-display)" }}>take a break</p>
              <p className="mt-1 text-[11px] text-[#9685B0]">you deserve it</p>
              <div className="mt-3 float2"><Bow size={20} color="#D4BCE8" /></div>
            </div>
          </GL>

          <GL radius={26}>
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[13px] font-semibold text-[#261B40]">current mood</p>
                <span className="text-[13px] text-[#B49FD0] tracking-[2px]">···</span>
              </div>
              {MOODS.map(({ label, emoji }) => (
                <div key={label} onClick={() => toggleMood(label)}
                  className={`option-chip interactive-option flex items-center gap-1.5 mb-1.5 cursor-pointer px-1.5 py-0.5 rounded-xl ${moods.includes(label) ? "is-selected" : ""}`}
                  style={{ background: moods.includes(label) ? "var(--accent-soft)" : "transparent" }}>
                  <span className="text-xs leading-none">{moods.includes(label) ? "💜" : "🤍"}</span>
                  <span className={`text-[11px] flex-1 ${moods.includes(label) ? "text-[#7654A8] font-semibold" : "text-[#9685B0]"}`}>{label}</span>
                  <span className="text-xs">{emoji}</span>
                </div>
              ))}
            </div>
          </GL>
        </div>

        {/* Quote Banner */}
        <div className="su5">
          <GL radius={26}>
            <div className="px-6 py-7 text-center">
              <span className="text-2xl text-[#B49FD0] leading-none block"
                style={{ fontFamily: "var(--font-display)" }}>"</span>
              <p className="my-3 text-[17px] font-medium italic text-[#261B40] leading-relaxed"
                style={{ fontFamily: "var(--font-display)" }}>
                small progress<br />
                <span className="text-[#7654A8] font-semibold">big change</span>
              </p>
              <span className="text-2xl text-[#B49FD0] leading-none block"
                style={{ fontFamily: "var(--font-display)" }}>"</span>
            </div>
          </GL>
        </div>

        {/* Focus */}
        <div className="su6">
          <GL radius={26}>
            <div className="px-5 py-5 flex items-center gap-4">
              <span className="text-[34px] flex-shrink-0 float">🕊️</span>
              <div className="flex-1">
                <p className="text-xs text-[#9685B0]">where focus goes</p>
                <p className="mt-1 text-[18px] font-semibold italic text-[#7654A8]"
                  style={{ fontFamily: "var(--font-display)" }}>energy flows</p>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <Spark size={13} color="#C4A8E0" cls="twinkle" />
                <Spark size={10} color="#B49FD0" cls="twinkle2" />
                <Spark size={13} color="#C4A8E0" cls="twinkle3" />
              </div>
            </div>
          </GL>
        </div>

        {/* Journal */}
        <div className="su7">
          <GL radius={26}>
            <div className="p-5">
              <div className="flex justify-between items-center mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-[18px]">📔</span>
                  <h3 className="text-[17px] font-medium italic text-[#261B40]"
                    style={{ fontFamily: "var(--font-display)" }}>my journal</h3>
                </div>
                <span className={`text-[11px] ${saved ? "text-[#7654A8] font-semibold" : "text-[#9685B0]"}`}>
                  {saved ? "saved 💜" : "auto save"}
                </span>
              </div>
              <textarea value={journal} onChange={e => handleJournal(e.target.value)}
                placeholder={"write your thoughts here...\n\nthis space is just for you 💜"}
                className="w-full min-h-[150px] px-4 py-4 rounded-[18px] border border-[#DDD3F0] bg-white/55 text-[#261B40] text-[13px] resize-y leading-relaxed"
                style={{ display: "block", boxSizing: "border-box" }} />
            </div>
          </GL>
        </div>

        {/* Soft Cards */}
        <div className="su8 grid grid-cols-2 gap-3">
          <GL radius={26}>
            <div className="p-6 text-center">
              <span className="breathe text-[30px]">🌷</span>
              <p className="mt-3 text-[13px] font-medium italic text-[#261B40] leading-snug"
                style={{ fontFamily: "var(--font-display)" }}>go at your own pace</p>
              <p className="mt-1 text-[10px] text-[#9685B0]">no rush, no pressure</p>
            </div>
          </GL>
          <GL radius={26}>
            <div className="p-6 text-center">
              <span className="breathe2 text-[30px]">🌙</span>
              <p className="mt-3 text-[13px] font-medium italic text-[#261B40] leading-snug"
                style={{ fontFamily: "var(--font-display)" }}>rest is part of the process</p>
              <p className="mt-1 text-[10px] text-[#9685B0]">be gentle with yourself</p>
            </div>
          </GL>
        </div>

        <p className="text-center text-[11px] text-[#B49FD0] py-1">made with 💜 just for you</p>
      </div>

      {/* Overlay pages */}
      {overlayPage && (
        <div className="fixed inset-0 z-[400] overlay-bg" style={{ background: "var(--bg-page)" }}>
          <div className="page-enter h-full">
            <Suspense fallback={<PageFallback />}>
              {overlayPage === "notes"        && <NotesPage onBack={() => { setOverlayPage(null); setActiveTab("home"); }} />}
              {overlayPage === "audio"        && <AudioNotesPage onBack={() => { setOverlayPage(null); setActiveTab("home"); }} />}
              {overlayPage === "productivity" && <ProductivityPage onBack={() => { setOverlayPage(null); setActiveTab("home"); }} />}
              {overlayPage === "star"         && <StarPage onBack={() => { setOverlayPage(null); setActiveTab("home"); }} />}
            </Suspense>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center pt-2.5 pb-[18px]"
        style={{
          background: "var(--bg-elevated)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderTop: "1px solid var(--border-card)",
          boxShadow: "var(--shadow-elevated)",
        }}>
        {(["🤍","💬","🎀","⭐","🎵"] as const).map((icon, i) => {
          const id = ["home","chat","bow","star","music"][i];
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => {
                setActiveTab(id);
                if (id === "chat")        setOverlayPage("notes");
                else if (id === "bow")    setOverlayPage("productivity");
                else if (id === "music")  setOverlayPage("audio");
                else if (id === "star")   setOverlayPage("star");
                else                      setOverlayPage(null);
              }}
              className="nav-button bg-transparent border-none cursor-pointer flex flex-col items-center"
              style={{ opacity: active ? 1 : .42, transform: active ? "translate3d(0,-3px,0)" : "none", padding: "4px 14px" }}>
              <span className="nav-icon" style={{ fontSize: active ? 26 : 21, transform: active ? "scale(1.06)" : "scale(1)" }}>{icon}</span>
              {active && <span className="nav-indicator" aria-hidden />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
