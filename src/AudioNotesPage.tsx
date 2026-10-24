import { useState, useEffect, useRef } from "react";
import {
  type AudioNote,
  AUDIO_MAX_BYTES,
  loadAudioLibrary,
  saveAudioLibrary,
  subscribeToAudioLibrary,
  importAudioFiles,
} from "./audioLibrary";
import {
  ArrowLeft,
  CheckCircle2,
  Headphones,
  HeartMark,
  IconBadge,
  Pause,
  Play,
  ShieldAlert,
  Upload,
  X,
} from "./icons";

const fmtDuration = (s: number) => {
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

export default function AudioNotesPage({ onBack }: { onBack?: () => void } = {}) {
  const [notes, setNotes] = useState<AudioNote[]>(() => loadAudioLibrary());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const persist = (updated: AudioNote[]) => {
    setNotes(updated);
    const ok = saveAudioLibrary(updated);
    if (!ok) setError("storage full — try deleting older audio notes");
  };

  useEffect(() => {
    return subscribeToAudioLibrary(() => setNotes(loadAudioLibrary()));
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const flashError = (msg: string) => {
    setError(msg);
    setInfo(null);
    window.setTimeout(() => setError(null), 5000);
  };

  const flashInfo = (msg: string) => {
    setInfo(msg);
    window.setTimeout(() => setInfo(null), 4000);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (e.target) e.target.value = "";
    if (!files.length) return;

    setError(null);
    setUploading(true);

    try {
      const result = await importAudioFiles(files);

      if (result.added) {
        flashInfo(`added ${result.added} audio note${result.added === 1 ? "" : "s"}`);
      }
      if (result.storageFull) {
        flashError("storage full — try deleting older audio notes");
      }
      if (result.skipped.length) {
        flashError(`skipped: ${result.skipped.join(", ")}`);
      }
    } catch (err) {
      flashError("could not load files — please try again");
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
    audio.onended = () => {
      setPlayingId(null);
      setProgress(0);
    };
    audio.onerror = () => {
      flashError("could not play this file — it may be corrupted");
      setPlayingId(null);
    };
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
    persist(notes.filter((n) => n.id !== id));
  };

  const renameNote = (id: string, title: string) => {
    persist(notes.map((n) => (n.id === id ? { ...n, title } : n)));
  };

  return (
    <div
      className="page-surface"
      style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        paddingBottom: 96,
      }}
    >
      <header
        className="page-header"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 16px 10px",
          backdropFilter: "blur(14px)",
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            aria-label="back"
            style={{
              background: "var(--bg-card-soft)",
              border: "1px solid var(--border-card)",
              borderRadius: "50%",
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "var(--text-secondary)",
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </button>
        )}
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
            audio notes
          </p>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: "italic",
              color: "var(--text-secondary)",
              lineHeight: 1.1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>your library</span>
            <HeartMark filled size={14} />
          </h1>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5"
          style={{
            background: "linear-gradient(135deg, #7654A8, #A870D8)",
            border: "none",
            borderRadius: 14,
            padding: "8px 16px",
            color: "white",
            cursor: uploading ? "wait" : "pointer",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 4px 14px rgba(120,80,190,.3)",
            opacity: uploading ? 0.6 : 1,
          }}
        >
          <Upload size={14} strokeWidth={2.2} />
          <span>{uploading ? "loading" : "upload"}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          multiple
          hidden
          onChange={handleUpload}
        />
      </header>

      <main style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        {notes.length === 0 && (
          <section className="glass-card" style={{ borderRadius: 24 }}>
            <div
              style={{
                padding: "36px 20px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <IconBadge size={58} radius={20} className="float mb-3">
                <Headphones size={26} strokeWidth={1.8} />
              </IconBadge>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic",
                  color: "var(--text-secondary)",
                }}
              >
                upload audio from your device
              </p>
              <p style={{ margin: "4px 0 16px", fontSize: 11, color: "var(--text-muted)" }}>
                any audio file — songs, voice memos. up to {fmtSize(AUDIO_MAX_BYTES)} each
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #7654A8, #A870D8)",
                  border: "none",
                  borderRadius: 18,
                  padding: "12px 24px",
                  color: "white",
                  cursor: uploading ? "wait" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: "0 6px 18px rgba(120,80,190,.32)",
                }}
              >
                <Upload size={16} strokeWidth={2} />
                <span>{uploading ? "loading…" : "choose files"}</span>
              </button>
            </div>
          </section>
        )}

        {info && (
          <aside
            className="status-line flex items-center justify-center gap-1.5"
            style={{ textAlign: "center" }}
          >
            <CheckCircle2 size={13} strokeWidth={2} />
            <span>{info}</span>
          </aside>
        )}
        {error && (
          <aside
            className="status-line error flex items-center gap-1.5"
            style={{ textAlign: "left", lineHeight: 1.5 }}
          >
            <ShieldAlert size={14} strokeWidth={2} />
            <span>{error}</span>
          </aside>
        )}

        {notes.length > 0 && (
          <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 4px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic",
                  color: "var(--text-secondary)",
                  fontWeight: 500,
                }}
              >
                your audio
              </p>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {notes.length} {notes.length === 1 ? "track" : "tracks"}
              </span>
            </div>

            <div className="list-stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {notes.map((note) => {
                const isPlaying = playingId === note.id;
                const pct = isPlaying && duration > 0 ? (progress / duration) * 100 : 0;
                return (
                  <article key={note.id} className="glass-card" style={{ borderRadius: 20 }}>
                    <div style={{ padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                          onClick={() => togglePlay(note)}
                          className="btn-purple icon-button shimmer-press"
                          aria-label={isPlaying ? "pause" : "play"}
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            border: "none",
                            cursor: "pointer",
                            color: "white",
                          }}
                        >
                          {isPlaying ? (
                            <Pause size={16} strokeWidth={2.2} fill="currentColor" />
                          ) : (
                            <Play size={16} strokeWidth={2.2} fill="currentColor" className="ml-0.5" />
                          )}
                        </button>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          {editingId === note.id ? (
                            <input
                              autoFocus
                              value={note.title}
                              onChange={(e) => renameNote(note.id, e.target.value)}
                              onBlur={() => setEditingId(null)}
                              onKeyDown={(e) => e.key === "Enter" && setEditingId(null)}
                              style={{
                                width: "100%",
                                background: "transparent",
                                border: "none",
                                borderBottom: "1px solid var(--accent-2)",
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--text-secondary)",
                                outline: "none",
                                paddingBottom: 2,
                              }}
                            />
                          ) : (
                            <p
                              onClick={() => setEditingId(note.id)}
                              title="click to rename"
                              style={{
                                margin: 0,
                                fontSize: 13,
                                fontWeight: 600,
                                color: "var(--text-primary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                cursor: "pointer",
                              }}
                            >
                              {note.title}
                            </p>
                          )}
                          <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--text-muted)" }}>
                            {fmtDuration(note.duration)} · {fmtSize(note.size)} ·{" "}
                            {new Date(note.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>

                        <button
                          onClick={() => deleteNote(note.id)}
                          aria-label="delete"
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text-faint)",
                            padding: "4px 6px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <X size={15} strokeWidth={2} />
                        </button>
                      </div>

                      {isPlaying && (
                        <div
                          style={{
                            marginTop: 10,
                            height: 3,
                            background: "var(--border-soft)",
                            borderRadius: 999,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: "linear-gradient(90deg, #7654A8, #B07ADE)",
                              transition: "width .15s linear",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
