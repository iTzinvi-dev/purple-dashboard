export default function Spark({ size = 11, color = "#C4A8E0", cls = "twinkle" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cls}
      style={{ display: "inline-block", flexShrink: 0 }}>
      <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" fill={color}/>
    </svg>
  );
}
