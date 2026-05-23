import type { ReactNode } from "react";

export default function GlassCard({ children, radius = 26 }: { children: ReactNode; radius?: number }) {
  return (
    <div className="glass-card" style={{ borderRadius: radius }}>
      {children}
    </div>
  );
}
