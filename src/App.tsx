import { useState, useEffect, useRef, lazy, Suspense } from "react";
import PetalCanvas from "./PetalCanvas";
import { approximateBytes, clearAll, formatBytes } from "./storage";
import { downloadJsonBackup, importJsonFile } from "./backup";
import {
  type AudioNote,
  loadAudioLibrary,
  subscribeToAudioLibrary,
} from "./audioLibrary";
import { triggerBirthdayConfetti } from "./confetti";
import {
  BookOpen,
  Bow,
  Cake,
  CheckCircle2,
  Cloud,
  Download,
  ExternalLink,
  Eye,
  Feather,
  Flame,
  Flower2,
  Gift,
  Headphones,
  HeartMark,
  Home,
  IconBadge,
  ListMusic,
  Lock,
  type MoodId,
  MoodGlyph,
  MoonStar,
  MoreHorizontal,
  Music2,
  NotebookPen,
  Palette,
  Pause,
  Play,
  Plus,
  Settings,
  ShieldAlert,
  SkipBack,
  SkipForward,
  Spark,
  Sparkles,
  Timer,
  Unlock,
  Upload,
  type WeatherKind,
  WeatherGlyph,
  WifiOff,
  X,
} from "./icons";

const NotesPage = lazy(() => import("./NotesPage"));
const AudioNotesPage = lazy(() => import("./AudioNotesPage"));
const ProductivityPage = lazy(() => import("./ProductivityPage"));
const StarPage = lazy(() => import("./StarPage"));

const PageFallback = () => (
  <div
    className="page-surface"
    style={{
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <IconBadge size={52} radius={18} active className="breathe">
      <Sparkles size={24} strokeWidth={1.8} />
    </IconBadge>
  </div>
);

const QUOTES = [
  { a: "real is rare", b: "you are magic" },
  { a: "small progress", b: "big change" },
  { a: "where focus goes", b: "energy flows" },
  { a: "go at your", b: "own pace" },
  { a: "you deserve", b: "all good things" },
  { a: "bloom where", b: "you are planted" },
  { a: "soft life", b: "sweet soul" },
  { a: "rest is", b: "productive too" },
];

const MOODS: { label: MoodId }[] = [
  { label: "grateful" },
  { label: "peaceful" },
  { label: "motivated" },
  { label: "in my flow" },
  { label: "happy" },
  { label: "creative" },
  { label: "tired" },
];

const DEFAULT_TODOS = [
  { id: 1, text: "morning stretch", done: false },
  { id: 2, text: "plan my day", done: false },
  { id: 3, text: "drink water", done: false },
  { id: 4, text: "focus on goals", done: false },
  { id: 5, text: "learn something new", done: false },
  { id: 6, text: "be proud of yourself", done: false },
];

interface Weather {
  temp: number;
  desc: string;
  kind: WeatherKind;
}

const isOctober25 = (date: Date): boolean =>
  date.getMonth() === 9 && date.getDate() === 25;

const getJson = <T,>(key: string, fallback: T): T => {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const getString = (key: string, fallback: string): string => {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw;
  } catch {
    return fallback;
  }
};

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      void 0;
    }
  },
};

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const GL = ({ children, radius = 26 }: { children: React.ReactNode; radius?: number }) => (
  <div className="glass-card" style={{ borderRadius: radius }}>
    {children}
  </div>
);

type Overlay = null | "notes" | "audio" | "productivity" | "star";

const NAV_ITEMS = [
  { id: "home", label: "Home", Icon: Home, overlay: null },
  { id: "chat", label: "Notes", Icon: NotebookPen, overlay: "notes" as const },
  { id: "bow", label: "Focus", Icon: Timer, overlay: "productivity" as const },
  { id: "star", label: "Constellation", Icon: Sparkles, overlay: "star" as const },
  { id: "music", label: "Audio", Icon: Headphones, overlay: "audio" as const },
] as const;

export default function PurpleDashboard() {
  const [time, setTime] = useState(() => new Date());
  const name = "يا روحي";
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
  const [audioLibrary, setAudioLibrary] = useState<AudioNote[]>(() => loadAudioLibrary());
  const [curIdx, setCurIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [overlayPage, setOverlayPage] = useState<Overlay>(null);

  const [showBirthdayModal, setShowBirthdayModal] = useState(() => isOctober25(new Date()));
  const [isSpoilerRevealed, setIsSpoilerRevealed] = useState(false);
  const [hasOpenedSurprise, setHasOpenedSurprise] = useState(
    () => ls.get("birthday_surprise_visited_v1") === "true",
  );
  const [lockWarning, setLockWarning] = useState(false);
  const wasOct25Ref = useRef(isOctober25(new Date()));

  const [settingsTab, setSettingsTab] = useState<"appearance" | "backup" | "privacy">("appearance");
  const [backupBusy, setBackupBusy] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupErr, setBackupErr] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [storageBytes, setStorageBytes] = useState(0);
  const importFileRef = useRef<HTMLInputElement>(null);

  const [installEvent, setInstallEvent] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [showInstallPill, setShowInstallPill] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const audioRef = useRef<HTMLAudioElement>(null);
  const seekRef = useRef<HTMLDivElement>(null);
  const jTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const q = QUOTES[time.getDate() % QUOTES.length];
  const isBirthdayToday = isOctober25(time);

  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      setTime(now);
      const currentlyOct25 = isOctober25(now);
      if (currentlyOct25 && !wasOct25Ref.current) {
        setIsSpoilerRevealed(false);
        setShowBirthdayModal(true);
      } else if (!currentlyOct25 && wasOct25Ref.current) {
        setShowBirthdayModal(false);
      }
      wasOct25Ref.current = currentlyOct25;
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const codeMap: Record<number, { kind: WeatherKind; desc: string }> = {
      0: { kind: "clear", desc: "clear sky" },
      1: { kind: "mainly-clear", desc: "mainly clear" },
      2: { kind: "partly-cloudy", desc: "partly cloudy" },
      3: { kind: "overcast", desc: "overcast" },
      45: { kind: "fog", desc: "fog" },
      48: { kind: "fog", desc: "fog" },
      51: { kind: "drizzle", desc: "light drizzle" },
      53: { kind: "drizzle", desc: "drizzle" },
      55: { kind: "drizzle", desc: "drizzle" },
      61: { kind: "rain", desc: "light rain" },
      63: { kind: "rain", desc: "rain" },
      65: { kind: "rain", desc: "heavy rain" },
      71: { kind: "snow", desc: "snow" },
      80: { kind: "rain", desc: "showers" },
      95: { kind: "storm", desc: "thunderstorm" },
    };

    const updateWeather = async (lat: number, lon: number) => {
      setWeatherLoading(true);
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`,
        );
        const data = await res.json();
        const current = data?.current_weather;
        if (current) {
          const mapped = codeMap[current.weathercode] ?? {
            kind: "mainly-clear" as WeatherKind,
            desc: "weather",
          };
          setWeather({
            temp: Math.round(current.temperature),
            desc: mapped.desc,
            kind: mapped.kind,
          });
        }
      } catch {
        setWeather(null);
      } finally {
        setWeatherLoading(false);
      }
    };

    const fallback = () => updateWeather(23.8, 90.4);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => updateWeather(coords.latitude, coords.longitude),
        fallback,
        { timeout: 6000 },
      );
    } else {
      fallback();
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const [pwaToast, setPwaToast] = useState<null | { kind: "ready" | "update"; msg: string }>(null);
  useEffect(() => {
    const onReady = () => {
      setPwaToast({ kind: "ready", msg: "offline ready — your space works without wifi" });
      setTimeout(() => setPwaToast(null), 4500);
    };
    const onUpdate = () => {
      setPwaToast({ kind: "update", msg: "fresh updates ready — refresh anytime" });
      setTimeout(() => setPwaToast(null), 6000);
    };
    window.addEventListener("pwa-offline-ready", onReady);
    window.addEventListener("pwa-update-available", onUpdate);
    return () => {
      window.removeEventListener("pwa-offline-ready", onReady);
      window.removeEventListener("pwa-update-available", onUpdate);
    };
  }, []);

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

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as unknown as { prompt: () => Promise<void> });
      if (ls.get("install_dismissed_v1") !== "true") {
        setTimeout(() => setShowInstallPill(true), 8000);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

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
      window.setTimeout(() => {
        ripple.remove();
      }, 500);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    const reload = () => {
      const next = loadAudioLibrary();
      setAudioLibrary(next);
      setCurIdx((i) => {
        if (next.length === 0) return 0;
        return Math.min(i, next.length - 1);
      });
      if (next.length === 0) {
        audioRef.current?.pause();
      }
    };
    return subscribeToAudioLibrary(reload);
  }, []);

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
    if (wasPlaying) {
      audio.play().catch(() => {
        void 0;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curIdx, audioLibrary[curIdx]?.id]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audioLibrary.length) {
      setActiveTab("music");
      setOverlayPage("audio");
      return;
    }
    if (playing) {
      audio.pause();
    } else {
      try {
        await audio.play();
      } catch {
        void 0;
      }
    }
  };

  const skip = (d: number) => {
    if (!audioLibrary.length) return;
    setCurIdx((i) => (i + d + audioLibrary.length) % audioLibrary.length);
  };

  const seekAudio = (e: React.MouseEvent) => {
    if (!seekRef.current || !audioRef.current || !duration) return;
    const rect = seekRef.current.getBoundingClientRect();
    audioRef.current.currentTime =
      Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  };

  const addTodo = () => {
    if (!newTodo.trim()) return;
    const u = [...todos, { id: Date.now(), text: newTodo.trim(), done: false }];
    setTodos(u);
    setNewTodo("");
    ls.set("todos", JSON.stringify(u));
  };

  const toggleTodo = (id: number) => {
    const u = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    setTodos(u);
    ls.set("todos", JSON.stringify(u));
  };

  const delTodo = (id: number) => {
    const u = todos.filter((t) => t.id !== id);
    setTodos(u);
    ls.set("todos", JSON.stringify(u));
  };

  const toggleMood = (m: string) => {
    const u = moods.includes(m) ? moods.filter((x) => x !== m) : [...moods, m];
    setMoods(u);
    ls.set("moods", JSON.stringify(u));
  };

  const handleJournal = (val: string) => {
    setJournal(val);
    clearTimeout(jTimer.current);
    jTimer.current = setTimeout(() => {
      ls.set("journal", val);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  };

  const saveSettings = () => {
    setDarkMode(tempDarkMode);
    ls.set("darkMode", JSON.stringify(tempDarkMode));
    setShowSettings(false);
  };

  const refreshStorageBytes = () => setStorageBytes(approximateBytes().total);

  const flashMsg = (msg: string) => {
    setBackupMsg(msg);
    setBackupErr(null);
    window.setTimeout(() => setBackupMsg(null), 4000);
  };

  const flashErr = (err: unknown) => {
    const msg = err instanceof Error ? err.message : "something went wrong";
    setBackupErr(msg);
    setBackupMsg(null);
    window.setTimeout(() => setBackupErr(null), 6000);
  };

  const onExportFile = () => {
    try {
      downloadJsonBackup();
      flashMsg("backup file downloaded");
    } catch (e) {
      flashErr(e);
    }
  };

  const onImportFilePick = () => importFileRef.current?.click();

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setBackupBusy("reading file...");
    try {
      const result = await importJsonFile(file, importMode);
      flashMsg(
        `imported ${result.applied} item${result.applied === 1 ? "" : "s"} — refresh to see changes`,
      );
      refreshStorageBytes();
    } catch (e) {
      flashErr(e);
    } finally {
      setBackupBusy(null);
    }
  };

  const onClearAll = () => {
    const removed = clearAll();
    setShowClearConfirm(false);
    flashMsg(`cleared ${removed} item${removed === 1 ? "" : "s"} — refresh to see changes`);
    refreshStorageBytes();
  };

  const promptInstall = async () => {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
    } catch {
      void 0;
    }
    setShowInstallPill(false);
    setInstallEvent(null);
  };

  const dismissInstall = () => {
    ls.set("install_dismissed_v1", "true");
    setShowInstallPill(false);
  };

  const h = time.getHours();
  const greeting =
    h < 5
      ? "sweet dreams"
      : h < 12
        ? "good morning"
        : h < 17
          ? "good afternoon"
          : h < 21
            ? "good evening"
            : "good night";
  const timeStr = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dateStr = time.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="min-h-screen pb-24"
      style={{
        background: "var(--bg-app)",
        color: "var(--text-primary)",
      }}
    >
      <PetalCanvas />

      <audio
        ref={audioRef}
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => skip(1)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {!isOnline && (
        <aside className="offline-banner flex items-center justify-center gap-2" role="status">
          <WifiOff size={13} strokeWidth={2} />
          <span>you're offline — your space still works, weather will be back soon</span>
        </aside>
      )}

      {pwaToast && (
        <aside className="pwa-toast flex items-center justify-center gap-2" role="status">
          <Sparkles size={13} strokeWidth={2} />
          <span>{pwaToast.msg}</span>
        </aside>
      )}

      {showInstallPill && installEvent && (
        <aside className="install-pill">
          <Sparkles size={14} strokeWidth={2} />
          <span>install for offline access</span>
          <button onClick={promptInstall}>install</button>
          <button
            onClick={dismissInstall}
            aria-label="dismiss"
            className="inline-flex items-center justify-center"
            style={{ padding: "4px 8px" }}
          >
            <X size={13} strokeWidth={2} />
          </button>
        </aside>
      )}

      {showBirthdayModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="birthday-wish-title"
          className="fixed inset-0 z-[500] flex items-center justify-center p-4 overlay-bg"
          style={{ background: "rgba(28, 12, 56, 0.62)", backdropFilter: "blur(16px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (!hasOpenedSurprise) {
                setLockWarning(true);
                setTimeout(() => setLockWarning(false), 2600);
              } else {
                setShowBirthdayModal(false);
              }
            }
          }}
        >
          <article
            className={`glass-card birthday-card w-full max-w-[390px] p-6 text-center ${lockWarning ? "shake-soft" : ""}`}
          >
            <div className="birthday-glow" aria-hidden />

            <header className="relative z-10 flex flex-col items-center">
              <div
                className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-widest mb-4"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  border: "1px solid var(--border-soft)",
                }}
              >
                <Spark size={9} color="var(--accent)" cls="twinkle" />
                <span>25 october · confidential surprise</span>
                <Spark size={9} color="var(--accent)" cls="twinkle2" />
              </div>

              <div className="flex items-center justify-center gap-3 mb-2">
                <Spark size={14} color="#C4A8E0" cls="twinkle" />
                <IconBadge size={64} radius={22} active className="float">
                  {hasOpenedSurprise ? (
                    <Cake size={30} strokeWidth={1.75} />
                  ) : (
                    <Gift size={30} strokeWidth={1.75} />
                  )}
                </IconBadge>
                <Spark size={14} color="#C4A8E0" cls="twinkle2" />
              </div>

              <div className="my-1 float2">
                <Bow size={30} color="#C4A8E0" />
              </div>

              <h2
                id="birthday-wish-title"
                className="mt-2 text-[28px] font-semibold italic leading-tight shimmer-text"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Happy Birthday, {name}
              </h2>
              <p
                className="mt-1 text-xs font-medium flex items-center justify-center gap-1.5"
                style={{ color: "var(--text-muted)" }}
              >
                <span>a secret surprise has been locked for you</span>
                <Sparkles size={13} strokeWidth={2} style={{ color: "var(--accent)" }} />
              </p>
            </header>

            <section
              className="relative z-10 mt-4 p-4 rounded-3xl"
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-soft)",
              }}
            >
              <p
                className="text-[14px] italic leading-relaxed"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--text-primary)",
                }}
              >
                “Today is your day, but you cannot enter your space just yet. Someone crafted an
                exclusive birthday world hidden behind this spoiler. Uncover it below to unlock
                your sanctuary.”
              </p>
            </section>

            <section className="relative z-10 mt-4">
              {!isSpoilerRevealed ? (
                <button
                  type="button"
                  onClick={() => setIsSpoilerRevealed(true)}
                  className="w-full spoiler-card p-5 text-center spoiler-overlay-shimmer group cursor-pointer border-none"
                  style={{ background: "var(--bg-card-soft)" }}
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span
                      className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-semibold"
                      style={{
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        border: "1px solid var(--border-soft)",
                      }}
                    >
                      <Eye size={13} strokeWidth={2.2} />
                      <span>tap to reveal spoiler</span>
                    </span>
                    <p
                      className="text-[14px] font-semibold tracking-wide"
                      style={{
                        fontFamily: "var(--font-display)",
                        color: "var(--text-secondary)",
                        fontStyle: "italic",
                      }}
                    >
                      click here to see spoiler
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      contains your secret birthday surprise link
                    </p>
                  </div>
                </button>
              ) : (
                <div
                  className="spoiler-card p-4 text-center pop-in"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--accent)",
                  }}
                >
                  <div
                    className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "var(--accent)" }}
                  >
                    <Sparkles size={13} strokeWidth={2} />
                    <span>Secret Surprise Uncovered</span>
                  </div>

                  <p className="text-xs mb-3 leading-snug" style={{ color: "var(--text-muted)" }}>
                    Open the link below to view your personalized surprise. You must visit it at least once to unlock your space!
                  </p>

                  <a
                    href="https://ursurprizeeee.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      setHasOpenedSurprise(true);
                      ls.set("birthday_surprise_visited_v1", "true");
                      triggerBirthdayConfetti();
                    }}
                    className="w-full py-3.5 px-4 rounded-2xl text-sm font-semibold btn-purple shimmer-press inline-flex items-center justify-center gap-2"
                    style={{ textDecoration: "none" }}
                  >
                    <span>Open Birthday Surprise</span>
                    <ExternalLink size={15} strokeWidth={2.2} />
                  </a>

                  <p
                    className="text-[10px] mt-2 tracking-wide font-mono"
                    style={{ color: "var(--text-faint)" }}
                  >
                    ursurprizeeee.vercel.app
                  </p>

                  {hasOpenedSurprise && (
                    <div className="mt-3 flex flex-col items-center gap-1.5 pop-in">
                      <div
                        className="py-1.5 px-3 rounded-xl text-[11px] font-medium inline-flex items-center justify-center gap-1.5"
                        style={{
                          background: "var(--accent-soft)",
                          color: "var(--accent)",
                          border: "1px solid var(--border-soft)",
                        }}
                      >
                        <CheckCircle2 size={13} strokeWidth={2} />
                        <span>Surprise visited · Your space is unlocked</span>
                      </div>
                      <button
                        type="button"
                        onClick={triggerBirthdayConfetti}
                        className="text-[11px] font-semibold bg-transparent border-none cursor-pointer inline-flex items-center gap-1 hover:underline pt-0.5"
                        style={{ color: "var(--accent)" }}
                      >
                        <Sparkles size={12} strokeWidth={2} />
                        <span>replay festive confetti</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {lockWarning && (
              <aside
                role="alert"
                className="relative z-10 mt-3 p-2.5 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 shake-soft"
                style={{
                  background: "var(--danger-bg)",
                  color: "var(--danger)",
                  border: "1px solid var(--danger)",
                }}
              >
                <Lock size={12} strokeWidth={2} />
                <span>You must click and open your surprise before entering!</span>
              </aside>
            )}

            <footer className="relative z-10 mt-4">
              {!hasOpenedSurprise ? (
                <button
                  type="button"
                  onClick={() => {
                    setLockWarning(true);
                    setTimeout(() => setLockWarning(false), 2600);
                  }}
                  className="w-full py-3.5 rounded-2xl text-xs font-semibold btn-locked inline-flex items-center justify-center gap-2"
                >
                  <Lock size={14} strokeWidth={2} />
                  <span>visit surprise to unlock space</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    triggerBirthdayConfetti();
                    setShowBirthdayModal(false);
                  }}
                  className="w-full py-3.5 rounded-2xl text-sm font-semibold btn-purple shimmer-press inline-flex items-center justify-center gap-2"
                >
                  <Unlock size={15} strokeWidth={2} />
                  <span>enter my space</span>
                </button>
              )}
            </footer>
          </article>
        </div>
      )}

      {showSettings && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 overlay-bg"
          style={{ background: "rgba(35,18,65,.55)", backdropFilter: "blur(14px)" }}
          onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}
        >
          <article
            className="glass-card w-full max-w-md page-enter"
            style={{
              borderRadius: 28,
              maxHeight: "min(86vh, 700px)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <header
              className="px-6 pt-6 pb-3 flex items-center gap-3"
              style={{ borderBottom: "1px solid var(--border-card)" }}
            >
              <Bow size={22} color="var(--accent-2)" />
              <h3
                className="text-xl font-medium italic"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--text-secondary)",
                  flex: 1,
                }}
              >
                settings
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                aria-label="close settings"
                className="bg-transparent border-none cursor-pointer inline-flex items-center justify-center p-1"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </header>

            <nav className="flex px-4 pt-2" style={{ gap: 4 }}>
              {(
                [
                  { id: "appearance", label: "look", Icon: Palette },
                  { id: "backup", label: "backup", Icon: Cloud },
                  { id: "privacy", label: "privacy", Icon: Lock },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setSettingsTab(id)}
                  className={`settings-tab inline-flex items-center justify-center gap-1.5 ${settingsTab === id ? "active" : ""}`}
                >
                  <Icon size={13} strokeWidth={2} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>

            <div className="px-6 py-5" style={{ overflowY: "auto" }}>
              {settingsTab === "appearance" && (
                <div className="flex flex-col gap-4">
                  <div
                    className="p-4 rounded-3xl"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-soft)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p
                          className="text-[11px] font-semibold uppercase tracking-widest mb-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          dark mode
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                          soft on the eyes at night
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tempDarkMode}
                          onChange={(e) => setTempDarkMode(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div
                          className="w-11 h-6 rounded-full peer-checked:bg-[#7A4DD8] transition-all"
                          style={{ background: "var(--border-soft)" }}
                        />
                        <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-md peer-checked:translate-x-5 transition-transform" />
                      </label>
                    </div>
                  </div>

                  <p className="text-[11px] text-center" style={{ color: "var(--text-faint)" }}>
                    animations slow down automatically if your device prefers reduced motion
                  </p>

                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        setTempDarkMode(darkMode);
                        setShowSettings(false);
                      }}
                      className="flex-1 py-3 rounded-2xl text-sm icon-button"
                      style={{
                        border: "1px solid var(--border-soft)",
                        color: "var(--text-muted)",
                        background: "transparent",
                        cursor: "pointer",
                      }}
                    >
                      cancel
                    </button>
                    <button
                      onClick={saveSettings}
                      className="flex-1 py-3 rounded-2xl text-sm font-semibold btn-purple shimmer-press"
                    >
                      apply
                    </button>
                  </div>
                </div>
              )}

              {settingsTab === "backup" && (
                <div className="flex flex-col gap-4">
                  <div
                    className="p-4 rounded-3xl"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-soft)",
                    }}
                  >
                    <p
                      className="text-[11px] font-semibold uppercase tracking-widest mb-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      local backup file
                    </p>
                    <p className="text-[11px] mb-3" style={{ color: "var(--text-faint)" }}>
                      download a JSON file you can keep anywhere — Drive, iCloud, email to yourself.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={onExportFile}
                        disabled={!!backupBusy}
                        className="flex-1 btn-soft inline-flex items-center justify-center gap-1.5"
                      >
                        <Download size={14} strokeWidth={2} />
                        <span>export</span>
                      </button>
                      <button
                        onClick={onImportFilePick}
                        disabled={!!backupBusy}
                        className="flex-1 btn-soft inline-flex items-center justify-center gap-1.5"
                      >
                        <Upload size={14} strokeWidth={2} />
                        <span>import</span>
                      </button>
                    </div>
                    <input
                      ref={importFileRef}
                      type="file"
                      accept="application/json,.json"
                      hidden
                      onChange={onImportFile}
                    />
                  </div>

                  <div
                    className="p-3 rounded-2xl flex gap-1"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-soft)",
                    }}
                  >
                    {(["merge", "replace"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setImportMode(m)}
                        className="flex-1 py-2 rounded-xl text-[11px] font-semibold"
                        style={{
                          background:
                            importMode === m
                              ? "linear-gradient(135deg, #7654A8, #A870D8)"
                              : "transparent",
                          color: importMode === m ? "white" : "var(--text-muted)",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        {m === "merge" ? "merge with current" : "replace current"}
                      </button>
                    ))}
                  </div>

                  <p className="text-[10px] text-center" style={{ color: "var(--text-faint)" }}>
                    using {formatBytes(storageBytes)} of local storage
                  </p>

                  {backupBusy && (
                    <div className="status-line flex items-center gap-1.5">
                      <Timer size={13} strokeWidth={2} />
                      <span>{backupBusy}</span>
                    </div>
                  )}
                  {backupMsg && (
                    <div className="status-line flex items-center gap-1.5">
                      <CheckCircle2 size={13} strokeWidth={2} />
                      <span>{backupMsg}</span>
                    </div>
                  )}
                  {backupErr && (
                    <div className="status-line error flex items-center gap-1.5">
                      <ShieldAlert size={13} strokeWidth={2} />
                      <span>{backupErr}</span>
                    </div>
                  )}
                </div>
              )}

              {settingsTab === "privacy" && (
                <div className="flex flex-col gap-4">
                  <div
                    className="p-4 rounded-3xl"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-soft)",
                    }}
                  >
                    <p
                      className="text-[11px] font-semibold uppercase tracking-widest mb-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      your data is yours
                    </p>
                    <ul
                      className="text-[11px] leading-relaxed pl-4"
                      style={{ color: "var(--text-secondary)", listStyle: "disc" }}
                    >
                      <li>
                        all notes, audio, and journal text stay <strong>on this device</strong> by
                        default
                      </li>
                      <li>
                        uninstalling the app or clearing browser data will erase everything
                      </li>
                    </ul>
                  </div>

                  <div
                    className="p-4 rounded-3xl"
                    style={{
                      background: "var(--danger-bg)",
                      border: "1px solid var(--danger)",
                    }}
                  >
                    <p
                      className="text-[11px] font-semibold uppercase tracking-widest mb-1"
                      style={{ color: "var(--danger)" }}
                    >
                      danger zone
                    </p>
                    <p className="text-[11px] mb-3" style={{ color: "var(--text-secondary)" }}>
                      this erases all notes, audio notes, todos, mood, journal, and pomodoro stats
                      from this device.
                    </p>
                    {!showClearConfirm ? (
                      <button
                        onClick={() => setShowClearConfirm(true)}
                        className="btn-danger w-full"
                      >
                        clear all data
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          className="flex-1 btn-soft"
                        >
                          cancel
                        </button>
                        <button
                          onClick={onClearAll}
                          className="flex-1 btn-danger"
                          style={{ background: "var(--danger)", color: "white" }}
                        >
                          yes, erase
                        </button>
                      </div>
                    )}
                  </div>

                  {backupMsg && (
                    <div className="status-line flex items-center gap-1.5">
                      <CheckCircle2 size={13} strokeWidth={2} />
                      <span>{backupMsg}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </article>
        </div>
      )}

      {showPlaylist && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Playlist"
          className="fixed inset-0 z-[300] flex items-end justify-center overlay-bg"
          style={{ background: "rgba(35,18,65,.52)", backdropFilter: "blur(14px)" }}
          onClick={(e) => e.target === e.currentTarget && setShowPlaylist(false)}
        >
          <div className="w-full max-w-[430px] p-4 pb-8 page-enter">
            <GL radius={28}>
              <div className="p-6">
                <header className="flex justify-between items-center mb-5">
                  <div className="flex items-center gap-2.5">
                    <IconBadge size={32} radius={10}>
                      <ListMusic size={16} strokeWidth={1.9} />
                    </IconBadge>
                    <h3
                      className="text-lg font-medium italic"
                      style={{
                        fontFamily: "var(--font-display)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      playlist
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowPlaylist(false)}
                    className="text-sm bg-transparent border-none cursor-pointer icon-button"
                    style={{ color: "var(--text-muted)" }}
                  >
                    close
                  </button>
                </header>
                {audioLibrary.length === 0 ? (
                  <p
                    className="text-[13px] text-center py-4"
                    style={{ color: "var(--text-muted)" }}
                  >
                    no audio yet — open the library to add some
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
                    {audioLibrary.map((track, i) => (
                      <div
                        key={track.id}
                        className="interactive-option flex items-center gap-3 p-3 rounded-2xl"
                        style={{
                          background: i === curIdx ? "var(--accent-soft)" : "var(--bg-input)",
                        }}
                      >
                        <button
                          onClick={() => {
                            setCurIdx(i);
                            setShowPlaylist(false);
                          }}
                          className="bg-transparent border-none cursor-pointer p-0 leading-none icon-button inline-flex items-center justify-center"
                        >
                          <HeartMark filled={i === curIdx} size={15} />
                        </button>
                        <span
                          className="flex-1 text-[12px] truncate"
                          style={{
                            color: i === curIdx ? "var(--accent)" : "var(--text-primary)",
                            fontWeight: i === curIdx ? 600 : 400,
                          }}
                        >
                          {track.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex mt-4">
                  <button
                    onClick={() => {
                      setShowPlaylist(false);
                      setActiveTab("music");
                      setOverlayPage("audio");
                    }}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold btn-purple shimmer-press"
                  >
                    open audio library
                  </button>
                </div>
              </div>
            </GL>
          </div>
        </div>
      )}

      <main className="max-w-[430px] mx-auto px-3.5 pt-5 pb-2 flex flex-col gap-3 relative z-10">
        <header className="su0 flex justify-between items-start px-1">
          <div>
            <p className="text-xs text-[#9685B0] font-medium flex items-center gap-1.5">
              {greeting} <Spark size={9} color="#B49FD0" cls="twinkle" />
            </p>
            <h1
              className="mt-1 text-[30px] font-medium italic leading-tight text-[#5A3E8A]"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-.4px" }}
            >
              {name}
            </h1>
            <p className="mt-1.5 text-[11px] text-[#B49FD0]">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            {isBirthdayToday && (
              <button
                onClick={() => setShowBirthdayModal(true)}
                aria-label="open birthday wish"
                className="w-10 h-10 flex items-center justify-center icon-button nav-button flex-shrink-0 breathe"
                style={{
                  borderRadius: "50%",
                  background: "var(--accent-soft)",
                  border: "1px solid var(--border-card)",
                  color: "var(--accent)",
                  boxShadow: "0 2px 14px rgba(120,80,190,.14)",
                }}
              >
                <Cake size={18} strokeWidth={1.85} />
              </button>
            )}
            <button
              onClick={() => {
                setTempDarkMode(darkMode);
                refreshStorageBytes();
                setShowSettings(true);
              }}
              aria-label="settings"
              className="w-10 h-10 flex items-center justify-center icon-button nav-button flex-shrink-0"
              style={{
                borderRadius: "50%",
                background: "var(--bg-card-soft)",
                border: "1px solid var(--border-card)",
                color: "var(--text-secondary)",
                boxShadow: "0 2px 14px rgba(120,80,190,.08)",
              }}
            >
              <Settings size={18} strokeWidth={1.85} />
            </button>
          </div>
        </header>

        <section className="su1 grid gap-3" style={{ gridTemplateColumns: "1.45fr 1fr" }}>
          <GL radius={26}>
            <div className="p-[18px]">
              <div className="flex gap-3 items-center mb-4">
                <div
                  className={`shimmer-bg music-icon-tile w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0${playing ? " is-playing" : ""}`}
                >
                  <Music2 size={20} strokeWidth={2} />
                </div>
                <div className="overflow-hidden flex-1 min-w-0">
                  <p
                    key={audioLibrary[curIdx]?.id ?? "empty"}
                    className="music-track-title text-xs font-semibold text-[#261B40] truncate"
                  >
                    {audioLibrary[curIdx]?.title ?? "your audio library"}
                  </p>
                  <p className="text-[10px] text-[#9685B0] mt-0.5">
                    {audioLibrary.length
                      ? `${audioLibrary.length} track${audioLibrary.length !== 1 ? "s" : ""}`
                      : "tap play to open library"}
                  </p>
                </div>
                <button
                  onClick={() => setShowPlaylist(true)}
                  aria-label="open playlist"
                  className="text-[#B49FD0] bg-transparent border-none cursor-pointer p-1 inline-flex items-center justify-center"
                >
                  <MoreHorizontal size={16} strokeWidth={2} />
                </button>
              </div>

              <div
                ref={seekRef}
                onClick={seekAudio}
                className={`music-progress h-[3px] bg-[#DDD3F0] rounded-full mb-1.5 cursor-pointer relative${playing ? " is-playing" : ""}`}
              >
                <div
                  className="absolute inset-0 rounded-full transition-[width] duration-300"
                  style={{
                    width: `${duration ? (progress / duration) * 100 : 6}%`,
                    background: "linear-gradient(90deg, #7654A8, #B07ADE)",
                  }}
                >
                  <div
                    className="music-progress-thumb absolute -right-[5px] -top-[4px] w-[11px] h-[11px] rounded-full bg-[#7654A8]"
                    style={{
                      boxShadow: "0 0 0 2.5px white, 0 2px 6px rgba(100,60,160,.35)",
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-[#9685B0] mb-3.5">
                <span>{fmt(progress)}</span>
                <span>{fmt(duration)}</span>
              </div>

              <div className="flex items-center justify-around">
                <button
                  onClick={() => skip(-1)}
                  aria-label="previous track"
                  className="music-skip-prev bg-transparent border-none cursor-pointer text-[#7654A8] p-1.5 icon-button inline-flex items-center justify-center"
                >
                  <SkipBack size={18} strokeWidth={2} />
                </button>
                <button
                  onClick={togglePlay}
                  aria-label={playing ? "pause" : "play"}
                  className={`music-play-btn w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 btn-purple icon-button shimmer-press${playing ? " is-playing" : ""}`}
                >
                  {playing ? (
                    <Pause size={18} strokeWidth={2.2} fill="currentColor" />
                  ) : (
                    <Play size={18} strokeWidth={2.2} fill="currentColor" className="ml-0.5" />
                  )}
                </button>
                <button
                  onClick={() => skip(1)}
                  aria-label="next track"
                  className="music-skip-next bg-transparent border-none cursor-pointer text-[#7654A8] p-1.5 icon-button inline-flex items-center justify-center"
                >
                  <SkipForward size={18} strokeWidth={2} />
                </button>
                <button
                  onClick={() => setShowPlaylist(true)}
                  aria-label="playlist"
                  className="bg-transparent border-none cursor-pointer text-[#B49FD0] p-1.5 icon-button inline-flex items-center justify-center"
                >
                  <ListMusic size={17} strokeWidth={1.9} />
                </button>
              </div>
            </div>
          </GL>

          <GL radius={26}>
            <div className="p-5 flex flex-col items-center justify-center text-center h-full">
              <div className="float">
                <Bow size={28} color="#C4A8E0" />
              </div>
              <div className="flex justify-center gap-2 my-2.5">
                <Spark size={9} color="#B49FD0" cls="twinkle" />
                <Spark size={9} color="#C4A8E0" cls="twinkle2" />
                <Spark size={9} color="#B49FD0" cls="twinkle3" />
              </div>
              <p
                className="text-sm font-medium italic text-[#261B40] leading-snug"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {q.a}
              </p>
              <p
                className="text-sm font-semibold text-[#7654A8] leading-snug mt-0.5"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {q.b}
              </p>
              <div className="mt-3">
                <HeartMark filled size={13} />
              </div>
            </div>
          </GL>
        </section>

        <section className="su2 grid gap-3" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
          <GL radius={26}>
            <div className="px-5 py-6 text-center">
              <p
                className="font-semibold text-[#5A3E8A] leading-none tracking-[-2.5px]"
                style={{ fontFamily: "var(--font-display)", fontSize: "44px" }}
              >
                {timeStr}
              </p>
              <div className="flex justify-center items-center gap-1.5 mt-2">
                <Spark size={9} color="#B49FD0" cls="twinkle" />
                <p className="text-[11px] text-[#9685B0] font-medium">make a wish</p>
                <Spark size={9} color="#B49FD0" cls="twinkle2" />
              </div>
              <div className="flex justify-center items-center gap-3 mt-3.5">
                <Spark size={15} color="#B07ADE" cls="breathe" />
                <div className="float">
                  <Bow size={22} color="#D0B8EA" />
                </div>
                <Spark size={15} color="#B07ADE" cls="breathe2" />
              </div>
            </div>
          </GL>

          <GL radius={26}>
            <div className="py-6 px-3.5 flex flex-col items-center justify-center text-center">
              {weather ? (
                <>
                  <IconBadge size={44} radius={15} className="float">
                    <WeatherGlyph kind={weather.kind} size={22} />
                  </IconBadge>
                  <p
                    className="font-semibold text-[#5A3E8A] leading-none tracking-[-1.5px] mt-2.5"
                    style={{ fontFamily: "var(--font-display)", fontSize: "38px" }}
                  >
                    {weather.temp}°
                  </p>
                  <p className="text-[10px] text-[#9685B0] mt-1 capitalize">{weather.desc}</p>
                  <p className="text-[10px] text-[#B49FD0] mt-1 inline-flex items-center gap-1">
                    <span>good vibes</span>
                    <HeartMark filled size={10} />
                  </p>
                </>
              ) : (
                <>
                  <IconBadge size={44} radius={15} className="breathe">
                    <WeatherGlyph kind="mainly-clear" size={22} />
                  </IconBadge>
                  <p className="text-[10px] text-[#9685B0] mt-2.5 leading-relaxed">
                    {weatherLoading
                      ? "finding weather..."
                      : isOnline
                        ? "weather unavailable"
                        : "offline"}
                  </p>
                </>
              )}
            </div>
          </GL>
        </section>

        <section className="su3">
          <GL radius={26}>
            <div className="p-5">
              <div className="flex justify-between items-center mb-4">
                <h3
                  className="text-lg font-medium italic text-[#261B40]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  to do list
                </h3>
                <MoreHorizontal size={16} strokeWidth={2} className="text-[#B49FD0]" />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {todos.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 mb-3 px-1 py-0.5">
                    <button
                      onClick={() => toggleTodo(t.id)}
                      className={`heart-toggle ${t.done ? "heart-pop" : ""}`}
                      aria-label={t.done ? "mark incomplete" : "mark complete"}
                    >
                      <HeartMark filled={t.done} size={15} />
                    </button>
                    <span
                      className={`flex-1 text-[13px] ${t.done ? "line-through text-[#9685B0]" : "text-[#261B40]"}`}
                    >
                      {t.text}
                    </span>
                    <button
                      onClick={() => delTodo(t.id)}
                      aria-label="delete task"
                      className="bg-transparent border-none cursor-pointer text-[#C4A8E0] p-1 inline-flex items-center justify-center"
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3.5">
                <input
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTodo()}
                  placeholder="add a task..."
                  className="flex-1 px-4 py-2.5 rounded-2xl border border-[#DDD3F0] bg-white/60 text-[#261B40] text-[13px]"
                />
                <button
                  onClick={addTodo}
                  aria-label="add task"
                  className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 btn-purple shimmer-press"
                >
                  <Plus size={19} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </GL>
        </section>

        <section className="su4 grid gap-3" style={{ gridTemplateColumns: "1fr 1.25fr" }}>
          <GL radius={26}>
            <div className="p-6 flex flex-col items-center justify-center text-center h-full">
              <IconBadge size={48} radius={16} className="breathe">
                <Flame size={22} strokeWidth={1.8} />
              </IconBadge>
              <p
                className="mt-3 text-[13px] font-medium italic text-[#261B40]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                take a break
              </p>
              <p className="mt-1 text-[11px] text-[#9685B0]">you deserve it</p>
              <div className="mt-3 float2">
                <Bow size={20} color="#D4BCE8" />
              </div>
            </div>
          </GL>

          <GL radius={26}>
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[13px] font-semibold text-[#261B40]">current mood</p>
                <MoreHorizontal size={15} strokeWidth={2} className="text-[#B49FD0]" />
              </div>
              {MOODS.map(({ label }) => {
                const selected = moods.includes(label);
                return (
                  <div
                    key={label}
                    onClick={() => toggleMood(label)}
                    className={`option-chip interactive-option flex items-center gap-2 mb-1.5 cursor-pointer px-2 py-1 rounded-xl ${selected ? "is-selected" : ""}`}
                    style={{
                      background: selected ? "var(--accent-soft)" : "transparent",
                    }}
                  >
                    <HeartMark filled={selected} size={13} />
                    <span
                      className={`text-[11px] flex-1 ${selected ? "text-[#7654A8] font-semibold" : "text-[#9685B0]"}`}
                    >
                      {label}
                    </span>
                    <MoodGlyph mood={label} active={selected} size={13} />
                  </div>
                );
              })}
            </div>
          </GL>
        </section>

        <section className="su5">
          <GL radius={26}>
            <div className="px-6 py-7 text-center">
              <span
                className="text-2xl text-[#B49FD0] leading-none block"
                style={{ fontFamily: "var(--font-display)" }}
              >
                "
              </span>
              <p
                className="my-3 text-[17px] font-medium italic text-[#261B40] leading-relaxed"
                style={{ fontFamily: "var(--font-display)" }}
              >
                small progress
                <br />
                <span className="text-[#7654A8] font-semibold">big change</span>
              </p>
              <span
                className="text-2xl text-[#B49FD0] leading-none block"
                style={{ fontFamily: "var(--font-display)" }}
              >
                "
              </span>
            </div>
          </GL>
        </section>

        <section className="su6">
          <GL radius={26}>
            <div className="px-5 py-5 flex items-center gap-4">
              <IconBadge size={48} radius={16} className="float">
                <Feather size={22} strokeWidth={1.8} />
              </IconBadge>
              <div className="flex-1">
                <p className="text-xs text-[#9685B0]">where focus goes</p>
                <p
                  className="mt-1 text-[18px] font-semibold italic text-[#7654A8]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  energy flows
                </p>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <Spark size={13} color="#C4A8E0" cls="twinkle" />
                <Spark size={10} color="#B49FD0" cls="twinkle2" />
                <Spark size={13} color="#C4A8E0" cls="twinkle3" />
              </div>
            </div>
          </GL>
        </section>

        <section className="su7">
          <GL radius={26}>
            <div className="p-5">
              <div className="flex justify-between items-center mb-3.5">
                <div className="flex items-center gap-2.5">
                  <IconBadge size={32} radius={10}>
                    <BookOpen size={16} strokeWidth={1.85} />
                  </IconBadge>
                  <h3
                    className="text-[17px] font-medium italic text-[#261B40]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    my journal
                  </h3>
                </div>
                <span
                  className={`text-[11px] inline-flex items-center gap-1 ${saved ? "text-[#7654A8] font-semibold" : "text-[#9685B0]"}`}
                >
                  {saved ? (
                    <>
                      <span>saved</span>
                      <HeartMark filled size={11} />
                    </>
                  ) : (
                    "auto save"
                  )}
                </span>
              </div>
              <textarea
                value={journal}
                onChange={(e) => handleJournal(e.target.value)}
                placeholder={"write your thoughts here...\n\nthis space is just for you"}
                className="w-full min-h-[150px] px-4 py-4 rounded-[18px] border border-[#DDD3F0] bg-white/55 text-[#261B40] text-[13px] resize-y leading-relaxed"
                style={{ display: "block", boxSizing: "border-box" }}
              />
            </div>
          </GL>
        </section>

        <section className="su8 grid grid-cols-2 gap-3">
          <GL radius={26}>
            <div className="p-6 flex flex-col items-center text-center">
              <IconBadge size={44} radius={15} className="breathe">
                <Flower2 size={20} strokeWidth={1.8} />
              </IconBadge>
              <p
                className="mt-3 text-[13px] font-medium italic text-[#261B40] leading-snug"
                style={{ fontFamily: "var(--font-display)" }}
              >
                go at your own pace
              </p>
              <p className="mt-1 text-[10px] text-[#9685B0]">no rush, no pressure</p>
            </div>
          </GL>
          <GL radius={26}>
            <div className="p-6 flex flex-col items-center text-center">
              <IconBadge size={44} radius={15} className="breathe2">
                <MoonStar size={20} strokeWidth={1.8} />
              </IconBadge>
              <p
                className="mt-3 text-[13px] font-medium italic text-[#261B40] leading-snug"
                style={{ fontFamily: "var(--font-display)" }}
              >
                rest is part of the process
              </p>
              <p className="mt-1 text-[10px] text-[#9685B0]">be gentle with yourself</p>
            </div>
          </GL>
        </section>

        <footer className="text-center text-[11px] text-[#B49FD0] py-1 flex items-center justify-center gap-1.5">
          <span>made with</span>
          <HeartMark filled size={12} />
          <span>just for you</span>
        </footer>
      </main>

      {overlayPage && (
        <div className="fixed inset-0 z-[400] overlay-bg" style={{ background: "var(--bg-page)" }}>
          <div className="page-enter h-full">
            <Suspense fallback={<PageFallback />}>
              {overlayPage === "notes" && (
                <NotesPage
                  onBack={() => {
                    setOverlayPage(null);
                    setActiveTab("home");
                  }}
                />
              )}
              {overlayPage === "audio" && (
                <AudioNotesPage
                  onBack={() => {
                    setOverlayPage(null);
                    setActiveTab("home");
                  }}
                />
              )}
              {overlayPage === "productivity" && (
                <ProductivityPage
                  onBack={() => {
                    setOverlayPage(null);
                    setActiveTab("home");
                  }}
                />
              )}
              {overlayPage === "star" && (
                <StarPage
                  onBack={() => {
                    setOverlayPage(null);
                    setActiveTab("home");
                  }}
                />
              )}
            </Suspense>
          </div>
        </div>
      )}

      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center pt-2.5 pb-[18px]"
        style={{
          background: "var(--bg-elevated)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderTop: "1px solid var(--border-card)",
          boxShadow: "var(--shadow-elevated)",
        }}
      >
        {NAV_ITEMS.map(({ id, label, Icon, overlay }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              aria-label={label}
              onClick={() => {
                setActiveTab(id);
                setOverlayPage(overlay);
              }}
              className="nav-button bg-transparent border-none cursor-pointer flex flex-col items-center"
              style={{
                opacity: active ? 1 : 0.48,
                transform: active ? "translate3d(0,-2px,0)" : "none",
                padding: "4px 14px",
                color: active ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              <span
                className="nav-icon inline-flex items-center justify-center rounded-2xl transition-all"
                style={{
                  width: 38,
                  height: 32,
                  background: active ? "var(--accent-soft)" : "transparent",
                  transform: active ? "scale(1.05)" : "scale(1)",
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              </span>
              {active && <span className="nav-indicator" aria-hidden />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
