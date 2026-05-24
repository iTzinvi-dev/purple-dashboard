import { useState, useEffect } from "react";
import NotesPage from "./NotesPage";
import AudioNotesPage from "./AudioNotesPage";
import ProductivityPage from "./ProductivityPage";
import PetalCanvas from "./PetalCanvas";

type TabId = "audio" | "notes" | "productivity";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "audio",        label: "audio",        icon: "🎙️" },
  { id: "notes",        label: "notes",        icon: "📝" },
  { id: "productivity", label: "productivity", icon: "⏳" },
];

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { void 0; } },
};

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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const saved = ls.get("active_tab_v1") as TabId | null;
    return saved && TABS.some(t => t.id === saved) ? saved : "audio";
  });

  const [darkMode, setDarkMode] = useState(() => getJson("darkMode", false));
  const [tempDarkMode, setTempDarkMode] = useState(() => getJson("darkMode", false));
  const [showSettings, setShowSettings] = useState(false);

  // Persist active tab
  useEffect(() => {
    ls.set("active_tab_v1", activeTab);
  }, [activeTab]);

  // Apply dark mode
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Ripple effect on buttons
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!(button instanceof HTMLElement)) return;
      if (button.closest(".no-ripple")) return;

      const rect = button.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height) * 1.8;
      ripple.className = "ripple";
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      button.appendChild(ripple);
      window.setTimeout(() => { ripple.remove(); }, 600);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const saveSettings = () => {
    setDarkMode(tempDarkMode);
    ls.set("darkMode", JSON.stringify(tempDarkMode));
    setShowSettings(false);
  };

  return (
    <div className="min-h-screen pb-24"
      style={{
        background: darkMode
          ? "radial-gradient(circle at top, rgba(135, 90, 190, 0.34), transparent 35%), linear-gradient(180deg, #17082E 0%, #0F0620 100%)"
          : "linear-gradient(150deg, #EDE5FA 0%, #E0D4F5 45%, #D9CCF2 100%)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        color: darkMode ? "#F4E8FF" : "#261B40",
      }}>

      <PetalCanvas />

      {/* Floating settings button (top right) */}
      <button onClick={() => { setTempDarkMode(darkMode); setShowSettings(true); }}
        className="fixed top-4 right-4 z-40 w-10 h-10 flex items-center justify-center text-lg icon-button nav-button"
        style={{ borderRadius: "50%", background: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.88)", boxShadow: "0 2px 14px rgba(120,80,190,.1)" }}>
        ⚙️
      </button>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-5"
          style={{ background: "rgba(35,18,65,.52)", backdropFilter: "blur(14px)" }}
          onClick={e => e.target === e.currentTarget && setShowSettings(false)}>
          <div className="glass-card w-full max-w-sm" style={{ borderRadius: 28 }}>
            <div className="p-7">
              <h3 className="text-xl font-medium italic text-[#5A3E8A] mb-6"
                style={{ fontFamily: "var(--font-display)" }}>settings</h3>
              <div className="mb-5 p-4 rounded-3xl border border-[#DDD3F0] bg-white/70">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9685B0]">dark mode</p>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={tempDarkMode} onChange={e => setTempDarkMode(e.target.checked)}
                      className="sr-only peer" />
                    <div className="w-11 h-6 bg-[#DDD3F0] rounded-full peer-checked:bg-[#7A4DD8] peer-focus:ring-2 peer-focus:ring-[#C4A8E0] transition-all" />
                    <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-md peer-checked:translate-x-5 transition-transform" />
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowSettings(false)}
                  className="flex-1 py-3 rounded-2xl border border-[#DDD3F0] text-[#9685B0] text-sm icon-button"
                  style={{ background: "transparent", cursor: "pointer" }}>cancel</button>
                <button onClick={saveSettings}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold btn-purple shimmer-press">apply</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="relative z-10 max-w-[430px] mx-auto">
        {activeTab === "audio"        && <AudioNotesPage />}
        {activeTab === "notes"        && <NotesPage />}
        {activeTab === "productivity" && <ProductivityPage />}
      </div>

      {/* Bottom Nav — only 3 tabs */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center pt-2.5 pb-[18px]"
        style={{
          background: darkMode ? "rgba(23,8,46,.92)" : "rgba(232,224,250,.90)",
          backdropFilter: "blur(24px)",
          borderTop: darkMode ? "1px solid rgba(255,255,255,.08)" : "1px solid rgba(255,255,255,.82)",
          boxShadow: "0 -4px 28px rgba(118,84,168,.08)",
        }}>
        {TABS.map(({ id, label, icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              className="bg-transparent border-none cursor-pointer transition-all duration-200 flex flex-col items-center gap-0.5 nav-button"
              style={{
                opacity: active ? 1 : 0.45,
                transform: active ? "translateY(-2px)" : "none",
                padding: "4px 14px",
                minWidth: 72,
              }}>
              <span style={{ fontSize: active ? 24 : 20, transition: "font-size .2s" }}>{icon}</span>
              <span style={{
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                color: active ? "#7654A8" : (darkMode ? "#B49FD0" : "#9685B0"),
                letterSpacing: ".5px",
              }}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
