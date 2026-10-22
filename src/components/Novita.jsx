import { ChevronLeft, Sparkles } from "lucide-react";
import { CARD, LINE, MUTED, GREEN, h1 } from "../lib/theme";

const fmt = (iso) => new Date(iso).toLocaleDateString("it-CH", { day: "numeric", month: "long", year: "numeric" });

// Elenco delle novità dell'app (tabella changelog), dalla più recente
export default function Novita({ items, onBack }) {
  return (
    <div className="fade">
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 16px" }}>
        <button onClick={onBack} aria-label="Indietro" style={{ background: "#1c1c1c", border: `1px solid ${LINE}`, color: "#fff", width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronLeft size={20} /></button>
        <div style={{ ...h1, fontSize: 24 }}>Novità</div>
      </div>
      {!items.length && <div style={{ color: MUTED }}>Ancora nessuna novità.</div>}
      {items.map((n, i) => (
        <div key={n.id} style={{ background: CARD, border: `1px solid ${i === 0 ? "rgba(184,255,44,0.4)" : LINE}`, borderRadius: 18, padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Sparkles size={15} color={GREEN} />
            <span style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}>{fmt(n.created_at)}{n.version ? ` · v${n.version}` : ""}</span>
          </div>
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 900, marginBottom: 6 }}>{n.title}</div>
          {n.body && <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{n.body}</div>}
        </div>
      ))}
    </div>
  );
}
