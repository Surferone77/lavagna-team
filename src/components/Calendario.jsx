import { useState } from "react";
import { ChevronLeft, ChevronRight, PencilLine, Camera } from "lucide-react";
import WorkoutCard from "./WorkoutCard";
import { Bar } from "./Progress";
import { progress } from "../lib/progress";
import { DAY_ORDER, DAY_LABEL, weekDates, weekInfo, todayISO, prettyDate } from "../lib/weeks";
import { GREEN, CARD, LINE, MUTED, btnGhost, btnGreen } from "../lib/theme";

const SHORT = { lun: "L", mar: "M", mer: "M", gio: "G", ven: "V", sab: "S", dom: "D" };

export default function Calendario({ weekId, week, dayKey, setDayKey, onShift, onToday, entries, name, onAdd, onRemove, onEdit, onUpload, onSetTimer, done = new Set(), onToggleDone }) {
  const [openForm, setOpenForm] = useState(null);
  const dates = weekDates(weekId);
  const today = todayISO();
  const info = weekInfo(dates[0]);
  const isThisWeek = weekId === weekInfo(today).weekId;
  const day = week?.days?.find(d => d.key === dayKey) || null;
  const date = dates[DAY_ORDER.indexOf(dayKey)];
  const prog = progress(day?.workouts, done);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
        <button onClick={() => onShift(-1)} style={{ ...btnGhost, padding: 8 }} aria-label="Settimana precedente"><ChevronLeft size={18} /></button>
        <div style={{ flex: 1, textAlign: "center", minWidth: 0 }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>{info.label.split(" · ")[0]}</div>
          <div style={{ color: MUTED, fontSize: 12 }}>{info.label.split(" · ")[1]}{!isThisWeek && <> · <button onClick={onToday} style={{ background: "none", border: "none", color: GREEN, fontSize: 12, padding: 0, cursor: "pointer" }}>torna a oggi</button></>}</div>
        </div>
        <button onClick={() => onShift(1)} style={{ ...btnGhost, padding: 8 }} aria-label="Settimana successiva"><ChevronRight size={18} /></button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, margin: "16px 0" }}>
        {DAY_ORDER.map((k, i) => {
          const d = week?.days?.find(x => x.key === k);
          const n = d?.workouts?.length || 0;
          const on = k === dayKey, isToday = dates[i] === today;
          const p = progress(d?.workouts, done);
          return (
            <button key={k} onClick={() => { setDayKey(k); setOpenForm(null); }} aria-label={DAY_LABEL[k]} style={{
              padding: "8px 0 7px", borderRadius: 12, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              background: on ? "rgba(184,255,44,0.16)" : CARD, border: `1px solid ${on ? GREEN : isToday ? "#3d3d3d" : LINE}` }}>
              <span style={{ color: on ? GREEN : MUTED, fontSize: 11, fontWeight: 700 }}>{SHORT[k]}</span>
              <span style={{ color: on ? GREEN : "#fff", fontSize: 16, fontWeight: 800 }}>{Number(dates[i].slice(8))}</span>
              <span style={{ height: 6, width: "62%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {n > 0 && (p.n === 0 ? <span style={{ width: 6, height: 6, borderRadius: 3, background: "#666" }} />
                  : <span style={{ width: "100%", height: 4, borderRadius: 2, background: "#333", overflow: "hidden" }}><span style={{ display: "block", width: `${p.pct}%`, height: "100%", background: GREEN }} /></span>)}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 19 }}>{DAY_LABEL[dayKey]}</div>
          <div style={{ color: MUTED, fontSize: 12 }}>{prettyDate(date)}{day ? ` · ${day.workouts.length} ${day.workouts.length === 1 ? "blocco" : "blocchi"}` : ""}</div>
        </div>
        {day && <button onClick={onEdit} style={btnGhost} aria-label="Modifica giorno"><PencilLine size={16} /></button>}
      </div>
      {prog.total > 0 && (
        <div style={{ background: CARD, border: `1px solid ${prog.pct === 100 ? "rgba(184,255,44,0.5)" : LINE}`, borderRadius: 14, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
            <span style={{ color: MUTED, fontSize: 12, fontWeight: 700 }}>{prog.pct === 100 ? "Giornata completata 💪" : `Completati ${prog.n} di ${prog.total} · solo tu lo vedi`}</span>
            <span style={{ color: prog.pct ? GREEN : "#fff", fontSize: 18, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{prog.pct}%</span>
          </div>
          <Bar pct={prog.pct} />
        </div>
      )}

      {week === undefined && <div style={{ color: MUTED, padding: 16 }}>Carico…</div>}
      {week !== undefined && !day && (
        <div style={{ background: CARD, border: `1px dashed #333`, borderRadius: 16, padding: 20, textAlign: "center" }}>
          <div style={{ color: MUTED, fontSize: 14, marginBottom: 12 }}>Nessun allenamento per questo giorno.</div>
          <button onClick={() => onUpload(date)} style={btnGreen}><Camera size={16} /> Carica allenamento</button>
        </div>
      )}
      {day?.workouts.map(w => (
        <WorkoutCard key={w.id} w={w} name={name} date={date} onSetTimer={onSetTimer} done={done.has(w.id)} onToggleDone={onToggleDone && (() => onToggleDone(w))} entries={entries.filter(e => e.wod === w.id)}
          open={openForm === w.id} setOpen={o => setOpenForm(o ? w.id : null)} onAdd={async (...a) => { const e = await onAdd(...a); if (!e) setOpenForm(null); return e; }} onRemove={onRemove} />
      ))}
      {day && day.workouts.length === 0 && <div style={{ color: MUTED, padding: 16 }}>Giorno di riposo.</div>}
    </div>
  );
}
