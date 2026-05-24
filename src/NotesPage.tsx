import { useState, useEffect, useRef, useCallback } from "react";

interface Note {
  id: string;
  title: string;
  text: string;
  drawing: string;
  createdAt: number;
  updatedAt: number;
  textStyle: TextStyle;
}

interface TextStyle {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  highlight: string;
  lineHeight: number;
  align: "left" | "center" | "right";
}

const FONTS = [
  { label: "DM Sans",    value: "'DM Sans', sans-serif" },
  { label: "Cormorant",  value: "'Cormorant Garamond', serif" },
  { label: "Monospace",  value: "'Courier New', monospace" },
  { label: "Cursive",    value: "'Dancing Script', cursive" },
  { label: "Rounded",    value: "'Nunito', sans-serif" },
];

const COLORS = [
  "#261B40", "#7654A8", "#C4A8E0", "#E8C4F0",
  "#FF6B6B", "#FF9F43", "#F9CA24", "#6AB04C",
  "#22A6B3", "#4834D4", "#BE2EDD", "#ffffff",
];

const HIGHLIGHTS = [
  "transparent", "#FFF176", "#FFD54F", "#F48FB1",
  "#CE93D8", "#80DEEA", "#A5D6A7", "#FFAB91",
];

const DEFAULT_STYLE: TextStyle = {
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 15,
  bold: false,
  italic: false,
  underline: false,
  color: "#261B40",
  highlight: "transparent",
  lineHeight: 1.7,
  align: "left",
};

const BRUSH_SIZES = [2, 5, 10, 18];
const SAVE_DEBOUNCE_MS = 600;

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
};

const newNote = (): Note => ({
  id: Date.now().toString(),
  title: "untitled note",
  text: "",
  drawing: "",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  textStyle: { ...DEFAULT_STYLE },
});

const loadNotes = (): Note[] => {
  try {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("notes_v2");
    if (!saved) return [];
    return JSON.parse(saved) as Note[];
  } catch {
    return [];
  }
};

// WebP if supported (smaller + has alpha), otherwise PNG
let _webpSupported: boolean | null = null;
const supportsWebp = (): boolean => {
  if (_webpSupported !== null) return _webpSupported;
  try {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 1;
    _webpSupported = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch { _webpSupported = false; }
  return _webpSupported;
};

const canvasToBestDataUrl = (canvas: HTMLCanvasElement): string =>
  supportsWebp() ? canvas.toDataURL("image/webp", 0.85) : canvas.toDataURL("image/png");

export default function NotesPage({ onBack }: { onBack?: () => void } = {}) {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const [activeId, setActiveId] = useState<string | null>(() => loadNotes()[0]?.id ?? null);
  const [tab, setTab] = useState<"write" | "style" | "draw">("write");
  const [tool, setTool] = useState<"pencil" | "pen" | "highlighter" | "eraser">("pen");
  const [brushSize, setBrushSize] = useState(1);
  const [drawColor, setDrawColor] = useState("#7654A8");
  const [opacity, setOpacity] = useState(1);
  const [editingTitle, setEditingTitle] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dprRef = useRef(1);

  const active = notes.find(n => n.id === activeId) ?? null;

  const save = useCallback((updated: Note[]) => {
    setNotes(updated);
    const ok = ls.set("notes_v2", JSON.stringify(updated));
    if (!ok) setStorageWarning("storage full — try clearing old notes");
    else setStorageWarning(null);
  }, []);

  const createNote = () => {
    const n = newNote();
    save([n, ...notes]);
    setActiveId(n.id);
    setTab("write");
  };

  const deleteNote = (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    save(updated);
    if (activeId === id) setActiveId(updated[0]?.id ?? null);
  };

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    setNotes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n);
      const ok = ls.set("notes_v2", JSON.stringify(updated));
      if (!ok) setStorageWarning("storage full — try clearing old notes");
      return updated;
    });
  }, []);

  const updateStyle = (patch: Partial<TextStyle>) => {
    if (!active) return;
    updateNote(active.id, { textStyle: { ...active.textStyle, ...patch } });
  };

  // ── Canvas setup with DPR for crisp lines ──
  useEffect(() => {
    if (tab !== "draw" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dprRef.current = dpr;
    const cssW = canvas.offsetWidth;
    const cssH = canvas.offsetHeight;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctxRef.current = ctx;

    if (active?.drawing) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, cssW, cssH);
        ctx.drawImage(img, 0, 0, cssW, cssH);
      };
      img.src = active.drawing;
    } else {
      ctx.clearRect(0, 0, cssW, cssH);
    }
  }, [tab, activeId, active?.drawing]);

  // Cleanup pending save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const queueDrawingSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (!canvasRef.current || !active) return;
      const dataUrl = canvasToBestDataUrl(canvasRef.current);
      updateNote(active.id, { drawing: dataUrl });
    }, SAVE_DEBOUNCE_MS);
  }, [active, updateNote]);

  const getPointerPos = (e: React.PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!canvasRef.current) return;
    canvasRef.current.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    lastPos.current = getPointerPos(e);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawingRef.current || !ctxRef.current || !lastPos.current) return;
    e.preventDefault();
    const ctx = ctxRef.current;
    const pos = getPointerPos(e);

    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = BRUSH_SIZES[brushSize] * 3;
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else if (tool === "highlighter") {
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = BRUSH_SIZES[brushSize] * 4;
      ctx.strokeStyle = drawColor;
      ctx.globalAlpha = 0.3 * opacity;
    } else if (tool === "pencil") {
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = BRUSH_SIZES[brushSize] * 0.8;
      ctx.strokeStyle = drawColor;
      ctx.globalAlpha = 0.7 * opacity;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = BRUSH_SIZES[brushSize];
      ctx.strokeStyle = drawColor;
      ctx.globalAlpha = opacity;
    }

    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPos.current = null;
    if (ctxRef.current) ctxRef.current.globalAlpha = 1;
    if (canvasRef.current) {
      try { canvasRef.current.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    queueDrawingSave();
  };

  const clearCanvas = () => {
    if (!ctxRef.current || !canvasRef.current) return;
    const cssW = canvasRef.current.offsetWidth;
    const cssH = canvasRef.current.offsetHeight;
    ctxRef.current.clearRect(0, 0, cssW, cssH);
    if (active) updateNote(active.id, { drawing: "" });
  };

  const [now] = useState(() => Date.now());
  const timeAgo = (ts: number) => {
    const diff = now - ts;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="page-surface" style={{ fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column", height: "100%", paddingBottom: 0 }}>

      {/* Header */}
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 10px", backdropFilter: "blur(14px)" }}>
        {onBack && (
          <button onClick={onBack} aria-label="back"
            style={{ background: "var(--bg-card-soft)", border: "1px solid var(--border-card)", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: "var(--text-secondary)", flexShrink: 0 }}>←</button>
        )}
        <h1 style={{ margin: 0, fontSize: 22, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", color: "var(--text-secondary)", flex: 1 }}>my notes</h1>
        <button onClick={createNote}
          style={{ background: "linear-gradient(135deg, #7654A8, #A870D8)", border: "none", borderRadius: 14, padding: "8px 16px", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 14px rgba(120,80,190,.3)" }}>+ new</button>
      </div>

      {storageWarning && (
        <div style={{ padding: "8px 14px", background: "var(--danger-bg)", color: "var(--danger)", fontSize: 11, textAlign: "center" }}>
          ⚠ {storageWarning}
        </div>
      )}

      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

        {/* Notes List */}
        <div style={{ width: 140, flexShrink: 0, background: "var(--bg-card-soft)", borderRight: "1px solid var(--border-card)", overflowY: "auto", padding: 8 }}>
          {notes.length === 0 && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "20px 4px" }}>no notes yet 💜</p>
          )}
          {notes.map(n => (
            <div key={n.id} onClick={() => { setActiveId(n.id); setTab("write"); }}
              style={{
                padding: "10px 8px", borderRadius: 14, marginBottom: 6, cursor: "pointer",
                background: activeId === n.id ? "var(--accent-soft)" : "var(--bg-input)",
                border: activeId === n.id ? "1px solid var(--accent)" : "1px solid transparent",
                position: "relative",
              }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: activeId === n.id ? "var(--accent)" : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</p>
              <p style={{ margin: "3px 0 0", fontSize: 10, color: "var(--text-muted)" }}>{timeAgo(n.updatedAt)}</p>
              <button onClick={e => { e.stopPropagation(); deleteNote(n.id); }} aria-label="delete"
                style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-faint)", opacity: 0.7, lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {!active ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <span style={{ fontSize: 48 }}>📔</span>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>select or create a note</p>
              <button onClick={createNote}
                style={{ background: "linear-gradient(135deg, #7654A8, #A870D8)", border: "none", borderRadius: 16, padding: "12px 24px", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>create first note 💜</button>
            </div>
          ) : (
            <>
              {/* Note Title */}
              <div style={{ padding: "10px 14px 6px", borderBottom: "1px solid var(--border-card)" }}>
                {editingTitle ? (
                  <input autoFocus value={active.title}
                    onChange={e => updateNote(active.id, { title: e.target.value })}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={e => e.key === "Enter" && setEditingTitle(false)}
                    style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1.5px solid var(--accent-2)", fontSize: 15, fontWeight: 600, color: "var(--text-secondary)", outline: "none", padding: "2px 0" }} />
                ) : (
                  <p onClick={() => setEditingTitle(true)}
                    style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer" }}>{active.title} ✏️</p>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid var(--border-card)", background: "var(--bg-card-soft)" }}>
                {(["write", "style", "draw"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    style={{ flex: 1, padding: "10px 4px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: tab === t ? 700 : 400, color: tab === t ? "var(--accent)" : "var(--text-muted)", borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent", transition: "all .2s" }}>
                    {t === "write" ? "✏️ write" : t === "style" ? "🎨 style" : "🖌️ draw"}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>

                {/* Write Tab */}
                {tab === "write" && (
                  <textarea
                    value={active.text}
                    onChange={e => updateNote(active.id, { text: e.target.value })}
                    placeholder="start writing... 💜"
                    style={{
                      flex: 1, width: "100%", padding: 16, border: "none", outline: "none",
                      background: "transparent", resize: "none",
                      fontFamily: active.textStyle.fontFamily,
                      fontSize: active.textStyle.fontSize,
                      fontWeight: active.textStyle.bold ? 700 : 400,
                      fontStyle: active.textStyle.italic ? "italic" : "normal",
                      textDecoration: active.textStyle.underline ? "underline" : "none",
                      color: active.textStyle.color,
                      backgroundColor: active.textStyle.highlight !== "transparent" ? active.textStyle.highlight : "transparent",
                      lineHeight: active.textStyle.lineHeight,
                      textAlign: active.textStyle.align,
                      boxSizing: "border-box",
                    }}
                  />
                )}

                {/* Style Tab */}
                {tab === "style" && (
                  <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>

                    <SectionLabel>font</SectionLabel>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                      {FONTS.map(f => (
                        <button key={f.value} onClick={() => updateStyle({ fontFamily: f.value })}
                          style={{
                            padding: "6px 12px", borderRadius: 12,
                            border: "1.5px solid",
                            borderColor: active.textStyle.fontFamily === f.value ? "var(--accent)" : "var(--border-soft)",
                            background: active.textStyle.fontFamily === f.value ? "var(--accent-soft)" : "var(--bg-input)",
                            cursor: "pointer", fontSize: 12, fontFamily: f.value,
                            color: active.textStyle.fontFamily === f.value ? "var(--accent)" : "var(--text-primary)",
                          }}>
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <SectionLabel>size — {active.textStyle.fontSize}px</SectionLabel>
                    <input type="range" min={10} max={32} value={active.textStyle.fontSize}
                      onChange={e => updateStyle({ fontSize: +e.target.value })}
                      style={{ width: "100%", marginBottom: 16, accentColor: "#7654A8" }} />

                    <SectionLabel>style</SectionLabel>
                    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                      {[
                        { label: "B", key: "bold" as const, css: { fontWeight: 700 } as React.CSSProperties },
                        { label: "I", key: "italic" as const, css: { fontStyle: "italic" } as React.CSSProperties },
                        { label: "U", key: "underline" as const, css: { textDecoration: "underline" } as React.CSSProperties },
                      ].map(({ label, key, css }) => {
                        const enabled = active.textStyle[key];
                        return (
                          <button key={key} onClick={() => updateStyle({ [key]: !enabled })}
                            style={{
                              width: 40, height: 40, borderRadius: 12,
                              border: "1.5px solid",
                              borderColor: enabled ? "var(--accent)" : "var(--border-soft)",
                              background: enabled ? "var(--accent-soft)" : "var(--bg-input)",
                              cursor: "pointer", fontSize: 15,
                              color: enabled ? "var(--accent)" : "var(--text-primary)",
                              ...css,
                            }}>
                            {label}
                          </button>
                        );
                      })}
                      {(["left", "center", "right"] as const).map(a => (
                        <button key={a} onClick={() => updateStyle({ align: a })}
                          style={{
                            width: 40, height: 40, borderRadius: 12,
                            border: "1.5px solid",
                            borderColor: active.textStyle.align === a ? "var(--accent)" : "var(--border-soft)",
                            background: active.textStyle.align === a ? "var(--accent-soft)" : "var(--bg-input)",
                            cursor: "pointer", fontSize: 14,
                            color: "var(--text-primary)",
                          }}>
                          {a === "left" ? "⬅" : a === "center" ? "↔" : "➡"}
                        </button>
                      ))}
                    </div>

                    <SectionLabel>line height — {active.textStyle.lineHeight}</SectionLabel>
                    <input type="range" min={1} max={3} step={0.1} value={active.textStyle.lineHeight}
                      onChange={e => updateStyle({ lineHeight: +e.target.value })}
                      style={{ width: "100%", marginBottom: 16, accentColor: "#7654A8" }} />

                    <SectionLabel>text color</SectionLabel>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                      {COLORS.map(c => (
                        <button key={c} onClick={() => updateStyle({ color: c })} aria-label={`color ${c}`}
                          style={{
                            width: 28, height: 28, borderRadius: "50%", background: c,
                            border: active.textStyle.color === c ? "3px solid var(--accent)" : "2px solid rgba(0,0,0,.1)",
                            cursor: "pointer",
                            boxShadow: c === "#ffffff" ? "0 0 0 1px var(--border-soft)" : "none",
                          }} />
                      ))}
                    </div>

                    <SectionLabel>highlight</SectionLabel>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {HIGHLIGHTS.map(c => (
                        <button key={c} onClick={() => updateStyle({ highlight: c })} aria-label={`highlight ${c}`}
                          style={{
                            width: 28, height: 28, borderRadius: 8,
                            background: c === "transparent" ? "var(--bg-input)" : c,
                            border: active.textStyle.highlight === c ? "3px solid var(--accent)" : "2px solid rgba(0,0,0,.1)",
                            cursor: "pointer", fontSize: c === "transparent" ? 12 : 0,
                            color: "var(--text-muted)",
                          }}>
                          {c === "transparent" ? "✕" : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Draw Tab */}
                {tab === "draw" && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>

                    {/* Draw Toolbar */}
                    <div style={{ padding: "8px 12px", background: "var(--bg-card-soft)", borderBottom: "1px solid var(--border-card)", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>

                      <div style={{ display: "flex", gap: 4 }}>
                        {([
                          { id: "pencil", icon: "✏️" },
                          { id: "pen", icon: "🖊️" },
                          { id: "highlighter", icon: "🖍️" },
                          { id: "eraser", icon: "🧽" },
                        ] as const).map(({ id, icon }) => (
                          <button key={id} onClick={() => setTool(id)}
                            style={{
                              width: 36, height: 36, borderRadius: 10,
                              border: "1.5px solid",
                              borderColor: tool === id ? "var(--accent)" : "var(--border-soft)",
                              background: tool === id ? "var(--accent-soft)" : "var(--bg-input)",
                              cursor: "pointer", fontSize: 16,
                            }}>
                            {icon}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {[0, 1, 2, 3].map(s => (
                          <button key={s} onClick={() => setBrushSize(s)}
                            style={{
                              width: 32, height: 32, borderRadius: 10,
                              border: "1.5px solid",
                              borderColor: brushSize === s ? "var(--accent)" : "var(--border-soft)",
                              background: brushSize === s ? "var(--accent-soft)" : "var(--bg-input)",
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                            <div style={{ width: BRUSH_SIZES[s] * 0.8, height: BRUSH_SIZES[s] * 0.8, borderRadius: "50%", background: "var(--accent)", maxWidth: 16, maxHeight: 16 }} />
                          </button>
                        ))}
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {COLORS.slice(0, 8).map(c => (
                          <button key={c} onClick={() => setDrawColor(c)} aria-label={`pen color ${c}`}
                            style={{
                              width: 22, height: 22, borderRadius: "50%", background: c,
                              border: drawColor === c ? "2.5px solid var(--accent)" : "1.5px solid rgba(0,0,0,.1)",
                              cursor: "pointer",
                            }} />
                        ))}
                        <input type="color" value={drawColor} onChange={e => setDrawColor(e.target.value)}
                          style={{ width: 22, height: 22, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0, background: "transparent" }} />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 80 }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>opacity</span>
                        <input type="range" min={0.1} max={1} step={0.05} value={opacity}
                          onChange={e => setOpacity(+e.target.value)}
                          style={{ flex: 1, accentColor: "#7654A8" }} />
                      </div>

                      <button onClick={clearCanvas}
                        style={{
                          padding: "6px 12px", borderRadius: 10,
                          border: "1.5px solid var(--border-soft)",
                          background: "var(--bg-input)",
                          cursor: "pointer", fontSize: 11,
                          color: "var(--text-muted)", fontWeight: 600,
                        }}>clear</button>
                    </div>

                    {/* Canvas */}
                    <canvas ref={canvasRef}
                      style={{
                        flex: 1, width: "100%", touchAction: "none",
                        background: "var(--bg-canvas)",
                        cursor: tool === "eraser" ? "cell" : "crosshair",
                      }}
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerUp}
                      onPointerLeave={onPointerUp}
                    />
                  </div>
                )}

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: "0 0 8px",
      fontSize: 11,
      fontWeight: 600,
      color: "var(--text-muted)",
      textTransform: "uppercase",
      letterSpacing: ".8px",
    }}>{children}</p>
  );
}
