import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { TYPES, TYPE_LABEL } from "../lib/scoring";
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
          <textarea value={w.detail} onChange={e => set(i, { detail: e.target.value })} rows={Math.min(10, Math.max(3, (w.detail.match(/\n/g) || []).length + 1))}
            placeholder="Contenuto del workout" style={{ ...inp, width: "100%", lineHeight: 1.45, resize: "vertical", fontFamily: "inherit" }} />
        </div>
      ))}
      <button onClick={add} style={{ ...btnGhost, width: "100%", justifyContent: "center" }}><Plus size={15} /> Aggiungi blocco</button>
    </div>
  );
}
