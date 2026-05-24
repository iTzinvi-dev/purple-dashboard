import { useState, useEffect, useRef } from "react";

interface AudioNote {
  id: string;
  title: string;
  dataUrl: string;
  duration: number;
  createdAt: number;
}

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { void 0; } },
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

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export default function AudioNotesPage() {
  const [notes, setNotes] = useState<AudioNote[]>(() => loadNotes());
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const save = (updated: AudioNote[]) => {
    setNotes(updated);
    ls.set("audio_notes_v1", JSON.stringify(updated));
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("microphone not supported on this device");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      recorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const dataUrl = await blobToDataUrl(blob);
        const dur = (Date.now() - startTimeRef.current) / 1000;
        const note: AudioNote = {
          id: Date.now().toString(),
          title: `note ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
          dataUrl,
          duration: dur,
          createdAt: Date.now(),
        };
        save([note, ...loadNotes()]);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
      };

      mr.start();
      startTimeRef.current = Date.now();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((Date.now() - startTimeRef.current) / 1000);
      }, 200);
    } catch (e) {
      setError("microphone access denied — allow it in browser settings");
      console.error(e);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    setElapsed(0);
  };

  const togglePlay = (note: AudioNote) => {
    if (playingId === note.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(note.dataUrl);
    audioRef.current = audio;
    audio.ontimeupdate = () => setProgress(audio.currentTime);
    audio.onloadedmetadata = () => {
      const d = isFinite(audio.duration) ? audio.duration : note.duration;
      setDuration(d);
    };
    audio.onended = () => {
      setPlayingId(null);
      setProgress(0);
    };
    audio.onpause = () => {
      if (audio.currentTime >= audio.duration) setPlayingId(null);
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
    save(notes.filter(n => n.id !== id));
  };

  const renameNote = (id: string, title: string) => {
    save(notes.map(n => n.id === id ? { ...n, title } : n));
  };

  return (
    <div className="px-3.5 pt-5 pb-2 flex flex-col gap-4">
      {/* Header */}
      <div className="su0 flex items-center gap-3 px-1">
        <span className="text-[34px] breathe">🎙️</span>
        <div>
          <p className="text-xs text-[#9685B0] font-medium">audio notes</p>
          <h1 className="text-[26px] font-medium italic leading-tight text-[#5A3E8A]"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-.4px" }}>
            speak your mind 💜
          </h1>
        </div>
      </div>

      {/* Recorder card */}
      <div className="su1 glass-card" style={{ borderRadius: 26 }}>
        <div className="p-6 flex flex-col items-center justify-center text-center">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center text-[40px] mb-4 ${recording ? "breathe" : "float"}`}
            style={{
              background: recording
                ? "radial-gradient(circle at 30% 30%, #FF8FAB, #C4548A)"
                : "linear-gradient(135deg, #7654A8, #B07ADE)",
              boxShadow: recording
                ? "0 0 0 8px rgba(255,143,171,.18), 0 8px 26px rgba(196,84,138,.45)"
                : "0 8px 24px rgba(120,80,190,.36)",
              transition: "all .3s ease",
            }}>
            {recording ? "⏺️" : "🎤"}
          </div>

          <p className="text-[13px] text-[#9685B0] mb-1">
            {recording ? "recording..." : "tap to record"}
          </p>
          <p className="text-[20px] font-semibold text-[#5A3E8A] mb-4 tabular-nums"
            style={{ fontFamily: "var(--font-display)" }}>
            {fmt(elapsed)}
          </p>

          {!recording ? (
            <button onClick={startRecording}
              className="px-7 py-3 rounded-2xl text-sm font-semibold btn-purple shimmer-press">
              start recording
            </button>
          ) : (
            <button onClick={stopRecording}
              className="px-7 py-3 rounded-2xl text-sm font-semibold shimmer-press"
              style={{
                background: "linear-gradient(135deg, #C4548A, #8A3A6E)",
                color: "white",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 6px 20px rgba(138,58,110,.36)",
              }}>
              stop & save
            </button>
          )}

          {error && (
            <p className="mt-3 text-[11px] text-[#C4548A]">{error}</p>
          )}
        </div>
      </div>

      {/* Notes list */}
      <div className="su2">
        <div className="flex justify-between items-center px-2 mb-2">
          <h3 className="text-base font-medium italic text-[#5A3E8A]"
            style={{ fontFamily: "var(--font-display)" }}>
            your recordings
          </h3>
          <span className="text-[11px] text-[#9685B0]">
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </span>
        </div>

        {notes.length === 0 ? (
          <div className="glass-card" style={{ borderRadius: 26 }}>
            <div className="p-8 text-center">
              <span className="text-[36px] block mb-3 float">🌙</span>
              <p className="text-[13px] text-[#9685B0]">no audio notes yet</p>
              <p className="text-[11px] text-[#B49FD0] mt-1">your voice memos will appear here</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {notes.map(note => {
              const isPlaying = playingId === note.id;
              const pct = isPlaying && duration > 0 ? (progress / duration) * 100 : 0;
              return (
                <div key={note.id} className="glass-card" style={{ borderRadius: 22 }}>
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <button onClick={() => togglePlay(note)}
                        className="w-11 h-11 rounded-full flex items-center justify-center text-base flex-shrink-0 btn-purple icon-button shimmer-press">
                        {isPlaying ? "⏸" : "▶"}
                      </button>

                      <div className="flex-1 min-w-0">
                        {editingId === note.id ? (
                          <input autoFocus
                            value={note.title}
                            onChange={e => renameNote(note.id, e.target.value)}
                            onBlur={() => setEditingId(null)}
                            onKeyDown={e => e.key === "Enter" && setEditingId(null)}
                            className="w-full bg-transparent border-b border-[#C4A8E0] text-[13px] font-semibold text-[#5A3E8A] outline-none pb-0.5"
                          />
                        ) : (
                          <p onClick={() => setEditingId(note.id)}
                            className="text-[13px] font-semibold text-[#261B40] truncate cursor-pointer">
                            {note.title}
                          </p>
                        )}
                        <p className="text-[10px] text-[#9685B0] mt-0.5">
                          {fmt(note.duration)} · {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                      </div>

                      <button onClick={() => deleteNote(note.id)}
                        className="bg-transparent border-none cursor-pointer text-sm text-[#C4A8E0] px-2 icon-button">
                        ✕
                      </button>
                    </div>

                    {isPlaying && (
                      <div className="mt-3 h-[3px] bg-[#DDD3F0] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-[width] duration-200"
                          style={{
                            width: `${pct}%`,
                            background: "linear-gradient(90deg, #7654A8, #B07ADE)",
                          }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Future hint */}
      <p className="text-center text-[11px] text-[#B49FD0] py-2">made with 💜 your voice, your space</p>
    </div>
  );
}
