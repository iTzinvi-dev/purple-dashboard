import { useMemo } from "react";

interface Note {
  id: string;
  title: string;
  text: string;
  drawing: string;
  createdAt: number;
  updatedAt: number;
}

interface AudioNote {
  id: string;
  title: string;
  duration: number;
  size: number;
  createdAt: number;
}

interface PomCount {
  date: string;
  completed: number;
}

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
};

const safeParse = <T,>(key: string, fallback: T): T => {
  try {
    const raw = ls.get(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const fmtBytes = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const fmtDuration = (s: number) => {
  if (!isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

interface Todo { id: number; text: string; done: boolean; }

export default function StarPage({ onBack }: { onBack?: () => void } = {}) {
  // Read everything once on mount — fast, no subscriptions.
  const stats = useMemo(() => {
    const notes = safeParse<Note[]>("notes_v2", []);
    const audio = safeParse<AudioNote[]>("audio_notes_v1", []);
    const todos = safeParse<Todo[]>("todos", []);
    const moods = safeParse<string[]>("moods", []);
    const journal = ls.get("journal") || "";
    const pomCount = safeParse<PomCount>("pomodoro_count_v1", { date: "", completed: 0 });
    const today = new Date().toDateString();
    const todayPoms = pomCount.date === today ? pomCount.completed : 0;

    const totalDuration = audio.reduce((acc, a) => acc + (a.duration || 0), 0);
    const totalAudioSize = audio.reduce((acc, a) => acc + (a.size || 0), 0);
    const todosDone = todos.filter(t => t.done).length;
    const journalWords = journal.trim() ? journal.trim().split(/\s+/).length : 0;

    return {
      notesCount: notes.length,
      audioCount: audio.length,
      totalDuration,
      totalAudioSize,
      todosDone,
      todosTotal: todos.length,
      moodsCount: moods.length,
      journalWords,
      todayPoms,
    };
  }, []);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="page-surface" style={{ paddingBottom: 96 }}>
      {/* Header */}
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 12px" }}>
        {onBack && (
          <button onClick={onBack} aria-label="back" className="icon-button"
            style={{ background: "var(--bg-card-soft)", border: "1px solid var(--border-card)", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: "var(--text-secondary)", flexShrink: 0 }}>←</button>
        )}
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>your reflection</p>
          <h1 style={{ margin: 0, fontSize: 22, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", color: "var(--text-secondary)", lineHeight: 1.1 }}>
            ⭐ a tiny constellation
          </h1>
        </div>
      </div>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Hero — date + sparkle row */}
        <div className="su0 glass-card" style={{ borderRadius: 26 }}>
          <div style={{ padding: "20px 18px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 8 }}>
              <span className="twinkle" style={{ fontSize: 14 }}>✨</span>
              <span className="twinkle2" style={{ fontSize: 18 }}>⭐</span>
              <span className="twinkle3" style={{ fontSize: 14 }}>✨</span>
            </div>
            <p className="shimmer-text"
              style={{ margin: 0, fontSize: 24, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontWeight: 600 }}>
              you are doing great
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-muted)" }}>{today}</p>
          </div>
        </div>

        {/* Stat grid */}
        <div className="su1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatCard icon="📝" label="notes" value={String(stats.notesCount)} sub={stats.notesCount === 1 ? "kept" : "kept"} />
          <StatCard icon="🎧" label="audio" value={String(stats.audioCount)} sub={fmtDuration(stats.totalDuration)} />
          <StatCard icon="⏳" label="focus" value={String(stats.todayPoms)} sub="today" />
          <StatCard icon="✅" label="todos" value={`${stats.todosDone}/${stats.todosTotal}`} sub="done" />
        </div>

        {/* Wider rows */}
        <div className="su2 glass-card" style={{ borderRadius: 22 }}>
          <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 28 }} className="float">📔</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.5 }}>journal</p>
              <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic" }}>
                {stats.journalWords} {stats.journalWords === 1 ? "word" : "words"}
              </p>
            </div>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>your space 💜</span>
          </div>
        </div>

        <div className="su3 glass-card" style={{ borderRadius: 22 }}>
          <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 28 }} className="breathe">🌷</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.5 }}>moods felt</p>
              <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic" }}>
                {stats.moodsCount} {stats.moodsCount === 1 ? "feeling" : "feelings"}
              </p>
            </div>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>noticed</span>
          </div>
        </div>

        {stats.audioCount > 0 && (
          <div className="su4 glass-card" style={{ borderRadius: 22 }}>
            <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 28 }} className="breathe2">🎵</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.5 }}>library</p>
                <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic" }}>
                  {fmtBytes(stats.totalAudioSize)}
                </p>
              </div>
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>saved</span>
            </div>
          </div>
        )}

        {/* Quote banner */}
        <div className="su5 glass-card" style={{ borderRadius: 26 }}>
          <div style={{ padding: "24px 20px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 16, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", color: "var(--text-primary)", lineHeight: 1.5 }}>
              every little thing<br />
              <span style={{ color: "var(--accent)", fontWeight: 600 }}>is a star already</span>
            </p>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-faint)", padding: "8px 0" }}>
          made with 💜 for you
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <div className="glass-card" style={{ borderRadius: 20 }}>
      <div style={{ padding: 14, textAlign: "center" }}>
        <span style={{ fontSize: 22, display: "block", marginBottom: 4 }}>{icon}</span>
        <p style={{ margin: 0, fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1.5 }}>{label}</p>
        <p style={{ margin: "4px 0 2px", fontSize: 24, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "'Cormorant Garamond', serif", lineHeight: 1 }}>
          {value}
        </p>
        <p style={{ margin: 0, fontSize: 10, color: "var(--text-faint)" }}>{sub}</p>
      </div>
    </div>
  );
}
