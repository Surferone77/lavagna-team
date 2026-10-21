import { useState } from "react";
import { Percent, ArrowLeftRight, Timer as TimerIcon } from "lucide-react";
import { TimerSetup, TimerScreen } from "./Timer";
import { GREEN, CARD, LINE, MUTED, inp, pill, pillOn, h1 } from "../lib/theme";

const LB = 0.45359237;
const PERCENTS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
const COMMON_LB = [15, 20, 25, 35, 45, 53, 55, 65, 70, 95, 100, 115, 135, 155, 185, 205, 225];
const num = (s) => { const n = Number(String(s).replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };
const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString("it-CH", { maximumFractionDigits: d });
// arrotonda al carico caricabile sul bilanciere (passo 0,5 / 1 / 2,5 kg)
const roundTo = (n, step) => Math.round(n / step) * step;

const box = { background: CARD, border: `1px solid ${LINE}`, borderRadius: 20, padding: 16, marginBottom: 14 };
const head = { display: "flex", alignItems: "center", gap: 8, color: "#fff", fontSize: 17, fontWeight: 800, marginBottom: 12 };

export default function Utility() {
  return (
    <div>
      <div style={{ ...h1, margin: "20px 0 16px" }}>Utility</div>
      <TimerCard />
      <Percentuali />
      <Conversione />
    </div>
  );
}

function TimerCard() {
  const [running, setRunning] = useState(null);
  return (
    <div style={box}>
      <div style={head}><TimerIcon size={18} color={GREEN} /> Timer</div>
      <TimerSetup onStart={setRunning} />
      {running && <TimerScreen config={running} onClose={() => setRunning(null)} />}
    </div>
  );
}

function Percentuali() {
  const [w, setW] = useState("");
  const [unit, setUnit] = useState("kg");
  const [step, setStep] = useState(0.5);
  const base = num(w);
  return (
    <div style={box}>
      <div style={head}><Percent size={18} color={GREEN} /> Percentuali del massimale</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={w} onChange={e => setW(e.target.value)} inputMode="decimal" placeholder="Il tuo 1RM, es. 100"
          aria-label="Peso" style={{ ...inp, flex: 1, minWidth: 0, fontSize: 20, fontWeight: 800 }} />
        {["kg", "lb"].map(u => <button key={u} onClick={() => setUnit(u)} style={{ ...pill, padding: "9px 14px", ...(unit === u ? pillOn : {}) }}>{u}</button>)}
      </div>
      {unit === "kg" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <span style={{ color: MUTED, fontSize: 12.5 }}>Arrotonda a</span>
          {[0.5, 1, 2.5].map(s => <button key={s} onClick={() => setStep(s)} style={{ ...pill, padding: "4px 10px", ...(step === s ? pillOn : {}) }}>{fmt(s)} kg</button>)}
        </div>
      )}
      {base ? (
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {PERCENTS.map(p => {
            const v = (base * p) / 100;
            const shown = unit === "kg" ? roundTo(v, step) : Math.round(v);
            const other = unit === "kg" ? `${fmt(shown / LB, 0)} lb` : `${fmt(shown * LB)} kg`;
            const hot = p >= 85;
            return (
              <div key={p} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6, background: p === 100 ? "rgba(184,255,44,0.12)" : "#1c1c1c", border: `1px solid ${p === 100 ? "rgba(184,255,44,0.4)" : "transparent"}`, borderRadius: 12, padding: "10px 12px" }}>
                <span style={{ color: hot ? GREEN : MUTED, fontWeight: 800, fontSize: 14 }}>{p}%</span>
                <span style={{ textAlign: "right" }}>
                  <span style={{ color: "#fff", fontWeight: 900, fontSize: 18, fontVariantNumeric: "tabular-nums" }}>{fmt(shown)} {unit}</span>
                  <span style={{ display: "block", color: "#666", fontSize: 11 }}>{other}</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : <div style={{ color: MUTED, fontSize: 13.5, marginTop: 12 }}>Inserisci un peso per vedere la tabella dal 50% al 100%.</div>}
    </div>
  );
}

function Conversione() {
  const [lb, setLb] = useState("");
  const [kg, setKg] = useState("");
  const fromLb = (v) => { setLb(v); const n = num(v); setKg(n ? fmt(n * LB, 2) : ""); };
  const fromKg = (v) => { setKg(v); const n = num(v); setLb(n ? fmt(n / LB, 1) : ""); };
  const field = { ...inp, width: "100%", fontSize: 20, fontWeight: 800, textAlign: "center" };
  return (
    <div style={box}>
      <div style={head}><ArrowLeftRight size={18} color={GREEN} /> Libbre ⇄ chili</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input value={lb} onChange={e => fromLb(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Libbre" style={field} />
          <div style={{ color: MUTED, fontSize: 12, textAlign: "center", marginTop: 4, fontWeight: 700 }}>lb</div>
        </div>
        <ArrowLeftRight size={18} color={MUTED} style={{ flexShrink: 0, marginBottom: 18 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <input value={kg} onChange={e => fromKg(e.target.value)} inputMode="decimal" placeholder="0" aria-label="Chili" style={field} />
          <div style={{ color: MUTED, fontSize: 12, textAlign: "center", marginTop: 4, fontWeight: 700 }}>kg</div>
        </div>
      </div>
      <div style={{ color: MUTED, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "16px 0 8px" }}>Pesi comuni nei WOD</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {COMMON_LB.map(v => (
          <button key={v} onClick={() => fromLb(String(v))} style={{ background: "#1c1c1c", border: `1px solid ${LINE}`, borderRadius: 10, padding: "8px 4px", cursor: "pointer", textAlign: "center" }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>{v} lb</div>
            <div style={{ color: GREEN, fontSize: 12.5, fontWeight: 700 }}>{fmt(v * LB)} kg</div>
          </button>
        ))}
      </div>
      <div style={{ color: "#666", fontSize: 11.5, marginTop: 10 }}>1 lb = 0.4536 kg · Nei WOD "100/70#" significa 100 lb uomini / 70 lb donne.</div>
    </div>
  );
}
