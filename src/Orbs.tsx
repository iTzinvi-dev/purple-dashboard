// Replaces the old per-frame canvas of petals with a few large blurred CSS gradient orbs.
// All animation is GPU-composited (transform/opacity), pauses automatically when tab is hidden,
// and respects prefers-reduced-motion via the global CSS rule.

const ORBS = [
  { size: 380, top:  "8%",  left:  "-12%", c1: "#E9C9F4", c2: "#C9A6E8", dur: 26, delay: 0 },
  { size: 320, top: "62%",  left:  "70%",  c1: "#F4D5EE", c2: "#D5B4EE", dur: 32, delay: -8 },
  { size: 260, top: "30%",  left:  "55%",  c1: "#DCC2F2", c2: "#B98FDF", dur: 28, delay: -14 },
  { size: 220, top: "85%",  left:  "-10%", c1: "#EBD4F8", c2: "#C4A4E6", dur: 30, delay: -4 },
];

export default function Orbs({ darkMode = false }: { darkMode?: boolean }) {
  return (
    <div aria-hidden className="orb-layer" style={{
      position: "fixed", inset: 0, zIndex: 0,
      pointerEvents: "none", overflow: "hidden",
    }}>
      {ORBS.map((o, i) => (
        <div
          key={i}
          className="orb"
          style={{
            position: "absolute",
            top: o.top,
            left: o.left,
            width: o.size,
            height: o.size,
            borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, ${o.c1}, ${o.c2} 70%, transparent 100%)`,
            filter: "blur(60px)",
            opacity: darkMode ? 0.32 : 0.55,
            animation: `orbDrift ${o.dur}s ease-in-out ${o.delay}s infinite alternate`,
            willChange: "transform",
            mixBlendMode: darkMode ? "screen" : "normal",
          }}
        />
      ))}
    </div>
  );
}
