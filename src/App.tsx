import { useState, useEffect, useRef } from "react";
import NotesPage from "./NotesPage";
import PetalCanvas from "./PetalCanvas";

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

const W_ICON: Record<string, string> = {
  Clear: "☀️", Clouds: "☁️", Rain: "🌧️",
  Snow: "❄️", Thunderstorm: "⛈️", Drizzle: "🌦️", Mist: "🌫️",
};

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
};

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const Bow = ({ size = 28, color = "#C4A8E0" }) => (
  <svg width={size} height={size * 0.6} viewBox="0 0 60 36" fill="none">
    <path d="M30 18 C20 8, 2 4, 2 18 C2 28, 20 28, 30 18Z" fill={color} opacity=".9"/>
    <path d="M30 18 C40 8, 58 4, 58 18 C58 28, 40 28, 30 18Z" fill={color} opacity=".9"/>
    <circle cx="30" cy="18" r="4" fill={color}/>
    <path d="M28 20 C26 26, 22 32, 18 34" stroke={color} strokeWidth="2" strokeLinecap="round" opacity=".6"/>
    <path d="M32 20 C34 26, 38 32, 42 34" stroke={color} strokeWidth="2" strokeLinecap="round" opacity=".6"/>
  </svg>
);

const Spark = ({ size = 11, color = "#C4A8E0", cls = "twinkle" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={cls}
    style={{ display: "inline-block", flexShrink: 0 }}>
    <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" fill={color}/>
  </svg>
);

const GL = ({ children, radius = 26, mode: _mode }: { children: React.ReactNode; radius?: number; mode?: string }) => (
  <div className="glass-card" style={{ borderRadius: radius }}>
    {children}
  </div>
);
export default function PurpleDashboard() {
  const [time,         setTime]         = useState(new Date());
  const [name,         setName]         = useState("[name]");
  const [todos,        setTodos]        = useState(DEFAULT_TODOS);
  const [newTodo,      setNewTodo]      = useState("");
  const [moods,        setMoods]        = useState<string[]>([]);
  const [journal,      setJournal]      = useState("");
  const [weather,      setWeather]      = useState<any>(null);
  const [apiKey,       setApiKey]       = useState("");
  const [tempKey,      setTempKey]      = useState("");
  const [tempName,     setTempName]     = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [playlist,     setPlaylist]     = useState<{ name: string; url: string }[]>([]);
  const [curIdx,       setCurIdx]       = useState(0);
  const [playing,      setPlaying]      = useState(false);
  const [duration,     setDuration]     = useState(0);
  const [progress,     setProgress]     = useState(0);
  const [saved,        setSaved]        = useState(false);
  const [activeTab,    setActiveTab]    = useState("home");
  const [showNotes,    setShowNotes]    = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const seekRef  = useRef<HTMLDivElement>(null);
  const jTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const q        = QUOTES[new Date().getDate() % QUOTES.length];

  useEffect(() => {
    const td = ls.get("todos");   if (td) setTodos(JSON.parse(td));
    const md = ls.get("moods");   if (md) setMoods(JSON.parse(md));
    const jd = ls.get("journal"); if (jd) setJournal(jd);
    const nd = ls.get("name");    if (nd) { setName(nd); setTempName(nd); }
    const kd = ls.get("wkey");    if (kd) { setApiKey(kd); setTempKey(kd); }
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    const go = (lat: number, lon: number) =>
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`)
        .then(r => r.json())
        .then(d => { if (d.main) setWeather({ temp: Math.round(d.main.temp), desc: d.weather[0].description, icon: d.weather[0].main }); });
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => go(coords.latitude, coords.longitude),
      () => go(23.8, 90.4),
    );
  }, [apiKey]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !playlist[curIdx]) return;
    const wasPlaying = playing;
    audio.src = playlist[curIdx].url;
    audio.load();
    if (wasPlaying) audio.play().catch(() => {});
  }, [curIdx, playlist]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!playlist.length) { fileRef.current?.click(); return; }
    if (!audio.src || audio.src === window.location.href) {
      audio.src = playlist[curIdx].url;
      audio.load();
    }
    if (playing) { audio.pause(); }
    else { try { await audio.play(); } catch {} }
  };

  const skip = (d: number) => {
    if (!playlist.length) return;
    setCurIdx(i => (i + d + playlist.length) % playlist.length);
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files  = Array.from(e.target.files ?? []);
    const tracks = files.map(f => ({ name: f.name.replace(/\.[^/.]+$/, ""), url: URL.createObjectURL(f) }));
    setPlaylist(p => {
      const upd = [...p, ...tracks];
      if (!p.length) setCurIdx(0);
      return upd;
    });
  };

  const removeSong = (idx: number) => {
    setPlaylist(p => {
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
    if (tempName.trim()) { setName(tempName.trim()); ls.set("name", tempName.trim()); }
    if (tempKey.trim())  { setApiKey(tempKey.trim()); ls.set("wkey", tempKey.trim()); }
    setShowSettings(false);
  };

  const h        = time.getHours();
  const greeting = h < 5 ? "sweet dreams" : h < 12 ? "good morning" : h < 17 ? "good afternoon" : h < 21 ? "good evening" : "good night";
  const timeStr  = time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateStr  = time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <div className="min-h-screen pb-24"
      style={{ background: "linear-gradient(150deg, #EDE5FA 0%, #E0D4F5 45%, #D9CCF2 100%)", fontFamily: "'DM Sans', system-ui, sans-serif", color: "#261B40" }}>

      <PetalCanvas />
      <audio ref={audioRef}
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => skip(1)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <input ref={fileRef} type="file" accept="audio/*" multiple hidden onChange={handleFiles} />

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-5"
          style={{ background: "rgba(35,18,65,.52)", backdropFilter: "blur(14px)" }}
          onClick={e => e.target === e.currentTarget && setShowSettings(false)}>
          <GL radius={28} mode="prominent">
            <div className="p-7 w-full max-w-sm">
              <div className="flex items-center gap-3 mb-6">
                <Bow size={24} color="#C4A8E0" />
                <h3 className="text-xl font-medium italic text-[#5A3E8A]" style={{ fontFamily: "var(--font-display)" }}>settings</h3>
              </div>
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#9685B0] mb-2">display name</label>
              <input value={tempName} onChange={e => setTempName(e.target.value)} placeholder="her name here..."
                className="w-full px-4 py-3 rounded-2xl border border-[#DDD3F0] bg-white/60 text-[#261B40] text-sm mb-5" />
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-[#9685B0] mb-2">weather api key</label>
              <input value={tempKey} onChange={e => setTempKey(e.target.value)} placeholder="openweathermap key..."
                className="w-full px-4 py-3 rounded-2xl border border-[#DDD3F0] bg-white/60 text-[#261B40] text-sm mb-2" />
              <p className="text-[11px] text-[#9685B0] mb-6">free at openweathermap.org ☁️</p>
              <div className="flex gap-2">
                <button onClick={() => setShowSettings(false)}
                  className="flex-1 py-3 rounded-2xl border border-[#DDD3F0] text-[#9685B0] text-sm active:scale-95">cancel</button>
                <button onClick={saveSettings}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold btn-purple">save 💜</button>
              </div>
            </div>
          </GL>
        </div>
      )}

      {/* Playlist Modal */}
      {showPlaylist && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center"
          style={{ background: "rgba(35,18,65,.52)", backdropFilter: "blur(14px)" }}
          onClick={e => e.target === e.currentTarget && setShowPlaylist(false)}>
          <div className="w-full max-w-[430px] p-4 pb-8">
            <GL radius={28} mode="prominent">
              <div className="p-6">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg font-medium italic text-[#5A3E8A]" style={{ fontFamily: "var(--font-display)" }}>🎵 playlist</h3>
                  <button onClick={() => setShowPlaylist(false)} className="text-[#9685B0] text-sm bg-transparent border-none cursor-pointer">close</button>
                </div>
                {playlist.length === 0 ? (
                  <p className="text-[13px] text-[#9685B0] text-center py-4">no songs yet — tap ＋ to add 💜</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
                    {playlist.map((track, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-2xl transition-all"
                        style={{ background: i === curIdx ? "rgba(118,84,168,.15)" : "rgba(255,255,255,.3)" }}>
                        <button onClick={() => { setCurIdx(i); setShowPlaylist(false); }}
                          className="bg-transparent border-none cursor-pointer text-base p-0 leading-none">
                          {i === curIdx ? "💜" : "🤍"}
                        </button>
                        <span className="flex-1 text-[12px] truncate" style={{ color: i === curIdx ? "#7654A8" : "#261B40", fontWeight: i === curIdx ? 600 : 400 }}>
                          {track.name}
                        </span>
                        <button onClick={() => removeSong(i)}
                          className="bg-transparent border-none cursor-pointer text-[13px] text-[#C4A8E0] px-1 active:scale-90">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => fileRef.current?.click()}
                  className="w-full mt-4 py-3 rounded-2xl text-sm font-semibold btn-purple">
                  ＋ add songs
                </button>
              </div>
            </GL>
          </div>
        </div>
      )}
      <div className="max-w-[430px] mx-auto px-3.5 pt-5 pb-2 flex flex-col gap-3">

        {/* Header */}
        <div className="su0 flex justify-between items-start px-1">
          <div>
            <p className="text-xs text-[#9685B0] font-medium flex items-center gap-1.5">
              {greeting} <Spark size={9} color="#B49FD0" cls="twinkle" />
            </p>
            <h1 className="mt-1 text-[30px] font-medium italic leading-tight text-[#5A3E8A]"
              style={{ fontFamily: "var(--font-display)", letterSpacing: "-.4px" }}>{name}</h1>
            <p className="mt-1.5 text-[11px] text-[#B49FD0]">{dateStr}</p>
          </div>
          <button onClick={() => { setTempKey(apiKey); setTempName(name); setShowSettings(true); }}
            className="w-10 h-10 flex items-center justify-center text-lg active:scale-95 flex-shrink-0"
            style={{ borderRadius: "50%", background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.88)", boxShadow: "0 2px 14px rgba(120,80,190,.1)" }}>⚙️</button>
        </div>

        {/* Row 1 — Music + Quote */}
        <div className="su1 grid gap-3" style={{ gridTemplateColumns: "1.45fr 1fr" }}>

          {/* Music */}
          <GL radius={26}>
            <div className="p-[18px]">
              <div className="flex gap-3 items-center mb-4">
                <div className="shimmer-bg w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 breathe">🎵</div>
                <div className="overflow-hidden flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#261B40] truncate">{playlist[curIdx]?.name ?? "city of stars"}</p>
                  <p className="text-[10px] text-[#9685B0] mt-0.5">{playlist.length ? `${playlist.length} track${playlist.length !== 1 ? "s" : ""}` : "dreamy playlist"}</p>
                </div>
                <button onClick={() => setShowPlaylist(true)}
                  className="text-sm text-[#B49FD0] tracking-[3px] bg-transparent border-none cursor-pointer active:scale-90">···</button>
              </div>

              <div ref={seekRef} onClick={seekAudio}
                className="h-[3px] bg-[#DDD3F0] rounded-full mb-1.5 cursor-pointer relative">
                <div className="absolute inset-0 rounded-full transition-[width] duration-500"
                  style={{ width: `${duration ? (progress/duration)*100 : 6}%`, background: "linear-gradient(90deg, #7654A8, #B07ADE)" }}>
                  <div className="absolute -right-[5px] -top-[4px] w-[11px] h-[11px] rounded-full bg-[#7654A8]"
                    style={{ boxShadow: "0 0 0 2.5px white, 0 2px 6px rgba(100,60,160,.35)" }} />
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-[#9685B0] mb-3.5">
                <span>{fmt(progress)}</span><span>{fmt(duration)}</span>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => fileRef.current?.click()}
                  className="bg-transparent border-none cursor-pointer text-[#B49FD0] text-lg p-1 active:scale-90">＋</button>
                <button onClick={() => skip(-1)}
                  className="bg-transparent border-none cursor-pointer text-[#7654A8] text-xl p-1 active:scale-90">⏮</button>
                <button onClick={togglePlay}
                  className="w-11 h-11 rounded-full text-lg flex items-center justify-center flex-shrink-0 btn-purple">
                  {playing ? "⏸" : "▶"}
                </button>
                <button onClick={() => skip(1)}
                  className="bg-transparent border-none cursor-pointer text-[#7654A8] text-xl p-1 active:scale-90">⏭</button>
                <button onClick={() => setShowPlaylist(true)}
                  className="bg-transparent border-none cursor-pointer text-[#B49FD0] text-base p-1 active:scale-90">🎼</button>
              </div>
            </div>
          </GL>

          {/* Quote */}
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
        {/* Row 2 — Clock + Weather */}
        <div className="su2 grid gap-3" style={{ gridTemplateColumns: "1.2fr 1fr" }}>

          <GL radius={26} mode="prominent">
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
                <span className="text-[32px] leading-none float">{W_ICON[weather.icon] ?? "🌤️"}</span>
                <p className="font-semibold text-[#5A3E8A] leading-none tracking-[-1.5px] mt-2"
                  style={{ fontFamily: "var(--font-display)", fontSize: "38px" }}>{weather.temp}°</p>
                <p className="text-[10px] text-[#9685B0] mt-1 capitalize">{weather.desc}</p>
                <p className="text-[10px] text-[#B49FD0] mt-1">good vibes 💜</p>
              </>) : (<>
                <span className="text-[32px] leading-none breathe">🌤️</span>
                <p className="text-[10px] text-[#9685B0] mt-2.5 leading-relaxed">
                  {apiKey ? "loading..." : "add key\nin settings ⚙️"}
                </p>
              </>)}
            </div>
          </GL>
        </div>

        {/* Row 3 — Todo */}
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
                      className="bg-transparent border-none cursor-pointer text-[17px] p-0 leading-none flex-shrink-0 active:scale-90">
                      {t.done ? "💜" : "🤍"}
                    </button>
                    <span className={`flex-1 text-[13px] transition-all duration-200 ${t.done ? "line-through text-[#9685B0]" : "text-[#261B40]"}`}>
                      {t.text}
                    </span>
                    <button onClick={() => delTodo(t.id)}
                      className="bg-transparent border-none cursor-pointer text-xs text-[#C4A8E0] px-1 active:scale-90">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3.5">
                <input value={newTodo} onChange={e => setNewTodo(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addTodo()}
                  placeholder="add a task... 💜"
                  className="flex-1 px-4 py-2.5 rounded-2xl border border-[#DDD3F0] bg-white/60 text-[#261B40] text-[13px]" />
                <button onClick={addTodo}
                  className="w-11 h-11 rounded-2xl text-xl flex items-center justify-center flex-shrink-0 btn-purple">＋</button>
              </div>
            </div>
          </GL>
        </div>
        {/* Row 4 — Break + Mood */}
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
                  className="flex items-center gap-1.5 mb-1.5 cursor-pointer px-1.5 py-0.5 rounded-xl transition-all active:scale-95"
                  style={{ background: moods.includes(label) ? "rgba(180,150,218,.16)" : "transparent" }}>
                  <span className="text-xs leading-none">{moods.includes(label) ? "💜" : "🤍"}</span>
                  <span className={`text-[11px] flex-1 transition-colors ${moods.includes(label) ? "text-[#7654A8] font-semibold" : "text-[#9685B0]"}`}>{label}</span>
                  <span className="text-xs">{emoji}</span>
                </div>
              ))}
            </div>
          </GL>
        </div>

        {/* Row 5 — Quote Banner */}
        <div className="su5">
          <GL radius={26} mode="prominent">
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

        {/* Row 6 — Focus */}
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

        {/* Row 7 — Journal */}
        <div className="su7">
          <GL radius={26}>
            <div className="p-5">
              <div className="flex justify-between items-center mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-[18px]">📔</span>
                  <h3 className="text-[17px] font-medium italic text-[#261B40]"
                    style={{ fontFamily: "var(--font-display)" }}>my journal</h3>
                </div>
                <span className={`text-[11px] transition-colors duration-300 ${saved ? "text-[#7654A8] font-semibold" : "text-[#9685B0]"}`}>
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

        {/* Row 8 — Soft Cards */}
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

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center pt-2.5 pb-[18px]"
        style={{ background: "rgba(232,224,250,.90)", backdropFilter: "blur(24px)", borderTop: "1px solid rgba(255,255,255,.82)", boxShadow: "0 -4px 28px rgba(118,84,168,.08)" }}>
        {(["🤍","💬","🎀","⭐","🎵"] as const).map((icon, i) => {
          const id = ["home","chat","bow","star","music"][i];
              if (id === "chat") { setShowNotes(true); return; }
          const active = activeTab === id;
  if (showNotes) return <NotesPage onBack={() => setShowNotes(false)} />;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className="bg-transparent border-none cursor-pointer transition-all duration-200"
              style={{ fontSize: active ? "26px" : "21px", opacity: active ? 1 : .38, transform: active ? "translateY(-3px)" : "none", padding: "4px 14px" }}>
              {icon}
            </button>
          );
        })}
      </nav>
    </div>
  );
}