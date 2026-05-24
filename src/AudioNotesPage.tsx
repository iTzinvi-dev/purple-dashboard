import { useState, useEffect, useRef } from "react";

interface AudioNote {
  id: string;
  title: string;
  dataUrl: string;
  duration: number;
  size: number;
  createdAt: number;
}

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};

const loadNotes = (): AudioNote[] => {
  try {
    const raw = ls.get("audio_notes_v1");
    if (!raw) return [];
    return JSON.parse(raw) as AudioNote[];
  } catch {
    return [];
  }
};

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

const fmtSize = (b: number) => {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const probeDuration = (url: string): Promise<number> =>
  new Promise(resolve => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => resolve(0);
    a.src = url;
  });

export default function AudioNotesPage({ onBack }: { onBack?: () => void } = {}) {
  const [notes, setNotes] = useState<AudioNote[]>(() => loadNotes());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const save = (updated: AudioNote[]) => {
    setNotes(updated);
    const ok = ls.set("audio_notes_v1", JSON.stringify(updated));
    if (!ok) setError("storage full — try smaller files or delete old ones");
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (e.target) e.target.value = "";
    if (!files.length) return;

    setError(null);
    setUploading(true);

    try {
      const newOnes: AudioNote[] = [];
      for (const file of files) {
        if (!file.type.startsWith("audio/")) continue;
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
      }
      if (newOnes.length) {
        save([...newOnes, ...loadNotes()]);
      }
    } catch (err) {
      setError("could not load file — please try again");
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const togglePlay = (note: AudioNote) => {
    if (playingId === note.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();

    const audio = new Audio(note.dataUrl);
    audioRef.current = audio;
    audio.ontimeupdate = () => setProgress(audio.currentTime);
    audio.onloadedmetadata = () => {
      setDuration(isFinite(audio.duration) ? audio.duration : note.duration);
    };
    audio.onended = () => { setPlayingId(null); setProgress(0); };
    setProgress(0);
    setDuration(note.duration);
    setPlayingId(note.id);
    audio.play().catch(() => setPlayingId(null));
  };

  const deleteNote = (id: string) => {
    if (playingId === id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
    save(notes.filter(n => n.id !== id));
  };

  const renameNote = (id: string, title: string) => {
    save(notes.map(n => n.id === id ? { ...n, title } : n));
  };

  return (
    <div className="audio-notes-page" style={{ minHeight: "100vh", height: "100%", background: "linear-gradient(150deg, #EDE5FA 0%, #E0D4F5 45%, #D9CCF2 100%)", fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column", paddingBottom: 96 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 10px", background: "rgba(237,229,250,.9)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,.7)" }}>
        {onBack && (
          <button onClick={onBack}
            style={{ background: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.9)", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, flexShrink: 0 }}>←</button>
        )}
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11, color: "#9685B0", fontWeight: 500 }}>audio notes</p>
          <h1 style={{ margin: 0, fontSize: 22, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", color: "#5A3E8A", lineHeight: 1.1 }}>your library 💜</h1>
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          style={{ background: "linear-gradient(135deg, #7654A8, #A870D8)", border: "none", borderRadius: 14, padding: "8px 16px", color: "white", cursor: uploading ? "wait" : "pointer", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 14px rgba(120,80,190,.3)", opacity: uploading ? 0.6 : 1 }}>
          {uploading ? "…" : "+ upload"}
        </button>
        <input ref={fileRef} type="file" accept="audio/*" multiple hidden onChange={handleUpload} />
      </div>

      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Big upload card if empty */}
        {notes.length === 0 && (
          <div className="glass-card" style={{ borderRadius: 24 }}>
            <div style={{ padding: "36px 20px", textAlign: "center" }}>
              <span style={{ fontSize: 44, display: "block", marginBottom: 10 }} className="float">🎧</span>
              <p style={{ margin: 0, fontSize: 14, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", color: "#5A3E8A" }}>upload audio from your phone</p>
              <p style={{ margin: "4px 0 16px", fontSize: 11, color: "#9685B0" }}>any audio file — songs, voice memos, etc.</p>
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                style={{ background: "linear-gradient(135deg, #7654A8, #A870D8)", border: "none", borderRadius: 18, padding: "12px 24px", color: "white", cursor: uploading ? "wait" : "pointer", fontSize: 14, fontWeight: 600, boxShadow: "0 6px 18px rgba(120,80,190,.32)" }}>
                {uploading ? "loading…" : "choose files"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 14, background: "rgba(196,84,138,.1)", border: "1px solid rgba(196,84,138,.25)", color: "#8A3A6E", fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* List */}
        {notes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
              <p style={{ margin: 0, fontSize: 14, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", color: "#5A3E8A", fontWeight: 500 }}>
                your audio
              </p>
              <span style={{ fontSize: 11, color: "#9685B0" }}>
                {notes.length} {notes.length === 1 ? "track" : "tracks"}
              </span>
            </div>

            {notes.map(note => {
              const isPlaying = playingId === note.id;
              const pct = isPlaying && duration > 0 ? (progress / duration) * 100 : 0;
              return (
                <div key={note.id} className="glass-card" style={{ borderRadius: 20 }}>
                  <div style={{ padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button onClick={() => togglePlay(note)}
                        className="btn-purple icon-button shimmer-press"
                        style={{ width: 42, height: 42, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0, border: "none", cursor: "pointer", color: "white" }}>
                        {isPlaying ? "⏸" : "▶"}
                      </button>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {editingId === note.id ? (
                          <input autoFocus value={note.title}
                            onChange={e => renameNote(note.id, e.target.value)}
                            onBlur={() => setEditingId(null)}
                            onKeyDown={e => e.key === "Enter" && setEditingId(null)}
                            style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1px solid #C4A8E0", fontSize: 13, fontWeight: 600, color: "#5A3E8A", outline: "none", paddingBottom: 2 }}
                          />
                        ) : (
                          <p onClick={() => setEditingId(note.id)}
                            style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#261B40", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}>
                            {note.title}
                          </p>
                        )}
                        <p style={{ margin: "2px 0 0", fontSize: 10, color: "#9685B0" }}>
                          {fmt(note.duration)} · {fmtSize(note.size)} · {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>

                      <button onClick={() => deleteNote(note.id)}
                        style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, color: "#C4A8E0", padding: "4px 6px" }}>✕</button>
                    </div>

                    {isPlaying && (
                      <div style={{ marginTop: 10, height: 3, background: "#DDD3F0", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #7654A8, #B07ADE)", transition: "width .15s linear" }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
