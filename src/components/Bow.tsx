export default function Bow({ size = 28, color = "#C4A8E0" }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 60 36" fill="none">
      <path d="M30 18 C20 8, 2 4, 2 18 C2 28, 20 28, 30 18Z" fill={color} opacity=".9"/>
      <path d="M30 18 C40 8, 58 4, 58 18 C58 28, 40 28, 30 18Z" fill={color} opacity=".9"/>
      <circle cx="30" cy="18" r="4" fill={color}/>
      <path d="M28 20 C26 26, 22 32, 18 34" stroke={color} strokeWidth="2" strokeLinecap="round" opacity=".6"/>
      <path d="M32 20 C34 26, 38 32, 42 34" stroke={color} strokeWidth="2" strokeLinecap="round" opacity=".6"/>
    </svg>
  );
}
