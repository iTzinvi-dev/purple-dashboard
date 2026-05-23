import { useState, useEffect, useRef } from "react";
import { useEncrypted } from "./lib/useEncrypted";

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
  { label: "DM Sans",    value: "'DM Sans Variable', sans-serif" },
  { label: "Cormorant",  value: "'Cormorant Garamond Variable', serif" },
  { label: "Monospace",  value: "'Courier New', monospace" },
  { label: "Cursive",    value: "'Dancing Script', cursive" },
  { label: "Rounded",    value: "'Nunito', sans-serif" },
];

const COLORS = [
  "#261B40","#7654A8","#C4A8E0","#E8C4F0",
  "#FF6B6B","#FF9F43","#F9CA24","#6AB04C",
  "#22A6B3","#4834D4","#BE2EDD","#ffffff",
];

const HIGHLIGHTS = [
  "transparent","#FFF176","#FFD54F","#F48FB1",
  "#CE93D8","#80DEEA","#A5D6A7","#FFAB91",
];

const DEFAULT_STYLE: TextStyle = {
  fontFamily: "'DM Sans Variable', sans-serif",
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

const newNote = (): Note => ({
  id: Date.now().toString(),
  title: "untitled note",
  text: "",
  drawing: "",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  textStyle: { ...DEFAULT_STYLE },
});

interface Theme {
  bg: string;
  panelBg: string;
  panelBgSoft: string;
  border: string;
  ink: string;
  inkMid: string;
  inkSoft: string;
  accent: string;
  canvasBg: string;
  cardBg: string;
  cardBgActive: string;
  inputBorder: string;
}

const lightTheme: Theme = {
  bg: "linear-gradient(150deg, #EDE5FA 0%, #E0D4F5 45%, #D9CCF2 100%)",
  panelBg: "rgba(237,229,250,.9)",
  panelBgSoft: "rgba(255,255,255,.35)",
  border: "rgba(255,255,255,.7)",
  ink: "#261B40",
  inkMid: "#5A3E8A",
  inkSoft: "#9685B0",
  accent: "#7654A8",
  canvasBg: "rgba(255,255,255,.5)",
  cardBg: "rgba(255,255,255,.4)",
  cardBgActive: "rgba(118,84,168,.15)",
  inputBorder: "#DDD3F0",
};

const darkTheme: Theme = {
  bg: "radial-gradient(circle at 20% 0%, rgba(135,90,190,0.30), transparent 40%), linear-gradient(180deg, #150729 0%, #0A0418 100%)",
  panelBg: "rgba(20,10,42,.78)",
  panelBgSoft: "rgba(255,255,255,.04)",
  border: "rgba(190,160,230,.14)",
  ink: "#F0E6FF",
  inkMid: "#EBDFFF",
  inkSoft: "#B9A8D6",
  accent: "#C9A8F0",
  canvasBg: "rgba(255,255,255,.06)",
  cardBg: "rgba(255,255,255,.05)",
  cardBgActive: "rgba(174,126,232,.22)",
  inputBorder: "rgba(190,160,230,.20)",
};

export default function NotesPage({ onBack, darkMode = false }: { onBack: () => void; darkMode?: boolean }) {
  const t: Theme = darkMode ? darkTheme : lightTheme;

  const [notes, setNotes, ready] = useEncrypted<Note[]>("notes", [], 400);
  const [explicitId, setExplicitId] = useState<string | null>(null);
  // Derived: prefer explicit selection, otherwise fall back to the first note.
  const activeId = explicitId ?? notes[0]?.id ?? null;
  const setActiveId = setExplicitId;
  const [tab, setTab] = useState<"write" | "style" | "draw">("write");
  const [tool, setTool] = useState<"pencil" | "pen" | "highlighter" | "eraser">("pen");
  const [brushSize, setBrushSize] = useState(1);
  const [drawColor, setDrawColor] = useState("#7654A8");
  const [opacity, setOpacity] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const active = notes.find(n => n.id === activeId) ?? null;

  const createNote = () => {
    const n = newNote();
    setNotes([n, ...notes]);
    setActiveId(n.id);
    setTab("write");
  };

  const deleteNote = (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated);
    if (activeId === id) setActiveId(updated[0]?.id ?? null);
  };

  const updateNote = (id: string, patch: Partial<Note>) => {
    setNotes(notes.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n));
  };

  const updateStyle = (patch: Partial<TextStyle>) => {
    if (!active) return;
    updateNote(active.id, { textStyle: { ...active.textStyle, ...patch } });
  };

  // Canvas setup
  useEffect(() => {
    if (tab !== "draw" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;
    if (active?.drawing) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = active.drawing;
    }
  }, [tab, activeId, active?.drawing]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing || !ctxRef.current || !lastPos.current) return;
    const ctx = ctxRef.current;
    const pos = getPos(e);

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

  const endDraw = () => {
    if (!isDrawing || !canvasRef.current) return;
    setIsDrawing(false);
    lastPos.current = null;
    if (ctxRef.current) ctxRef.current.globalAlpha = 1;
    const dataUrl = canvasRef.current.toDataURL();
    if (active) updateNote(active.id, { drawing: dataUrl });
  };

  // Stable mount-time timestamp; useState initializer runs once and is render-safe.
  const [now] = useState(() => Date.now());

  const clearCanvas = () => {
    if (!ctxRef.current || !canvasRef.current) return;
    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    if (active) updateNote(active.id, { drawing: "" });
  };

  const timeAgo = (ts: number) => {
    const diff = now - ts;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "'DM Sans Variable', system-ui, sans-serif", display: "flex", flexDirection: "column", color: t.ink }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 8px", background: t.panelBg, backdropFilter: "blur(20px)", borderBottom: `1px solid ${t.border}` }}>
        <button onClick={onBack}
          style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, flexShrink: 0, color: t.ink }}>←</button>
        <h1 style={{ margin: 0, fontSize: 22, fontFamily: "'Cormorant Garamond Variable', serif", fontStyle: "italic", color: t.inkMid, flex: 1 }}>my notes</h1>
        <button onClick={createNote}
          style={{ background: "linear-gradient(135deg, #7654A8, #A870D8)", border: "none", borderRadius: 14, padding: "8px 16px", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 14px rgba(120,80,190,.3)" }}>+ new</button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Notes List */}
        <div style={{ width: 140, flexShrink: 0, background: t.panelBgSoft, borderRight: `1px solid ${t.border}`, overflowY: "auto", padding: 8 }}>
          {!ready && <p style={{ fontSize: 11, color: t.inkSoft, textAlign: "center", padding: "20px 4px" }}>loading…</p>}
          {ready && notes.length === 0 && (
            <p style={{ fontSize: 11, color: t.inkSoft, textAlign: "center", padding: "20px 4px" }}>no notes yet 💜</p>
          )}
          {notes.map(n => (
            <div key={n.id} onClick={() => { setActiveId(n.id); setTab("write"); }}
              style={{ padding: "10px 8px", borderRadius: 14, marginBottom: 6, cursor: "pointer", background: activeId === n.id ? t.cardBgActive : t.cardBg, border: activeId === n.id ? "1px solid rgba(118,84,168,.3)" : "1px solid transparent", position: "relative" }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: activeId === n.id ? t.accent : t.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</p>
              <p style={{ margin: "3px 0 0", fontSize: 10, color: t.inkSoft }}>{timeAgo(n.updatedAt)}</p>
              <button onClick={e => { e.stopPropagation(); deleteNote(n.id); }}
                style={{ position: "absolute", top: 6, right: 6, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#C4A8E0", opacity: 0.7, lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!active ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <span style={{ fontSize: 48 }}>📔</span>
              <p style={{ margin: 0, color: t.inkSoft, fontSize: 14 }}>select or create a note</p>
              <button onClick={createNote}
                style={{ background: "linear-gradient(135deg, #7654A8, #A870D8)", border: "none", borderRadius: 16, padding: "12px 24px", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>create first note 💜</button>
            </div>
          ) : (
            <>
              {/* Note Title */}
              <div style={{ padding: "10px 14px 6px", borderBottom: `1px solid ${t.border}` }}>
                {editingTitle ? (
                  <input autoFocus value={active.title}
                    onChange={e => updateNote(active.id, { title: e.target.value })}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={e => e.key === "Enter" && setEditingTitle(false)}
                    style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1.5px solid #C4A8E0", fontSize: 15, fontWeight: 600, color: t.inkMid, outline: "none", padding: "2px 0" }} />
                ) : (
                  <p onClick={() => setEditingTitle(true)}
                    style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.inkMid, cursor: "pointer" }}>{active.title} ✏️</p>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`, background: t.panelBgSoft }}>
                {(["write", "style", "draw"] as const).map(tk => (
                  <button key={tk} onClick={() => setTab(tk)}
                    style={{ flex: 1, padding: "10px 4px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: tab === tk ? 700 : 400, color: tab === tk ? t.accent : t.inkSoft, borderBottom: tab === tk ? `2px solid ${t.accent}` : "2px solid transparent", transition: "all .2s" }}>
                    {tk === "write" ? "✏️ write" : tk === "style" ? "🎨 style" : "🖌️ draw"}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

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
                      color: active.textStyle.color === DEFAULT_STYLE.color && darkMode ? t.ink : active.textStyle.color,
                      backgroundColor: active.textStyle.highlight !== "transparent" ? active.textStyle.highlight : "transparent",
                      lineHeight: active.textStyle.lineHeight,
                      textAlign: active.textStyle.align,
                      boxSizing: "border-box",
                    }}
                  />
                )}

                {tab === "style" && (
                  <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>

                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: t.inkSoft, textTransform: "uppercase", letterSpacing: ".8px" }}>font</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                      {FONTS.map(f => (
                        <button key={f.value} onClick={() => updateStyle({ fontFamily: f.value })}
                          style={{ padding: "6px 12px", borderRadius: 12, border: "1.5px solid", borderColor: active.textStyle.fontFamily === f.value ? t.accent : t.inputBorder, background: active.textStyle.fontFamily === f.value ? t.cardBgActive : t.cardBg, cursor: "pointer", fontSize: 12, fontFamily: f.value, color: active.textStyle.fontFamily === f.value ? t.accent : t.ink }}>
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: t.inkSoft, textTransform: "uppercase", letterSpacing: ".8px" }}>size — {active.textStyle.fontSize}px</p>
                    <input type="range" min={10} max={32} value={active.textStyle.fontSize}
                      onChange={e => updateStyle({ fontSize: +e.target.value })}
                      style={{ width: "100%", marginBottom: 16, accentColor: "#7654A8" }} />

                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: t.inkSoft, textTransform: "uppercase", letterSpacing: ".8px" }}>style</p>
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                      {[
                        { label: "B", key: "bold", style: { fontWeight: 700 } },
                        { label: "I", key: "italic", style: { fontStyle: "italic" } },
                        { label: "U", key: "underline", style: { textDecoration: "underline" } },
                      ].map(({ label, key, style: s }) => (
                        <button key={key} onClick={() => updateStyle({ [key]: !active.textStyle[key as keyof TextStyle] })}
                          style={{ width: 40, height: 40, borderRadius: 12, border: "1.5px solid", borderColor: active.textStyle[key as keyof TextStyle] ? t.accent : t.inputBorder, background: active.textStyle[key as keyof TextStyle] ? t.cardBgActive : t.cardBg, cursor: "pointer", fontSize: 15, color: active.textStyle[key as keyof TextStyle] ? t.accent : t.ink, ...s }}>
                          {label}
                        </button>
                      ))}
                      {(["left", "center", "right"] as const).map(a => (
                        <button key={a} onClick={() => updateStyle({ align: a })}
                          style={{ width: 40, height: 40, borderRadius: 12, border: "1.5px solid", borderColor: active.textStyle.align === a ? t.accent : t.inputBorder, background: active.textStyle.align === a ? t.cardBgActive : t.cardBg, cursor: "pointer", fontSize: 14, color: t.ink }}>
                          {a === "left" ? "⬅" : a === "center" ? "↔" : "➡"}
                        </button>
                      ))}
                    </div>

                    <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: t.inkSoft, textTransform: "uppercase", letterSpacing: ".8px" }}>line height — {active.textStyle.lineHeight}</p>
                    <input type="range" min={1} max={3} step={0.1} value={active.textStyle.lineHeight}
                      onChange={e => updateStyle({ lineHeight: +e.target.value })}
                      style={{ width: "100%", marginBottom: 16, accentColor: "#7654A8" }} />

                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: t.inkSoft, textTransform: "uppercase", letterSpacing: ".8px" }}>text color</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                      {COLORS.map(c => (
                        <button key={c} onClick={() => updateStyle({ color: c })}
                          style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: active.textStyle.color === c ? `3px solid ${t.accent}` : "2px solid rgba(0,0,0,.1)", cursor: "pointer", boxShadow: c === "#ffffff" ? "0 0 0 1px #DDD3F0" : "none" }} />
                      ))}
                    </div>

                    <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: t.inkSoft, textTransform: "uppercase", letterSpacing: ".8px" }}>highlight</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                      {HIGHLIGHTS.map(c => (
                        <button key={c} onClick={() => updateStyle({ highlight: c })}
                          style={{ width: 28, height: 28, borderRadius: 8, background: c === "transparent" ? (darkMode ? "rgba(255,255,255,.06)" : "white") : c, border: active.textStyle.highlight === c ? `3px solid ${t.accent}` : "2px solid rgba(0,0,0,.1)", cursor: "pointer", fontSize: c === "transparent" ? 12 : 0, color: t.ink }}>
                          {c === "transparent" ? "✕" : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {tab === "draw" && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                    <div style={{ padding: "8px 12px", background: t.panelBgSoft, borderBottom: `1px solid ${t.border}`, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>

                      <div style={{ display: "flex", gap: 4 }}>
                        {([
                          { id: "pencil", icon: "✏️" },
                          { id: "pen",    icon: "🖊️" },
                          { id: "highlighter", icon: "🖍️" },
                          { id: "eraser", icon: "🗑️" },
                        ] as const).map(({ id, icon }) => (
                          <button key={id} onClick={() => setTool(id)}
                            style={{ width: 36, height: 36, borderRadius: 10, border: "1.5px solid", borderColor: tool === id ? t.accent : t.inputBorder, background: tool === id ? t.cardBgActive : t.cardBg, cursor: "pointer", fontSize: 16 }}>
                            {icon}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {[0, 1, 2, 3].map(s => (
                          <button key={s} onClick={() => setBrushSize(s)}
                            style={{ width: 32, height: 32, borderRadius: 10, border: "1.5px solid", borderColor: brushSize === s ? t.accent : t.inputBorder, background: brushSize === s ? t.cardBgActive : t.cardBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: BRUSH_SIZES[s] * 0.8, height: BRUSH_SIZES[s] * 0.8, borderRadius: "50%", background: t.accent, maxWidth: 16, maxHeight: 16 }} />
                          </button>
                        ))}
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {COLORS.slice(0, 8).map(c => (
                          <button key={c} onClick={() => setDrawColor(c)}
                            style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: drawColor === c ? `2.5px solid ${t.accent}` : "1.5px solid rgba(0,0,0,.1)", cursor: "pointer" }} />
                        ))}
                        <input type="color" value={drawColor} onChange={e => setDrawColor(e.target.value)}
                          style={{ width: 22, height: 22, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0 }} />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 80 }}>
                        <span style={{ fontSize: 10, color: t.inkSoft }}>opacity</span>
                        <input type="range" min={0.1} max={1} step={0.05} value={opacity}
                          onChange={e => setOpacity(+e.target.value)}
                          style={{ flex: 1, accentColor: "#7654A8" }} />
                      </div>

                      <button onClick={clearCanvas}
                        style={{ padding: "6px 12px", borderRadius: 10, border: `1.5px solid ${t.inputBorder}`, background: t.cardBg, cursor: "pointer", fontSize: 11, color: t.inkSoft, fontWeight: 600 }}>clear</button>
                    </div>

                    <canvas ref={canvasRef}
                      style={{ flex: 1, width: "100%", touchAction: "none", background: t.canvasBg, cursor: tool === "eraser" ? "cell" : "crosshair" }}
                      onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                      onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
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
