import { useEffect, useRef } from "react";

/**
 * Lightweight ambient petals canvas.
 *  - Auto-tunes count by screen size and CPU cores
 *  - 24fps throttle (visually smooth, low CPU)
 *  - Pauses when tab is hidden or page is off-screen
 *  - Respects prefers-reduced-motion (renders one static frame)
 *  - Single simple shape (ellipse), no overdraw
 */

interface Petal {
  x: number; y: number;
  size: number; opacity: number;
  vx: number; vy: number;
  rot: number; vRot: number;
  swayAmp: number; swayFreq: number; swayPhase: number;
  color: string;
}

const COLORS = ["#E8C4F0", "#D4A8E8", "#C8A0E0", "#F0D4F8", "#DCA0E0"];

function newPetal(W: number, H: number, fromTop = false): Petal {
  const size = 3 + Math.random() * 7;
  return {
    x: Math.random() * W,
    y: fromTop ? -size * 2 : Math.random() * H,
    size,
    opacity: 0.32 + Math.random() * 0.4,
    vx: (Math.random() - 0.5) * 0.4,
    vy: 0.35 + Math.random() * 0.7,
    rot: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 0.018,
    swayAmp: 0.35 + Math.random() * 0.3,
    swayFreq: 0.006 + Math.random() * 0.008,
    swayPhase: Math.random() * Math.PI * 2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}

export default function PetalCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduced = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = window.innerWidth;
    let H = window.innerHeight;

    const setSize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setSize();

    // Auto-tune count: small phones get fewer petals
    const cores = (navigator.hardwareConcurrency ?? 4);
    const isSmall = W < 600;
    const baseCount = isSmall ? 10 : 18;
    const COUNT = cores <= 4 ? Math.floor(baseCount * 0.7) : baseCount;

    const petals: Petal[] = Array.from({ length: COUNT }, () => newPetal(W, H));
    let t = 0;
    let raf = 0;
    let last = performance.now();
    const targetMs = 1000 / 24; // 24fps is plenty for ambient

    let paused = document.hidden;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 0.55, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    const tick = (now: number) => {
      if (paused) return;
      const dt = now - last;
      if (dt < targetMs) {
        raf = requestAnimationFrame(tick);
        return;
      }
      last = now - (dt % targetMs);
      t++;

      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.x += p.vx + Math.sin(t * p.swayFreq + p.swayPhase) * p.swayAmp;
        p.y += p.vy;
        p.rot += p.vRot;
        if (p.y > H + 20 || p.x < -40 || p.x > W + 40) {
          Object.assign(p, newPetal(W, H, true));
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    const onResize = () => setSize();
    const onVisibility = () => {
      paused = document.hidden;
      if (!paused && !reduced) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) {
      draw(); // single static frame
    } else {
      raf = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.65,
      }}
    />
  );
}
