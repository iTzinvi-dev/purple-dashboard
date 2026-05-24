import { useState, useEffect, useRef } from "react";

type Mode = "focus" | "shortBreak" | "longBreak";

interface Settings {
  focus: number;
  shortBreak: number;
  longBreak: number;
  cyclesBeforeLong: number;
}

const DEFAULTS: Settings = {
  focus: 25,
  shortBreak: 5,
  longBreak: 15,
  cyclesBeforeLong: 4,
};

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { void 0; } },
};

const loadSettings = (): Settings => {
  try {
    const raw = ls.get("pomodoro_settings_v1");
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
};

const loadCount = (): { date: string; completed: number } => {
  try {
    const raw = ls.get("pomodoro_count_v1");
    if (!raw) return { date: new Date().toDateString(), completed: 0 };
    const parsed = JSON.parse(raw);
    if (parsed.date !== new Date().toDateString()) {
      return { date: new Date().toDateString(), completed: 0 };
    }
    return parsed;
  } catch {
    return { date: new Date().toDateString(), completed: 0 };
  }
};

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

const playChime = () => {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const tones = [523.25, 659.25, 783.99];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.15 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.15 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.55);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    void 0;
  }
};

export default function ProductivityPage() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [mode, setMode] = useState<Mode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(() => loadSettings().focus * 60);
  const [running, setRunning] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [todayCount, setTodayCount] = useState(() => loadCount().completed);
  const [showSettings, setShowSettings] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalForMode = (m: Mode, s: Settings) =>
    (m === "focus" ? s.focus : m === "shortBreak" ? s.shortBreak : s.longBreak) * 60;

  // Reset timer when mode or settings change while not running
  useEffect(() => {
    if (!running) {
      setSecondsLeft(totalForMode(mode, settings));
    }
  }, [mode, settings, running]);

  // Tick
  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const handleComplete = () => {
    playChime();
    setRunning(false);

    if (mode === "focus") {
      const newCycle = cycle + 1;
      setCycle(newCycle);

      const newCount = todayCount + 1;
      setTodayCount(newCount);
      ls.set("pomodoro_count_v1", JSON.stringify({
        date: new Date().toDateString(),
        completed: newCount,
      }));

      const nextMode: Mode = newCycle % settings.cyclesBeforeLong === 0 ? "longBreak" : "shortBreak";
      setMode(nextMode);
      setSecondsLeft(totalForMode(nextMode, settings));
    } else {
      setMode("focus");
      setSecondsLeft(totalForMode("focus", settings));
    }
  };

  const toggle = () => setRunning(r => !r);

  const reset = () => {
    setRunning(false);
    setSecondsLeft(totalForMode(mode, settings));
  };

  const switchMode = (m: Mode) => {
    setRunning(false);
    setMode(m);
    setSecondsLeft(totalForMode(m, settings));
  };

  const saveSettings = (s: Settings) => {
    setSettings(s);
    ls.set("pomodoro_settings_v1", JSON.stringify(s));
    setShowSettings(false);
  };

  const total = totalForMode(mode, settings);
  const pct = total > 0 ? ((total - secondsLeft) / total) * 100 : 0;

  const modeLabel = mode === "focus" ? "focus time" : mode === "shortBreak" ? "short break" : "long break";
  const modeEmoji = mode === "focus" ? "🌷" : mode === "shortBreak" ? "🍵" : "🌙";

  // SVG ring math
  const ringSize = 240;
  const ringStroke = 10;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (pct / 100) * ringCirc;

  return (
    <div className="px-3.5 pt-5 pb-2 flex flex-col gap-4">
      {/* Header */}
      <div className="su0 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <span className="text-[34px] breathe">⏳</span>
          <div>
            <p className="text-xs text-[#9685B0] font-medium">productivity</p>
            <h1 className="text-[26px] font-medium italic leading-tight text-[#5A3E8A]"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-.4px" }}>
              focus & flow 💜
            </h1>
          </div>
        </div>
        <button onClick={() => setShowSettings(true)}
          className="w-10 h-10 flex items-center justify-center text-base icon-button nav-button flex-shrink-0"
          style={{ borderRadius: "50%", background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.88)", boxShadow: "0 2px 14px rgba(120,80,190,.1)" }}>
          ⚙️
        </button>
      </div>

      {/* Mode switcher */}
      <div className="su1 glass-card" style={{ borderRadius: 22 }}>
        <div className="p-2 flex gap-1">
          {([
            { id: "focus", label: "focus" },
            { id: "shortBreak", label: "short" },
            { id: "longBreak", label: "long" },
          ] as const).map(({ id, label }) => (
            <button key={id} onClick={() => switchMode(id)}
              className="flex-1 py-2 rounded-2xl text-[12px] font-semibold transition-all"
              style={{
                background: mode === id ? "linear-gradient(135deg, #7654A8, #A870D8)" : "transparent",
                color: mode === id ? "white" : "#9685B0",
                border: "none",
                cursor: "pointer",
                boxShadow: mode === id ? "0 4px 14px rgba(120,80,190,.28)" : "none",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Timer ring */}
      <div className="su2 glass-card" style={{ borderRadius: 28 }}>
        <div className="p-6 flex flex-col items-center justify-center text-center">
          <p className="text-[11px] uppercase tracking-[2px] text-[#9685B0] mb-1">
            {modeLabel}
          </p>
          <span className="text-[20px] mb-2 float">{modeEmoji}</span>

          <div className="relative" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
              <circle
                cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
                fill="none" stroke="#DDD3F0" strokeWidth={ringStroke} />
              <circle
                cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
                fill="none"
                stroke="url(#purpleGrad)"
                strokeWidth={ringStroke}
                strokeLinecap="round"
                strokeDasharray={ringCirc}
                strokeDashoffset={ringOffset}
                style={{ transition: "stroke-dashoffset 1s linear" }} />
              <defs>
                <linearGradient id="purpleGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7654A8" />
                  <stop offset="100%" stopColor="#B07ADE" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[52px] font-semibold text-[#5A3E8A] leading-none tabular-nums tracking-[-2px]"
                style={{ fontFamily: "var(--font-display)" }}>
                {fmt(secondsLeft)}
              </p>
              <p className="text-[11px] text-[#9685B0] mt-2">
                {running ? "stay with it" : "ready when you are"}
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={reset}
              className="px-5 py-3 rounded-2xl text-sm font-semibold icon-button"
              style={{
                background: "rgba(255,255,255,.6)",
                border: "1px solid #DDD3F0",
                color: "#9685B0",
                cursor: "pointer",
              }}>
              reset
            </button>
            <button onClick={toggle}
              className="px-8 py-3 rounded-2xl text-sm font-semibold btn-purple shimmer-press">
              {running ? "pause" : "start"}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="su3 grid grid-cols-2 gap-3">
        <div className="glass-card" style={{ borderRadius: 22 }}>
          <div className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-[1.5px] text-[#9685B0] mb-1">today</p>
            <p className="text-[28px] font-semibold text-[#5A3E8A] leading-none"
              style={{ fontFamily: "var(--font-display)" }}>
              {todayCount}
            </p>
            <p className="text-[10px] text-[#B49FD0] mt-1">
              {todayCount === 1 ? "session done 💜" : "sessions done 💜"}
            </p>
          </div>
        </div>
        <div className="glass-card" style={{ borderRadius: 22 }}>
          <div className="p-4 text-center">
            <p className="text-[10px] uppercase tracking-[1.5px] text-[#9685B0] mb-1">cycle</p>
            <p className="text-[28px] font-semibold text-[#5A3E8A] leading-none"
              style={{ fontFamily: "var(--font-display)" }}>
              {(cycle % settings.cyclesBeforeLong) + (mode === "focus" ? 1 : 0)}/{settings.cyclesBeforeLong}
            </p>
            <p className="text-[10px] text-[#B49FD0] mt-1">until long break</p>
          </div>
        </div>
      </div>

      {/* Soft motivation */}
      <div className="su4 glass-card" style={{ borderRadius: 22 }}>
        <div className="px-5 py-4 text-center">
          <p className="text-[13px] italic text-[#261B40]"
            style={{ fontFamily: "var(--font-display)" }}>
            small progress, <span className="text-[#7654A8] font-semibold">big change</span>
          </p>
        </div>
      </div>

      <p className="text-center text-[11px] text-[#B49FD0] py-2">breathe in calm, breathe out doubt</p>

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function SettingsModal({
  settings,
  onSave,
  onClose,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Settings>(settings);

  const update = (k: keyof Settings, v: number) => {
    setDraft(d => ({ ...d, [k]: Math.max(1, Math.min(120, v)) }));
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-5"
      style={{ background: "rgba(35,18,65,.52)", backdropFilter: "blur(14px)" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass-card w-full max-w-sm" style={{ borderRadius: 28 }}>
        <div className="p-6">
          <h3 className="text-xl font-medium italic text-[#5A3E8A] mb-5"
            style={{ fontFamily: "var(--font-display)" }}>timer settings</h3>

          {([
            { key: "focus", label: "focus duration", suffix: "min" },
            { key: "shortBreak", label: "short break", suffix: "min" },
            { key: "longBreak", label: "long break", suffix: "min" },
            { key: "cyclesBeforeLong", label: "cycles before long break", suffix: "" },
          ] as const).map(({ key, label, suffix }) => (
            <div key={key} className="mb-4 p-3 rounded-2xl border border-[#DDD3F0] bg-white/70">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9685B0] mb-2">{label}</p>
              <div className="flex items-center gap-3">
                <button onClick={() => update(key, draft[key] - 1)}
                  className="w-8 h-8 rounded-full text-base icon-button"
                  style={{ background: "rgba(255,255,255,.7)", border: "1px solid #DDD3F0", cursor: "pointer" }}>
                  −
                </button>
                <p className="flex-1 text-center text-[20px] font-semibold text-[#5A3E8A] tabular-nums"
                  style={{ fontFamily: "var(--font-display)" }}>
                  {draft[key]}{suffix && <span className="text-[12px] text-[#9685B0] ml-1">{suffix}</span>}
                </p>
                <button onClick={() => update(key, draft[key] + 1)}
                  className="w-8 h-8 rounded-full text-base icon-button"
                  style={{ background: "rgba(255,255,255,.7)", border: "1px solid #DDD3F0", cursor: "pointer" }}>
                  +
                </button>
              </div>
            </div>
          ))}

          <div className="flex gap-2 mt-2">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-sm icon-button"
              style={{ border: "1px solid #DDD3F0", color: "#9685B0", background: "transparent", cursor: "pointer" }}>
              cancel
            </button>
            <button onClick={() => onSave(draft)}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold btn-purple shimmer-press">
              save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
