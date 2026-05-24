import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";

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

type Tool = "pencil" | "pen" | "highlighter" | "eraser";

interface Stroke {
  tool: Tool;
  color: string;
  width: number;
  opacity: number;
  points: { x: number; y: number }[];
}

const FONTS = [
  { label: "DM Sans",   value: "'DM Sans', sans-serif" },
  { label: "Cormorant", value: "'Cormorant Garamond', serif" },
  { label: "Monospace", value: "'Courier New', monospace" },
  { label: "Cursive",   value: "'Dancing Script', cursive" },
  { label: "Rounded",   value: "'Nunito', sans-serif" },
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
const SAVE_DEBOUNCE_MS = 500;
const MAX_UNDO_DEPTH = 40;

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

let _webp: boolean | null = null;
const supportsWebp = (): boolean => {
  if (_webp !== null) return _webp;
  try {
    const c = document.createElement("canvas");
    c.width = 1; c.height = 1;
    _webp = c.toDataURL("image/webp").startsWith("data:image/webp");
  } catch { _webp = false; }
  return _webp;
};

const canvasToBest = (canvas: HTMLCanvasElement): string =>
  supportsWebp() ? canvas.toDataURL("image/webp", 0.85) : canvas.toDataURL("image/png");

// ─────────────── Drawing helpers ───────────────

interface DrawStyleArgs { tool: Tool; color: string; width: number; opacity: number; }

function applyStyle(ctx: CanvasRenderingContext2D, s: DrawStyleArgs) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (s.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = s.width * 3;
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.globalAlpha = 1;
  } else if (s.tool === "highlighter") {
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = s.width * 4;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 0.3 * s.opacity;
  } else if (s.tool === "pencil") {
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = s.width * 0.8;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 0.7 * s.opacity;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = s.width;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.globalAlpha = s.opacity;
  }
}

// Draw a smooth stroke with quadratic curves through midpoints.
function drawSmoothStroke(ctx: CanvasRenderingContext2D, st: Stroke) {
  const pts = st.points;
  if (pts.length === 0) return;
  applyStyle(ctx, st);
  ctx.beginPath();
  if (pts.length < 3) {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const cx = pts[i].x;
    const cy = pts[i].y;
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(cx, cy, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export default function NotesPage({ onBack }: { onBack?: () => void } = {}) {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const [activeId, setActiveId] = useState<string | null>(() => loadNotes()[0]?.id ?? null);
  const [tab, setTab] = useState<"write" | "style" | "draw">("write");
  const [tool, setTool] = useState<Tool>("pen");
  const [brushSize, setBrushSize] = useState(1);
  const [drawColor, setDrawColor] = useState("#7654A8");
  const [opacity, setOpacity] = useState(1);
  const [editingTitle, setEditingTitle] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // History force-render counter so React knows when undo/redo happens
  const [historyVersion, setHistoryVersion] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const cssSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const dprRef = useRef(1);

  // Tool refs to avoid stale closures inside native event listeners
  const toolRef = useRef<Tool>("pen");
  const drawColorRef = useRef("#7654A8");
  const brushSizeRef = useRef(1);
  const opacityRef = useRef(1);
  const activeIdRef = useRef<string | null>(null);

  // Drawing state — kept in refs to avoid re-renders during stroke
  const strokesRef = useRef<Stroke[]>([]);     // committed strokes (undo source)
  const redoRef = useRef<Stroke[]>([]);        // strokes available to redo
  const baseImgRef = useRef<HTMLImageElement | null>(null); // background dataURL if note had one
  const currentStrokeRef = useRef<Stroke | null>(null);
  const isDrawingRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = notes.find(n => n.id === activeId) ?? null;

  // Sync state into refs so native event listeners always read fresh values
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { drawColorRef.current = drawColor; }, [drawColor]);
  useEffect(() => { brushSizeRef.current = brushSize; }, [brushSize]);
  useEffect(() => { opacityRef.current = opacity; }, [opacity]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const persistNotes = useCallback((updated: Note[]) => {
    setNotes(updated);
    const ok = ls.set("notes_v2", JSON.stringify(updated));
    if (!ok) setStorageWarning("storage full — try clearing old notes");
    else setStorageWarning(null);
  }, []);

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    setNotes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n);
      const ok = ls.set("notes_v2", JSON.stringify(updated));
      if (!ok) setStorageWarning("storage full — try clearing old notes");
      return updated;
    });
  }, []);

  const createNote = () => {
    const n = newNote();
    persistNotes([n, ...notes]);
    setActiveId(n.id);
    setTab("write");
  };

  const deleteNote = (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    persistNotes(updated);
    if (activeId === id) setActiveId(updated[0]?.id ?? null);
  };

  const updateStyle = (patch: Partial<TextStyle>) => {
    if (!active) return;
    updateNote(active.id, { textStyle: { ...active.textStyle, ...patch } });
  };

  // ── Re-render full canvas from history ──
  const rerender = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { w, h } = cssSizeRef.current;
    if (w <= 0 || h <= 0) return;
    ctx.save();
    ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (baseImgRef.current) {
      ctx.drawImage(baseImgRef.current, 0, 0, w, h);
    }
    for (const st of strokesRef.current) drawSmoothStroke(ctx, st);
    ctx.restore();
  }, []);

  // ── Canvas resize / init — useLayoutEffect runs BEFORE paint, so the canvas
  // always has correct dimensions before the user can interact. ResizeObserver
  // handles any later resize (orientation, window) without losing the drawing.
  useLayoutEffect(() => {
    if (tab !== "draw") return;
    const canvas = canvasRef.current;
    const wrapper = canvasWrapperRef.current;
    if (!canvas || !wrapper) return;

    const setupCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrapper.getBoundingClientRect();
      // Defensive fallback: if wrapper isn't laid out yet, use a sensible default
      const cssW = rect.width  > 0 ? rect.width  : (window.innerWidth || 320);
      const cssH = rect.height > 0 ? rect.height : 360;

      canvas.width  = Math.max(1, Math.floor(cssW * dpr));
      canvas.height = Math.max(1, Math.floor(cssH * dpr));
      canvas.style.width  = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxRef.current = ctx;
      cssSizeRef.current = { w: cssW, h: cssH };
      dprRef.current = dpr;

      // Re-render existing content from history + base image
      rerender();
    };

    setupCanvas();
    const ro = new ResizeObserver(() => setupCanvas());
    ro.observe(wrapper);

    return () => ro.disconnect();
  }, [tab, rerender]);

  // Load note's saved drawing as the base image when the active note changes
  useEffect(() => {
    if (tab !== "draw") return;
    strokesRef.current = [];
    redoRef.current = [];
    // Forcing a re-render here is intentional — undo/redo button enablement
    // is derived from ref length and needs a render after we wipe history.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryVersion(v => v + 1);

    if (active?.drawing) {
      const img = new Image();
      img.onload = () => { baseImgRef.current = img; rerender(); };
      img.onerror = () => { baseImgRef.current = null; rerender(); };
      img.src = active.drawing;
    } else {
      baseImgRef.current = null;
      rerender();
    }
    // We deliberately ignore the active.drawing dep so that our own debounced
    // saves don't bounce back and wipe in-progress strokes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const queueSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const canvas = canvasRef.current;
      const id = activeIdRef.current;
      if (!canvas || !id) return;
      const dataUrl = canvasToBest(canvas);
      updateNote(id, { drawing: dataUrl });
    }, SAVE_DEBOUNCE_MS);
  }, [updateNote]);

  // ── Native pointer event listeners attached directly to the canvas DOM node ──
  // Native non-passive listeners are more reliable than React synthetic events
  // for drawing (some mobile browsers throttle synthetics or treat them as
  // passive, which silently breaks preventDefault).
  useEffect(() => {
    if (tab !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== undefined && e.button !== 0) return; // only primary
      const ctx = ctxRef.current;
      if (!ctx) return;
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      isDrawingRef.current = true;

      const stroke: Stroke = {
        tool: toolRef.current,
        color: drawColorRef.current,
        width: BRUSH_SIZES[brushSizeRef.current],
        opacity: opacityRef.current,
        points: [getPos(e)],
      };
      currentStrokeRef.current = stroke;

      // Tap leaves a mark
      applyStyle(ctx, stroke);
      ctx.beginPath();
      ctx.arc(stroke.points[0].x, stroke.points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const onMove = (e: PointerEvent) => {
      if (!isDrawingRef.current) return;
      const ctx = ctxRef.current;
      const stroke = currentStrokeRef.current;
      if (!ctx || !stroke) return;
      e.preventDefault();

      const events = (e as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] })
        .getCoalescedEvents?.() ?? [e];

      applyStyle(ctx, stroke);
      for (const ev of events) {
        const pos = getPos(ev);
        const last = stroke.points[stroke.points.length - 1];
        const dx = pos.x - last.x;
        const dy = pos.y - last.y;
        if (dx * dx + dy * dy < 1) continue;
        stroke.points.push(pos);

        if (stroke.points.length >= 3) {
          const a = stroke.points[stroke.points.length - 3];
          const b = stroke.points[stroke.points.length - 2];
          const c = stroke.points[stroke.points.length - 1];
          const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
          ctx.beginPath();
          ctx.moveTo(m1.x, m1.y);
          ctx.quadraticCurveTo(b.x, b.y, m2.x, m2.y);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(last.x, last.y);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    };

    const onUp = (e: PointerEvent) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      const stroke = currentStrokeRef.current;
      if (stroke && stroke.points.length > 0) {
        strokesRef.current.push(stroke);
        if (strokesRef.current.length > MAX_UNDO_DEPTH) strokesRef.current.shift();
        redoRef.current = [];
        setHistoryVersion(v => v + 1);
      }
      currentStrokeRef.current = null;
      queueSave();
    };

    const opts: AddEventListenerOptions = { passive: false };
    canvas.addEventListener("pointerdown", onDown, opts);
    canvas.addEventListener("pointermove", onMove, opts);
    canvas.addEventListener("pointerup", onUp, opts);
    canvas.addEventListener("pointercancel", onUp, opts);
    canvas.addEventListener("pointerleave", onUp, opts);

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onUp);
    };
  }, [tab, queueSave]);

  const undo = () => {
    if (strokesRef.current.length === 0) return;
    const popped = strokesRef.current.pop()!;
    redoRef.current.push(popped);
    setHistoryVersion(v => v + 1);
    rerender();
    queueSave();
  };

  const redo = () => {
    if (redoRef.current.length === 0) return;
    const popped = redoRef.current.pop()!;
    strokesRef.current.push(popped);
    setHistoryVersion(v => v + 1);
    rerender();
    queueSave();
  };

  const clearCanvas = () => {
    if (!ctxRef.current || !canvasRef.current) return;
    const { w, h } = cssSizeRef.current;
    ctxRef.current.clearRect(0, 0, w, h);
    strokesRef.current = [];
    redoRef.current = [];
    baseImgRef.current = null;
    setHistoryVersion(v => v + 1);
    if (active) updateNote(active.id, { drawing: "" });
  };

  // Read undo/redo availability via refs. We force a re-render whenever the
  // history changes (via setHistoryVersion), so by the time render runs these
  // ref values are guaranteed to be up to date for the buttons.
  // eslint-disable-next-line react-hooks/refs
  const canUndo = strokesRef.current.length > 0;
  // eslint-disable-next-line react-hooks/refs
  const canRedo = redoRef.current.length > 0;

  const [now] = useState(() => Date.now());
  const timeAgo = (ts: number) => {
    const diff = now - ts;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="page-surface" style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Header */}
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 10px" }}>
        {onBack && (
          <button onClick={onBack} aria-label="back" className="icon-button"
            style={{ background: "var(--bg-card-soft)", border: "1px solid var(--border-card)", borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18, color: "var(--text-secondary)", flexShrink: 0 }}>←</button>
        )}
        <h1 style={{ margin: 0, fontSize: 22, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", color: "var(--text-secondary)", flex: 1 }}>my notes</h1>
        <button onClick={createNote} className="btn-purple shimmer-press"
          style={{ borderRadius: 14, padding: "8px 16px", fontSize: 13, fontWeight: 600 }}>+ new</button>
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
              className="interactive-option"
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
              <span style={{ fontSize: 48 }} className="float">📔</span>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>select or create a note</p>
              <button onClick={createNote} className="btn-purple shimmer-press"
                style={{ borderRadius: 16, padding: "12px 24px", fontSize: 14, fontWeight: 600 }}>create first note 💜</button>
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
              <div className="tab-rail-underline" style={{ display: "flex", borderBottom: "1px solid var(--border-card)", background: "var(--bg-card-soft)", position: "relative" }}>
                <span className="tab-pill" aria-hidden style={{
                  left: `calc(${["write", "style", "draw"].indexOf(tab)} * (100% / 3))`,
                  width: "calc(100% / 3)",
                }} />
                {(["write", "style", "draw"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    style={{ flex: 1, padding: "10px 4px", border: "none", background: "none", cursor: "pointer", fontSize: 12, fontWeight: tab === t ? 700 : 400, color: tab === t ? "var(--accent)" : "var(--text-muted)", transition: "color .2s ease, font-weight .2s ease", position: "relative", zIndex: 1 }}>
                    {t === "write" ? "✏️ write" : t === "style" ? "🎨 style" : "🖌️ draw"}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div key={tab} className="tab-content" style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>

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

                {tab === "style" && (
                  <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>

                    <SectionLabel>font</SectionLabel>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                      {FONTS.map(f => (
                        <button key={f.value} onClick={() => updateStyle({ fontFamily: f.value })}
                          className={`option-chip ${active.textStyle.fontFamily === f.value ? "is-selected" : ""}`}
                          style={{
                            padding: "6px 12px", borderRadius: 12,
                            border: "1.5px solid",
                            borderColor: active.textStyle.fontFamily === f.value ? "var(--accent)" : "var(--border-soft)",
                            background: active.textStyle.fontFamily === f.value ? "var(--accent-soft)" : "var(--bg-input)",
                            cursor: "pointer", fontSize: 12, fontFamily: f.value,
                            color: active.textStyle.fontFamily === f.value ? "var(--accent)" : "var(--text-primary)",
                          }}>{f.label}</button>
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
                            className={`option-chip ${enabled ? "is-selected" : ""}`}
                            style={{
                              width: 40, height: 40, borderRadius: 12,
                              border: "1.5px solid",
                              borderColor: enabled ? "var(--accent)" : "var(--border-soft)",
                              background: enabled ? "var(--accent-soft)" : "var(--bg-input)",
                              cursor: "pointer", fontSize: 15,
                              color: enabled ? "var(--accent)" : "var(--text-primary)",
                              ...css,
                            }}>{label}</button>
                        );
                      })}
                      {(["left", "center", "right"] as const).map(a => (
                        <button key={a} onClick={() => updateStyle({ align: a })}
                          className={`option-chip ${active.textStyle.align === a ? "is-selected" : ""}`}
                          style={{
                            width: 40, height: 40, borderRadius: 12,
                            border: "1.5px solid",
                            borderColor: active.textStyle.align === a ? "var(--accent)" : "var(--border-soft)",
                            background: active.textStyle.align === a ? "var(--accent-soft)" : "var(--bg-input)",
                            cursor: "pointer", fontSize: 14,
                            color: "var(--text-primary)",
                          }}>{a === "left" ? "⬅" : a === "center" ? "↔" : "➡"}</button>
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
                          className={`option-chip ${active.textStyle.color === c ? "is-selected" : ""}`}
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
                          className={`option-chip ${active.textStyle.highlight === c ? "is-selected" : ""}`}
                          style={{
                            width: 28, height: 28, borderRadius: 8,
                            background: c === "transparent" ? "var(--bg-input)" : c,
                            border: active.textStyle.highlight === c ? "3px solid var(--accent)" : "2px solid rgba(0,0,0,.1)",
                            cursor: "pointer", fontSize: c === "transparent" ? 12 : 0,
                            color: "var(--text-muted)",
                          }}>{c === "transparent" ? "✕" : ""}</button>
                      ))}
                    </div>
                  </div>
                )}

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
                            className={`option-chip ${tool === id ? "is-selected" : ""}`}
                            style={{
                              width: 36, height: 36, borderRadius: 10,
                              border: "1.5px solid",
                              borderColor: tool === id ? "var(--accent)" : "var(--border-soft)",
                              background: tool === id ? "var(--accent-soft)" : "var(--bg-input)",
                              cursor: "pointer", fontSize: 16,
                            }}>{icon}</button>
                        ))}
                      </div>

                      <div style={{ display: "flex", gap: 4 }}>
                        {[0, 1, 2, 3].map(s => (
                          <button key={s} onClick={() => setBrushSize(s)}
                            className={`option-chip ${brushSize === s ? "is-selected" : ""}`}
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

                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 70 }}>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>opacity</span>
                        <input type="range" min={0.1} max={1} step={0.05} value={opacity}
                          onChange={e => setOpacity(+e.target.value)}
                          style={{ flex: 1, accentColor: "#7654A8" }} />
                      </div>

                      {/* Undo / Redo / Clear */}
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={undo} disabled={!canUndo} aria-label="undo"
                          className="icon-button"
                          style={{
                            width: 36, height: 36, borderRadius: 10,
                            border: "1.5px solid var(--border-soft)",
                            background: "var(--bg-input)",
                            cursor: canUndo ? "pointer" : "not-allowed",
                            opacity: canUndo ? 1 : 0.4,
                            fontSize: 14, color: "var(--text-secondary)",
                          }}>↶</button>
                        <button onClick={redo} disabled={!canRedo} aria-label="redo"
                          className="icon-button"
                          style={{
                            width: 36, height: 36, borderRadius: 10,
                            border: "1.5px solid var(--border-soft)",
                            background: "var(--bg-input)",
                            cursor: canRedo ? "pointer" : "not-allowed",
                            opacity: canRedo ? 1 : 0.4,
                            fontSize: 14, color: "var(--text-secondary)",
                          }}>↷</button>
                        <button onClick={clearCanvas}
                          style={{
                            padding: "6px 12px", borderRadius: 10,
                            border: "1.5px solid var(--border-soft)",
                            background: "var(--bg-input)",
                            cursor: "pointer", fontSize: 11,
                            color: "var(--text-muted)", fontWeight: 600,
                          }}>clear</button>
                      </div>
                    </div>

                    {/* Canvas — wrapper has explicit relative positioning,
                        canvas absolutely fills it. This guarantees correct
                        dimensions even if flex layout would otherwise leave
                        the canvas at 0×0 on first render. Native pointer
                        listeners are attached via useEffect above. */}
                    <div ref={canvasWrapperRef}
                      style={{
                        flex: 1,
                        position: "relative",
                        minHeight: 240,
                        background: "var(--bg-canvas)",
                        touchAction: "none",
                        overflow: "hidden",
                      }}>
                      <canvas ref={canvasRef}
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          display: "block",
                          touchAction: "none",
                          cursor: tool === "eraser" ? "cell" : "crosshair",
                        }}
                      />
                    </div>
                    {/* Hidden marker so React tracks history changes for the buttons */}
                    <span style={{ display: "none" }} data-history={historyVersion} />
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
