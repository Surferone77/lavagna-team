import { useState } from "react";
import { Percent, ArrowLeftRight, Timer as TimerIcon, ChevronLeft, Bike } from "lucide-react";
import { TimerSetup, TimerScreen } from "./Timer";
import { GREEN, CARD, LINE, MUTED, inp, pill, pillOn, h1 } from "../lib/theme";
import { groupRecords, est1RM } from "../lib/records";

const LB = 0.45359237;
const PERCENTS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
const COMMON_LB = [15, 20, 25, 35, 45, 53, 55, 65, 70, 95, 100, 115, 135, 155, 185, 205, 225];
const num = (s) => { const n = Number(String(s).replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };
const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString("it-CH", { maximumFractionDigits: d });
// arrotonda al carico caricabile sul bilanciere (passo 0,5 / 1 / 2,5 kg)
const roundTo = (n, step) => Math.round(n / step) * step;

const box = { background: CARD, border: `1px solid ${LINE}`, borderRadius: 20, padding: 16, marginBottom: 14 };
const head = { display: "flex", alignItems: "center", gap: 8, color: "#fff", fontSize: 17, fontWeight: 800, marginBottom: 12 };

// Menu a riquadri: ogni strumento si apre nella sua pagina, così lo schermo resta pulito
const TOOLS = [
  { key: "timer", title: "Timer", sub: "For Time, AMRAP, EMOM, Tabata…", Icon: TimerIcon },
  { key: "perc", title: "Percentuali", sub: "Dal 50% al 100% del massimale", Icon: Percent },
  { key: "conv", title: "Libbre ⇄ chili", sub: "Conversione e pesi comuni", Icon: ArrowLeftRight },
  { key: "cardio", title: "Cardio ⇄ macchine", sub: "Corsa, row, ski, bike erg, assault bike", Icon: Bike },
];

export default function Utility({ name = "", records = [] }) {
  const [tool, setTool] = useState(null);
  const [running, setRunning] = useState(null);
  const t = TOOLS.find(x => x.key === tool);
  if (t) return (
    <div className="fade">
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 16px" }}>
        <button onClick={() => setTool(null)} aria-label="Torna a Utility" style={{ background: "#1c1c1c", border: `1px solid ${LINE}`, color: "#fff", width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronLeft size={20} /></button>
        <div style={{ ...h1, fontSize: 24 }}>{t.title}</div>
      </div>
      {tool === "timer" && <div style={box}><TimerSetup onStart={setRunning} /></div>}
      {tool === "perc" && <Percentuali maxes={myMaxes(records, name)} />}
      {tool === "conv" && <Conversione />}
      {tool === "cardio" && <Cardio />}
      {running && <TimerScreen config={running} onClose={() => setRunning(null)} />}
    </div>
  );
  return (
    <div>
      <div style={{ ...h1, margin: "20px 0 16px" }}>Utility</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {TOOLS.map(({ key, title, sub, Icon }, i) => (
          <button key={key} onClick={() => setTool(key)} style={{ gridColumn: i === 0 || (i === TOOLS.length - 1 && TOOLS.length % 2 === 0) ? "1 / -1" : "auto", textAlign: "left", background: i === 0 ? "linear-gradient(150deg, #1b2410 0%, #141414 60%)" : CARD, border: `1px solid ${i === 0 ? "rgba(184,255,44,0.35)" : LINE}`, borderRadius: 20, padding: 18, cursor: "pointer", display: "flex", flexDirection: i === 0 ? "row" : "column", alignItems: i === 0 ? "center" : "flex-start", gap: 14, minHeight: i === 0 ? 0 : 140 }}>
            <span style={{ width: i === 0 ? 64 : 48, height: i === 0 ? 64 : 48, borderRadius: 16, background: "rgba(184,255,44,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={i === 0 ? 32 : 24} color={GREEN} strokeWidth={2.2} />
            </span>
            <span>
              <span style={{ display: "block", color: "#fff", fontSize: i === 0 ? 21 : 16.5, fontWeight: 900 }}>{title}</span>
              <span style={{ display: "block", color: MUTED, fontSize: 12.5, marginTop: 3 }}>{sub}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Massimali dai miei record: 1RM reale se c'è, altrimenti stimato da 2–10RM
function myMaxes(records, name) {
  const by = {};
  for (const g of groupRecords(records.filter(r => r.athlete === name && r.kind === "weight"))) {
    const kg = est1RM(g.best.value, g.rm || 1), cur = by[g.exercise];
    if (!cur || (g.rm === 1 && cur.est) || (!!cur.est === (g.rm !== 1) && kg > cur.kg)) by[g.exercise] = { exercise: g.exercise, kg: Math.round(kg * 2) / 2, est: g.rm !== 1 };
  }
  return Object.values(by).sort((a, b) => a.exercise.localeCompare(b.exercise));
}

function Percentuali({ maxes = [] }) {
  const [w, setW] = useState("");
  const [unit, setUnit] = useState("kg");
  const [step, setStep] = useState(0.5);
  const [pick, setPick] = useState(null);
  const base = num(w);
  return (
    <div style={box}>
      <div style={head}><Percent size={18} color={GREEN} /> Percentuali del massimale</div>
      {maxes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ color: MUTED, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Usa il mio 1RM</div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {maxes.map(m => (
              <button key={m.exercise} onClick={() => { setPick(m.exercise); setUnit("kg"); setW(String(m.kg)); }} style={{ ...pill, flexShrink: 0, padding: "6px 10px", ...(pick === m.exercise ? pillOn : {}) }}>
                {m.exercise} · {m.est ? "≈" : ""}{fmt(m.kg)} kg
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={w} onChange={e => { setW(e.target.value); setPick(null); }} inputMode="decimal" placeholder="Il tuo 1RM, es. 100"
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

// ---- Cardio ⇄ macchine: equivalenze usate nei box (base = metri di corsa) ----
// 400 m corsa = 500 m row = 500 m ski = 1000 m bike erg = 20/15 cal assault/echo bike
const MACHINES = [
  { key: "run", label: "Corsa", unit: "m", k: 1 },
  { key: "row", label: "Row", unit: "m", k: 1.25 },
  { key: "ski", label: "SkiErg", unit: "m", k: 1.25 },
  { key: "bike", label: "BikeErg", unit: "m", k: 2.5 },
  { key: "assM", label: "Assault / Echo (uomini)", unit: "cal", k: 1 / 20 },
  { key: "assF", label: "Assault / Echo (donne)", unit: "cal", k: 15 / 400 },
];
const PRESETS = { m: [200, 400, 800, 1000, 1600, 5000], cal: [10, 15, 20, 30, 50] };
const roundM = (m) => m >= 1000 ? Math.round(m / 50) * 50 : Math.round(m / 10) * 10;
const showDist = (m) => m >= 1000 ? `${fmt(m / 1000, 2)} km` : `${Math.round(m)} m`;

function Cardio() {
  const [from, setFrom] = useState("run");
  const [v, setV] = useState("1000");
  const src = MACHINES.find(x => x.key === from);
  const val = num(v);
  const runM = val ? val / src.k : null;
  return (
    <div>
      <div style={box}>
        <div style={head}><Bike size={18} color={GREEN} /> Cardio ⇄ macchine</div>
        <div style={{ color: MUTED, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Da</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {MACHINES.map(x => <button key={x.key} onClick={() => { setFrom(x.key); setV(String(x.unit === "cal" ? 20 : 1000)); }} style={{ ...pill, padding: "6px 10px", ...(from === x.key ? pillOn : {}) }}>{x.label.replace(" (uomini)", " ♂").replace(" (donne)", " ♀")}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={v} onChange={e => setV(e.target.value)} inputMode="decimal" aria-label="Quantità" style={{ ...inp, width: 140, fontSize: 22, fontWeight: 900 }} />
          <span style={{ color: MUTED, fontSize: 15, fontWeight: 700 }}>{src.unit === "m" ? "metri" : "calorie"}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {PRESETS[src.unit].map(n => <button key={n} onClick={() => setV(String(n))} style={{ ...pill, padding: "4px 10px", ...(num(v) === n ? pillOn : {}) }}>{src.unit === "m" ? showDist(n) : `${n} cal`}</button>)}
        </div>
        {runM ? (
          <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
            {MACHINES.filter(x => x.key !== from).map(x => {
              const out = runM * x.k;
              return (
                <div key={x.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1c1c1c", borderRadius: 12, padding: "11px 14px" }}>
                  <span style={{ color: "#ddd", fontSize: 14.5, fontWeight: 700 }}>{x.label}</span>
                  <span style={{ color: GREEN, fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{x.unit === "m" ? showDist(roundM(out)) : `${Math.max(1, Math.round(out))} cal`}</span>
                </div>
              );
            })}
          </div>
        ) : <div style={{ color: MUTED, fontSize: 13.5, marginTop: 12 }}>Inserisci una distanza o delle calorie.</div>}
      </div>
      <div style={{ ...box, color: MUTED, fontSize: 12.5, lineHeight: 1.55 }}>
        <b style={{ color: "#ddd" }}>Come si calcola:</b> 400 m di corsa = 500 m row = 500 m SkiErg = 1000 m BikeErg = 20 cal (uomini) / 15 cal (donne) di Assault o Echo Bike. Sono le equivalenze più usate nei box, non una regola ufficiale.
        <br /><br /><b style={{ color: "#ddd" }}>Il criterio più giusto è il tempo:</b> se 1 km di corsa ti richiede 5 minuti, fai circa 5 minuti di macchina allo stesso sforzo. Chi è più pesante va più veloce su row e bike; le calorie dell'Assault salgono molto con la velocità.
      </div>
    </div>
  );
}
