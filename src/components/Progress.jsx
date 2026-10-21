import { Check } from "lucide-react";
import { GREEN } from "../lib/theme";

// Anello percentuale
export function Ring({ pct, size = 64, stroke = 8, font = 14 }) {
  const r = (size - stroke - 2) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }} role="img" aria-label={`${pct}% completato`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#262626" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={GREEN} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset .6s" }} />
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={font} fontWeight="900">{pct}%</text>
    </svg>
  );
}

// Barra percentuale sottile
export function Bar({ pct }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: "#262626", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: GREEN, borderRadius: 3, transition: "width .5s" }} />
    </div>
  );
}

// Cerchio "visto": tocca per segnare il blocco come completato
export function DoneCheck({ on, onClick, size = 30, label }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-pressed={on} aria-label={label || (on ? "Completato — tocca per annullare" : "Segna come completato")}
      style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0,
        background: on ? GREEN : "transparent", border: `2px solid ${on ? GREEN : "#555"}`, transition: "all .2s" }}>
      {on && <Check size={size * 0.6} color="#0b0b0b" strokeWidth={3.5} />}
    </button>
  );
}
