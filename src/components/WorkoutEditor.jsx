import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { TYPES, TYPE_LABEL } from "../lib/scoring";
import { suggestTimer, describeTimer } from "../lib/timer";
import { CARD, LINE, MUTED, inp, btnGhost, lbl } from "../lib/theme";

// Lista di card modificabili: titolo, formato, tipo di punteggio, testo.
export default function WorkoutEditor({ workouts, onChange }) {
  const set = (i, patch) => onChange(workouts.map((w, k) => k === i ? { ...w, ...patch } : w));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= workouts.length) return; const a = [...workouts]; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  const remove = (i) => onChange(workouts.filter((_, k) => k !== i));
  const add = () => onChange([...workouts, { title: "", tag: "", type: "time", detail: "" }]);

  return (
    <div>
      {workouts.map((w, i) => (
        <div key={w.id || i} style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 14, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: MUTED, fontSize: 12, fontWeight: 700, width: 18 }}>{i + 1}</span>
            <input value={w.title} onChange={e => set(i, { title: e.target.value })} placeholder="Titolo" style={{ ...inp, flex: 1, minWidth: 0, fontWeight: 700 }} />
            <button onClick={() => move(i, -1)} style={{ ...btnGhost, padding: 8 }} aria-label="Su"><ArrowUp size={14} /></button>
            <button onClick={() => move(i, 1)} style={{ ...btnGhost, padding: 8 }} aria-label="Giù"><ArrowDown size={14} /></button>
            <button onClick={() => remove(i)} style={{ ...btnGhost, padding: 8, color: "#ff8a8a" }} aria-label="Elimina"><Trash2 size={14} /></button>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={lbl}>Formato</label>
              <input value={w.tag} onChange={e => set(i, { tag: e.target.value })} placeholder="For Time, AMRAP 12…" style={{ ...inp, width: "100%" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={lbl}>Punteggio</label>
              <select value={w.type} onChange={e => set(i, { type: e.target.value })} style={{ ...inp, width: "100%" }}>
                {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
          </div>
          <TimerField w={w} onChange={(timer) => set(i, { timer })} />
          <textarea value={w.detail} onChange={e => set(i, { detail: e.target.value })} rows={Math.min(10, Math.max(3, (w.detail.match(/\n/g) || []).length + 1))}
            placeholder="Contenuto del workout" style={{ ...inp, width: "100%", lineHeight: 1.45, resize: "vertical", fontFamily: "inherit" }} />
        </div>
      ))}
      <button onClick={add} style={{ ...btnGhost, width: "100%", justifyContent: "center" }}><Plus size={15} /> Aggiungi blocco</button>
    </div>
  );
}

// Timer del blocco: automatico (dedotto dal testo) oppure scelto a mano
const T_MODES = [["", "Automatico"], ["fortime", "Contare"], ["countdown", "Conto alla rovescia"], ["amrap", "AMRAP"], ["emom", "EMOM"], ["intervals", "Intervalli"]];
const T_FIELDS = { fortime: [["cap", "cap min"]], countdown: [["minutes", "min"]], amrap: [["minutes", "min"]], emom: [["every", "ogni s"], ["rounds", "round"]], intervals: [["work", "lavoro s"], ["rest", "riposo s"], ["rounds", "round"]] };
const T_DEF = { fortime: { cap: 0 }, countdown: { minutes: 10 }, amrap: { minutes: 12 }, emom: { every: 60, rounds: 10 }, intervals: { work: 20, rest: 10, rounds: 8 } };

function TimerField({ w, onChange }) {
  const t = w.timer;
  const auto = !t && suggestTimer({ ...w, timer: null });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
      <span style={{ ...lbl, marginBottom: 0 }}>Timer</span>
      <select value={t?.mode || ""} onChange={e => onChange(e.target.value ? { mode: e.target.value, ...T_DEF[e.target.value] } : undefined)} aria-label="Timer del blocco"
        style={{ ...inp, padding: "6px 8px", fontSize: 14 }}>
        {T_MODES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {t ? T_FIELDS[t.mode].map(([k, l]) => (
        <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: MUTED, fontSize: 12 }}>
          <input value={t[k] ?? ""} inputMode="numeric" aria-label={l} onChange={e => onChange({ ...t, [k]: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            style={{ ...inp, width: 58, padding: "6px 6px", textAlign: "center", fontSize: 14 }} />{l}
        </label>
      )) : <span style={{ color: MUTED, fontSize: 12 }}>→ {auto.source === "base" ? "cronometro" : describeTimer(auto.cfg)}</span>}
    </div>
  );
}
