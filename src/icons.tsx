import type { ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bird,
  BookOpen,
  Cake,
  CheckCircle2,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Coffee,
  Download,
  Eraser,
  ExternalLink,
  Eye,
  Feather,
  Flame,
  Flower2,
  Gift,
  Headphones,
  Heart,
  Highlighter,
  Home,
  ListMusic,
  Lock,
  Moon,
  MoonStar,
  MoreHorizontal,
  Music2,
  NotebookPen,
  Palette,
  Pause,
  PenLine,
  PenTool,
  Pencil,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Settings,
  ShieldAlert,
  SkipBack,
  SkipForward,
  Sliders,
  Snowflake,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  Undo2,
  Unlock,
  Upload,
  Waves,
  WifiOff,
  X,
  Zap,
} from "lucide-react";

export {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bird,
  BookOpen,
  Cake,
  CheckCircle2,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Coffee,
  Download,
  Eraser,
  ExternalLink,
  Eye,
  Feather,
  Flame,
  Flower2,
  Gift,
  Headphones,
  Heart,
  Highlighter,
  Home,
  ListMusic,
  Lock,
  Moon,
  MoonStar,
  MoreHorizontal,
  Music2,
  NotebookPen,
  Palette,
  Pause,
  PenLine,
  PenTool,
  Pencil,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Settings,
  ShieldAlert,
  SkipBack,
  SkipForward,
  Sliders,
  Snowflake,
  Sparkles,
  Sun,
  Timer,
  Trash2,
  Undo2,
  Unlock,
  Upload,
  Waves,
  WifiOff,
  X,
  Zap,
};

export type WeatherKind =
  | "clear"
  | "mainly-clear"
  | "partly-cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "storm";

export type MoodId =
  | "grateful"
  | "peaceful"
  | "motivated"
  | "in my flow"
  | "happy"
  | "creative"
  | "tired";

export function IconBadge({
  children,
  size = 40,
  radius = 14,
  active = false,
  className = "",
}: {
  children: ReactNode;
  size?: number;
  radius?: number;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: active
          ? "linear-gradient(135deg, #7654A8, #B07ADE)"
          : "var(--accent-soft)",
        color: active ? "#FFFFFF" : "var(--accent)",
        border: active
          ? "1px solid rgba(255, 255, 255, 0.28)"
          : "1px solid var(--border-soft)",
        boxShadow: active
          ? "0 6px 18px rgba(118, 84, 168, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.35)"
          : "inset 0 1px 0 rgba(255, 255, 255, 0.4)",
      }}
    >
      {children}
    </span>
  );
}

export function HeartMark({
  filled = false,
  size = 15,
  className = "",
}: {
  filled?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <Heart
      size={size}
      strokeWidth={2}
      className={className}
      style={{
        color: filled ? "var(--accent)" : "var(--text-faint)",
        fill: filled ? "var(--accent)" : "transparent",
        transition: "transform 0.2s cubic-bezier(0.22, 0.61, 0.36, 1), color 0.2s ease",
        flexShrink: 0,
      }}
    />
  );
}

export function Bow({ size = 28, color = "#C4A8E0" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size * 0.65}
      viewBox="0 0 60 38"
      fill="none"
      aria-hidden
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      <path
        d="M30 19C20 7 3 4 3 18.5C3 28.5 19.5 29 30 19Z"
        fill={color}
        fillOpacity="0.24"
        stroke={color}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M30 19C40 7 57 4 57 18.5C57 28.5 40.5 29 30 19Z"
        fill={color}
        fillOpacity="0.24"
        stroke={color}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M27.5 21.5C25 27.5 21 32.5 16.5 35.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M32.5 21.5C35 27.5 39 32.5 43.5 35.5"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <rect
        x="26.5"
        y="15"
        width="7"
        height="8"
        rx="3.5"
        fill={color}
      />
    </svg>
  );
}

export function Spark({
  size = 12,
  color = "#C4A8E0",
  cls = "twinkle",
}: {
  size?: number;
  color?: string;
  cls?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cls}
      aria-hidden
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      <path
        d="M12 2L14.1 9.9L22 12L14.1 14.1L12 22L9.9 14.1L2 12L9.9 9.9L12 2Z"
        fill={color}
      />
    </svg>
  );
}

export function WeatherGlyph({
  kind,
  size = 28,
}: {
  kind: WeatherKind;
  size?: number;
}) {
  const props = {
    size,
    strokeWidth: 1.75,
    style: { color: "var(--accent)" },
  };
  switch (kind) {
    case "clear":
      return <Sun {...props} />;
    case "mainly-clear":
    case "partly-cloudy":
      return <CloudSun {...props} />;
    case "overcast":
      return <Cloud {...props} />;
    case "fog":
      return <CloudFog {...props} />;
    case "drizzle":
      return <CloudDrizzle {...props} />;
    case "rain":
      return <CloudRain {...props} />;
    case "snow":
      return <Snowflake {...props} />;
    case "storm":
      return <CloudLightning {...props} />;
    default:
      return <CloudSun {...props} />;
  }
}

export function MoodGlyph({
  mood,
  active = false,
  size = 14,
}: {
  mood: MoodId;
  active?: boolean;
  size?: number;
}) {
  const props = {
    size,
    strokeWidth: 1.85,
    style: {
      color: active ? "var(--accent)" : "var(--text-muted)",
      flexShrink: 0,
    },
  };
  switch (mood) {
    case "grateful":
      return <Flower2 {...props} />;
    case "peaceful":
      return <Feather {...props} />;
    case "motivated":
      return <Zap {...props} />;
    case "in my flow":
      return <Waves {...props} />;
    case "happy":
      return <Sparkles {...props} />;
    case "creative":
      return <Palette {...props} />;
    case "tired":
      return <MoonStar {...props} />;
  }
}
