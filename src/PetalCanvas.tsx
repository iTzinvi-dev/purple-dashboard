import { useEffect, useRef } from "react";

interface Petal {
  x: number; y: number;
  size: number; opacity: number;
  speedX: number; speedY: number;
  rotation: number; rotSpeed: number;
  swayAmp: number; swaySpeed: number; swayOffset: number;
  color: string; type: number;
}

const COLORS = [
  "#E8C4F0","#D4A8E8","#F0D4F8","#C8A0E0","#F8C8E8","#E0B8F0","#DCA0E0",
];

function drawPetal(ctx: CanvasRenderingContext2D, p: Petal) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.globalAlpha = p.opacity;

  if (p.type === 0) {
    // Cherry blossom petal — oval with indent
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.bezierCurveTo( p.size * 0.8, -p.size * 0.8,  p.size,  p.size * 0.2, 0,  p.size);
    ctx.bezierCurveTo(-p.size,        p.size * 0.2, -p.size * 0.8, -p.size * 0.8, 0, -p.size);
    ctx.fillStyle = p.color;
    ctx.fill();

    // Notch at top
    ctx.beginPath();
    ctx.moveTo(-p.size * 0.15, -p.size * 0.9);
    ctx.quadraticCurveTo(0, -p.size * 0.7, p.size * 0.15, -p.size * 0.9);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fill();

  } else if (p.type === 1) {
    // Round petal
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.55, p.size, 0, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();

  } else {
    // Thin long petal
    ctx.beginPath();
    ctx.moveTo(0, -p.size);
    ctx.bezierCurveTo(p.size * 0.4, -p.size * 0.3, p.size * 0.3, p.size * 0.5, 0, p.size);
    ctx.bezierCurveTo(-p.size * 0.3, p.size * 0.5, -p.size * 0.4, -p.size * 0.3, 0, -p.size);
    ctx.fillStyle = p.color;
    ctx.fill();
  }

  // Soft inner glow
  ctx.beginPath();
  ctx.ellipse(0, -p.size * 0.2, p.size * 0.25, p.size * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fill();

  ctx.restore();
}

function newPetal(W: number, H: number, fromTop = false): Petal {
  const size = 4 + Math.random() * 10;
  return {
    x:          Math.random() * W,
    y:          fromTop ? -size * 2 : Math.random() * H,
    size,
    opacity:    0.3 + Math.random() * 0.45,
    speedX:     (Math.random() - 0.5) * 0.5,
    speedY:     0.4 + Math.random() * 0.9,
    rotation:   Math.random() * Math.PI * 2,
    rotSpeed:   (Math.random() - 0.5) * 0.025,
    swayAmp:    20 + Math.random() * 35,
    swaySpeed:  0.006 + Math.random() * 0.01,
    swayOffset: Math.random() * Math.PI * 2,
    color:      COLORS[Math.floor(Math.random() * COLORS.length)],
    type:       Math.floor(Math.random() * 3),
  };
}

export default function PetalCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W; canvas.height = H;

    const COUNT = Math.min(38, Math.floor((W * H) / 14000));
    const petals: Petal[] = Array.from({ length: COUNT }, () => newPetal(W, H));
    let t = 0, raf: number;

    const onResize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W; canvas.height = H;
    };
    window.addEventListener("resize", onResize);

    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      t++;
      petals.forEach(p => {
        p.x += p.speedX + Math.sin(t * p.swaySpeed + p.swayOffset) * 0.5;
        p.y += p.speedY;
        p.rotation += p.rotSpeed;
        if (p.y > H + 20 || p.x < -40 || p.x > W + 40)
          Object.assign(p, newPetal(W, H, true));
        drawPetal(ctx, p);
      });
      if (t % 80 === 0 && petals.length < COUNT + 8)
        petals.push(newPetal(W, H, true));
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);

  return (
    <canvas ref={ref} style={{
      position: "fixed", inset: 0, zIndex: 0,
      pointerEvents: "none", opacity: 0.75,
    }} />
  );
}