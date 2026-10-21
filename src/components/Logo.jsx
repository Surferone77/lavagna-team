// Logo The Hybrid One: scudo inclinato con monogramma "H1".
export const LIME = "#B8FF2C";

// Solo lo scudo (sfondo trasparente)
export function ShieldMark({ size = 40, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={style} aria-hidden="true">
      <g transform="translate(100 104) skewX(-10) translate(-100 -104)">
        <path d="M100 18 L170 43 L164 118 C160 152,133 174,100 186 C67 174,40 152,36 118 L30 43 Z" fill="#111" stroke={LIME} strokeWidth="8" strokeLinejoin="round" />
        <path d="M60 60 h22 v35 h21 v-35 h22 v96 h-22 v-40 h-21 v40 h-22 z" fill="#fff" />
        <path d="M128 78 l19 -18 h15 v96 h-22 v-64 l-12 10 z" fill={LIME} stroke="#111" strokeWidth="4" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// Icona dell'app: scudo su fondo nero arrotondato
export function AppIcon({ size = 48, style }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.225, background: "radial-gradient(120% 120% at 30% 20%, #232323 0%, #0a0a0a 60%)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.06)", flexShrink: 0, ...style }}>
      <ShieldMark size={size * 0.86} />
    </div>
  );
}

// Scritta "THE HYBRID ONE"
export function Wordmark({ size = 18, stacked = false }) {
  const s = { fontWeight: 900, letterSpacing: -0.3, lineHeight: 1, fontSize: size, color: "#fff", fontStyle: "italic" };
  return stacked
    ? <div style={s}><div style={{ fontSize: size * 0.5, letterSpacing: 2.5, color: "#9a9a9a", fontStyle: "normal", marginBottom: 3 }}>THE</div>HYBRID <span style={{ color: LIME }}>ONE</span></div>
    : <div style={s}>THE HYBRID <span style={{ color: LIME }}>ONE</span></div>;
}
