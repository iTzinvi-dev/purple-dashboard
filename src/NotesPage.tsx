import { useState, useEffect, useRef } from "react";

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
  { label: "Cormorant", value: "'Cormorant Garamond', serif" },
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

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { void 0; } },
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

export default function NotesPage({ onBack }: { onBack: () => void }) {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const [activeId, setActiveId] = useState<string | null>(() => loadNotes()[0]?.id ?? null);
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

  const save = (updated: Note[]) => {
    setNotes(updated);
    ls.set("notes_v2", JSON.stringify(updated));
  };

  const createNote = () => {
    const n = newNote();
    const updated = [n, ...notes];
    save(updated);
    setActiveId(n.id);
    setTab("write");
  };

  const deleteNote = (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    save(updated);
    if (activeId === id) setActiveId(updated[0]?.id ?? null);
  };

  const updateNote = (id: string, patch: Partial<Note>) => {
    const updated = notes.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n);
    save(updated);
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
    <div style={{ minHeight: "100vh", background: "linear-gradient(150deg, #EDE5FA 0%, #E0D4F5 45%, #D9CCF2 100%)", fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 16px 8px", background: "rgba(237,229,250,.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,.7)" }}>
        <button onClick={onBack}
          style={{ background: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.9)", borderRadius: "50%", width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "18px", flexShrink: 0 }}>←</button>
        <h1 style={{ margin: 0, fontSize: "22px", fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", color: "#5A3E8A", flex: 1 }}>my notes</h1>
        <button onClick={createNote}
          style={{ background: "linear-gradient(135deg, #7654A8, #A870D8)", border: "none", borderRadius: "14px", padding: "8px 16px", color: "white", cursor: "pointer", fontSize: "13px", fontWeight: 600, boxShadow: "0 4px 14px rgba(120,80,190,.3)" }}>+ new</button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Notes List */}
        <div style={{ width: "140px", flexShrink: 0, background: "rgba(255,255,255,.35)", borderRight: "1px solid rgba(255,255,255,.7)", overflowY: "auto", padding: "8px" }}>
          {notes.length === 0 && (
            <p style={{ fontSize: "11px", color: "#9685B0", textAlign: "center", padding: "20px 4px" }}>no notes yet 💜</p>
          )}
          {notes.map(n => (
            <div key={n.id} onClick={() => { setActiveId(n.id); setTab("write"); }}
              style={{ padding: "10px 8px", borderRadius: "14px", marginBottom: "6px", cursor: "pointer", background: activeId === n.id ? "rgba(118,84,168,.15)" : "rgba(255,255,255,.4)", border: activeId === n.id ? "1px solid rgba(118,84,168,.3)" : "1px solid transparent", position: "relative" }}>
              <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: activeId === n.id ? "#7654A8" : "#261B40", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</p>
              <p style={{ margin: "3px 0 0", fontSize: "10px", color: "#9685B0" }}>{timeAgo(n.updatedAt)}</p>
              <button onClick={e => { e.stopPropagation(); deleteNote(n.id); }}
                style={{ position: "absolute", top: "6px", right: "6px", background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#C4A8E0", opacity: 0.7, lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!active ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
              <span style={{ fontSize: "48px" }}>📔</span>
              <p style={{ margin: 0, color: "#9685B0", fontSize: "14px" }}>select or create a note</p>
              <button onClick={createNote}
                style={{ background: "linear-gradient(135deg, #7654A8, #A870D8)", border: "none", borderRadius: "16px", padding: "12px 24px", color: "white", cursor: "pointer", fontSize: "14px", fontWeight: 600 }}>create first note 💜</button>
            </div>
          ) : (
            <>
              {/* Note Title */}
              <div style={{ padding: "10px 14px 6px", borderBottom: "1px solid rgba(255,255,255,.6)" }}>
                {editingTitle ? (
                  <input autoFocus value={active.title}
                    onChange={e => updateNote(active.id, { title: e.target.value })}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={e => e.key === "Enter" && setEditingTitle(false)}
                    style={{ width: "100%", background: "transparent", border: "none", borderBottom: "1.5px solid #C4A8E0", fontSize: "15px", fontWeight: 600, color: "#5A3E8A", outline: "none", padding: "2px 0" }} />
                ) : (
                  <p onClick={() => setEditingTitle(true)}
                    style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#5A3E8A", cursor: "pointer" }}>{active.title} ✏️</p>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,.6)", background: "rgba(255,255,255,.3)" }}>
                {(["write", "style", "draw"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    style={{ flex: 1, padding: "10px 4px", border: "none", background: "none", cursor: "pointer", fontSize: "12px", fontWeight: tab === t ? 700 : 400, color: tab === t ? "#7654A8" : "#9685B0", borderBottom: tab === t ? "2px solid #7654A8" : "2px solid transparent", transition: "all .2s" }}>
                    {t === "write" ? "✏️ write" : t === "style" ? "🎨 style" : "🖌️ draw"}
                  </button>
                ))}
              </div>
              {/* Tab Content */}
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

                {/* Write Tab */}
                {tab === "write" && (
                  <textarea
                    value={active.text}
                    onChange={e => updateNote(active.id, { text: e.target.value })}
                    placeholder="start writing... 💜"
                    style={{
                      flex: 1, width: "100%", padding: "16px", border: "none", outline: "none",
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
                  <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>

                    {/* Font Family */}
                    <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 600, color: "#9685B0", textTransform: "uppercase", letterSpacing: ".8px" }}>font</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                      {FONTS.map(f => (
                        <button key={f.value} onClick={() => updateStyle({ fontFamily: f.value })}
                          style={{ padding: "6px 12px", borderRadius: "12px", border: "1.5px solid", borderColor: active.textStyle.fontFamily === f.value ? "#7654A8" : "#DDD3F0", background: active.textStyle.fontFamily === f.value ? "rgba(118,84,168,.12)" : "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "12px", fontFamily: f.value, color: active.textStyle.fontFamily === f.value ? "#7654A8" : "#261B40" }}>
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {/* Font Size */}
                    <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 600, color: "#9685B0", textTransform: "uppercase", letterSpacing: ".8px" }}>size — {active.textStyle.fontSize}px</p>
                    <input type="range" min={10} max={32} value={active.textStyle.fontSize}
                      onChange={e => updateStyle({ fontSize: +e.target.value })}
                      style={{ width: "100%", marginBottom: "16px", accentColor: "#7654A8" }} />

                    {/* Style Buttons */}
                    <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 600, color: "#9685B0", textTransform: "uppercase", letterSpacing: ".8px" }}>style</p>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                      {[
                        { label: "B", key: "bold", style: { fontWeight: 700 } },
                        { label: "I", key: "italic", style: { fontStyle: "italic" } },
                        { label: "U", key: "underline", style: { textDecoration: "underline" } },
                      ].map(({ label, key, style: s }) => (
                        <button key={key} onClick={() => updateStyle({ [key]: !active.textStyle[key as keyof TextStyle] })}
                          style={{ width: "40px", height: "40px", borderRadius: "12px", border: "1.5px solid", borderColor: active.textStyle[key as keyof TextStyle] ? "#7654A8" : "#DDD3F0", background: active.textStyle[key as keyof TextStyle] ? "rgba(118,84,168,.15)" : "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "15px", color: active.textStyle[key as keyof TextStyle] ? "#7654A8" : "#261B40", ...s }}>
                          {label}
                        </button>
                      ))}
                      {(["left", "center", "right"] as const).map(a => (
                        <button key={a} onClick={() => updateStyle({ align: a })}
                          style={{ width: "40px", height: "40px", borderRadius: "12px", border: "1.5px solid", borderColor: active.textStyle.align === a ? "#7654A8" : "#DDD3F0", background: active.textStyle.align === a ? "rgba(118,84,168,.15)" : "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "14px" }}>
                          {a === "left" ? "⬅" : a === "center" ? "↔" : "➡"}
                        </button>
                      ))}
                    </div>

                    {/* Line Height */}
                    <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: 600, color: "#9685B0", textTransform: "uppercase", letterSpacing: ".8px" }}>line height — {active.textStyle.lineHeight}</p>
                    <input type="range" min={1} max={3} step={0.1} value={active.textStyle.lineHeight}
                      onChange={e => updateStyle({ lineHeight: +e.target.value })}
                      style={{ width: "100%", marginBottom: "16px", accentColor: "#7654A8" }} />

                    {/* Text Color */}
                    <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 600, color: "#9685B0", textTransform: "uppercase", letterSpacing: ".8px" }}>text color</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                      {COLORS.map(c => (
                        <button key={c} onClick={() => updateStyle({ color: c })}
                          style={{ width: "28px", height: "28px", borderRadius: "50%", background: c, border: active.textStyle.color === c ? "3px solid #7654A8" : "2px solid rgba(0,0,0,.1)", cursor: "pointer", boxShadow: c === "#ffffff" ? "0 0 0 1px #DDD3F0" : "none" }} />
                      ))}
                    </div>

                    {/* Highlight */}
                    <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 600, color: "#9685B0", textTransform: "uppercase", letterSpacing: ".8px" }}>highlight</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                      {HIGHLIGHTS.map(c => (
                        <button key={c} onClick={() => updateStyle({ highlight: c })}
                          style={{ width: "28px", height: "28px", borderRadius: "8px", background: c === "transparent" ? "white" : c, border: active.textStyle.highlight === c ? "3px solid #7654A8" : "2px solid rgba(0,0,0,.1)", cursor: "pointer", fontSize: c === "transparent" ? "12px" : "0" }}>
                          {c === "transparent" ? "✕" : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Draw Tab */}
                {tab === "draw" && (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                    {/* Draw Toolbar */}
                    <div style={{ padding: "8px 12px", background: "rgba(255,255,255,.4)", borderBottom: "1px solid rgba(255,255,255,.6)", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>

                      {/* Tools */}
                      <div style={{ display: "flex", gap: "4px" }}>
                        {([
                          { id: "pencil", icon: "✏️" },
                          { id: "pen",    icon: "🖊️" },
                          { id: "highlighter", icon: "🖍️" },
                          { id: "eraser", icon: "🗑️" },
                        ] as const).map(({ id, icon }) => (
                          <button key={id} onClick={() => setTool(id)}
                            style={{ width: "36px", height: "36px", borderRadius: "10px", border: "1.5px solid", borderColor: tool === id ? "#7654A8" : "#DDD3F0", background: tool === id ? "rgba(118,84,168,.15)" : "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "16px" }}>
                            {icon}
                          </button>
                        ))}
                      </div>

                      {/* Brush Size */}
                      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                        {[0, 1, 2, 3].map(s => (
                          <button key={s} onClick={() => setBrushSize(s)}
                            style={{ width: "32px", height: "32px", borderRadius: "10px", border: "1.5px solid", borderColor: brushSize === s ? "#7654A8" : "#DDD3F0", background: brushSize === s ? "rgba(118,84,168,.15)" : "rgba(255,255,255,.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: BRUSH_SIZES[s] * 0.8, height: BRUSH_SIZES[s] * 0.8, borderRadius: "50%", background: "#7654A8", maxWidth: "16px", maxHeight: "16px" }} />
                          </button>
                        ))}
                      </div>

                      {/* Color */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {COLORS.slice(0, 8).map(c => (
                          <button key={c} onClick={() => setDrawColor(c)}
                            style={{ width: "22px", height: "22px", borderRadius: "50%", background: c, border: drawColor === c ? "2.5px solid #7654A8" : "1.5px solid rgba(0,0,0,.1)", cursor: "pointer" }} />
                        ))}
                        <input type="color" value={drawColor} onChange={e => setDrawColor(e.target.value)}
                          style={{ width: "22px", height: "22px", borderRadius: "50%", border: "none", cursor: "pointer", padding: 0 }} />
                      </div>

                      {/* Opacity */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: "80px" }}>
                        <span style={{ fontSize: "10px", color: "#9685B0" }}>opacity</span>
                        <input type="range" min={0.1} max={1} step={0.05} value={opacity}
                          onChange={e => setOpacity(+e.target.value)}
                          style={{ flex: 1, accentColor: "#7654A8" }} />
                      </div>

                      {/* Clear */}
                      <button onClick={clearCanvas}
                        style={{ padding: "6px 12px", borderRadius: "10px", border: "1.5px solid #DDD3F0", background: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "11px", color: "#9685B0", fontWeight: 600 }}>clear</button>
                    </div>

                    {/* Canvas */}
                    <canvas ref={canvasRef}
                      style={{ flex: 1, width: "100%", touchAction: "none", background: "rgba(255,255,255,.5)", cursor: tool === "eraser" ? "cell" : "crosshair" }}
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