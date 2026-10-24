interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: "rect" | "star" | "circle";
  rotation: number;
  vRot: number;
  tilt: number;
  vTilt: number;
  opacity: number;
  decay: number;
}

const COLORS = [
  "#7654A8",
  "#B07ADE",
  "#C4A8E0",
  "#E8C4F0",
  "#FFD166",
  "#FFB703",
  "#F48FB1",
  "#FFFFFF",
];

export function triggerBirthdayConfetti(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const particles: Particle[] = [];
  const count = w < 600 ? 90 : 160;

  for (let i = 0; i < count; i++) {
    const isLeft = i % 2 === 0;
    const originX = isLeft ? w * 0.15 : w * 0.85;
    const originY = h * 0.72;
    const angle = isLeft
      ? -Math.PI / 3 + (Math.random() - 0.5) * 0.7
      : (-2 * Math.PI) / 3 + (Math.random() - 0.5) * 0.7;
    const speed = 10 + Math.random() * 16;
    const shapeRoll = Math.random();
    const shape = shapeRoll < 0.5 ? "rect" : shapeRoll < 0.8 ? "star" : "circle";

    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 5 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.18,
      tilt: Math.random() * Math.PI,
      vTilt: 0.05 + Math.random() * 0.08,
      opacity: 1,
      decay: 0.006 + Math.random() * 0.008,
    });
  }

  let animationFrameId: number;

  const drawStar = (cx: number, cy: number, size: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.quadraticCurveTo(cx, cy, cx + size, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + size);
    ctx.quadraticCurveTo(cx, cy, cx - size, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - size);
    ctx.fill();
  };

  const render = () => {
    ctx.clearRect(0, 0, w, h);
    let activeCount = 0;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.opacity <= 0) continue;

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.38;
      p.vx *= 0.985;
      p.rotation += p.vRot;
      p.tilt += p.vTilt;
      p.opacity -= p.decay;

      if (p.opacity > 0 && p.y < h + 40) {
        activeCount++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(Math.cos(p.tilt), 1);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;

        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
        } else if (p.shape === "star") {
          drawStar(0, 0, p.size * 1.1);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    if (activeCount > 0) {
      animationFrameId = requestAnimationFrame(render);
    } else {
      cancelAnimationFrame(animationFrameId);
      canvas.remove();
    }
  };

  animationFrameId = requestAnimationFrame(render);
}
