import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { computeRecap, monthLabel, thisMonth, shiftMonth, monthWeekIds } from "../lib/recap";
import { prEvents, recTitle } from "../lib/records";
import { showVal, prBadge } from "./Profilo";
import { Ring } from "./Progress";
import { GREEN, CARD, LINE, MUTED } from "../lib/theme";

const box = { background: CARD, border: `1px solid ${LINE}`, borderRadius: 18, padding: 14, marginBottom: 14 };
const DOW = ["L", "M", "M", "G", "V", "S", "D"];

function Delta({ now, prev, unit = "" }) {
  if (prev === null || prev === undefined) return null;
  const d = now - prev;
  const I = d > 0 ? TrendingUp : d < 0 ? TrendingDown : Minus;
  const c = d > 0 ? GREEN : d < 0 ? "#ff8a8a" : MUTED;
  return <span style={{ color: c, fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 3 }}><I size={12} /> {d > 0 ? "+" : ""}{d}{unit}</span>;
}

function Stat({ label, value, sub }) {
  return (
    <div style={{ background: "#1b1b1b", borderRadius: 14, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ color: MUTED, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <div style={{ color: "#fff", fontSize: 24, fontWeight: 900, letterSpacing: -0.5, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ minHeight: 15 }}>{sub}</div>
    </div>
  );
}

// Riepilogo del mese per l'atleta: carica da sola le settimane che servono
export default function Riepilogo({ name, done, entries, records, weeks, ensureWeeks }) {
  const [ym, setYm] = useState(thisMonth());
  const prev = shiftMonth(ym, -1);
  useEffect(() => { ensureWeeks([...monthWeekIds(ym), ...monthWeekIds(prev)]); }, [ym]);
  const events = useMemo(() => prEvents(records.filter(r => r.athlete === name)), [records, name]);
  const r = useMemo(() => computeRecap(ym, { weeks, done, entries, name, prEvents: events }), [ym, weeks, done, entries, name, events]);
  const p = useMemo(() => computeRecap(prev, { weeks, done, entries, name, prEvents: events }), [prev, weeks, done, entries, name, events]);
  const loading = monthWeekIds(ym).some(id => !(id in weeks));
  const cur = ym === thisMonth();
  const firstDow = (new Date(ym + "-01T00:00:00Z").getUTCDay() + 6) % 7;

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <BarChart3 size={17} color={GREEN} />
        <div style={{ flex: 1, color: "#fff", fontWeight: 800, fontSize: 15.5, textTransform: "capitalize" }}>{monthLabel(ym)}</div>
        <button onClick={() => setYm(shiftMonth(ym, -1))} aria-label="Mese precedente" style={nav}><ChevronLeft size={16} /></button>
        <button onClick={() => setYm(shiftMonth(ym, 1))} disabled={cur} aria-label="Mese successivo" style={{ ...nav, opacity: cur ? 0.3 : 1 }}><ChevronRight size={16} /></button>
      </div>

      {loading ? <div style={{ color: MUTED, fontSize: 13.5, padding: "8px 0" }}>Carico…</div> : !r.hasData ? (
        <div style={{ color: MUTED, fontSize: 13.5, padding: "4px 0 2px" }}>Nessun allenamento programmato in questo mese.</div>
      ) : <>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          <Ring pct={r.pct} size={78} stroke={9} font={17} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 800 }}>{r.completed} di {r.programmed} blocchi completati</div>
            <div style={{ color: MUTED, fontSize: 12.5 }}>{cur ? "finora, " : ""}{r.fullDays} {r.fullDays === 1 ? "giornata completa" : "giornate complete"}</div>
            {p.hasData && <div style={{ marginTop: 3 }}><Delta now={r.pct} prev={p.pct} unit="%" /> <span style={{ color: MUTED, fontSize: 11.5 }}>vs {monthLabel(prev).split(" ")[0]}</span></div>}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginBottom: 14 }}>
          <Stat label="Sessioni" value={r.sessions} sub={p.hasData && <Delta now={r.sessions} prev={p.sessions} />} />
          <Stat label="PR" value={r.prs.length} sub={p.hasData && <Delta now={r.prs.length} prev={p.prs.length} />} />
          <Stat label="Serie" value={r.bestStreak} sub={<span style={{ color: MUTED, fontSize: 11 }}>giorni di fila</span>} />
        </div>

        {/* calendario del mese: più verde = più blocchi completati */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 14 }}>
          {DOW.map((d, i) => <div key={i} style={{ color: MUTED, fontSize: 10.5, fontWeight: 700, textAlign: "center" }}>{d}</div>)}
          {Array.from({ length: firstDow }, (_, i) => <div key={"e" + i} />)}
          {r.days.map(d => {
            const f = d.total ? d.done / d.total : 0;
            const bg = d.future ? "transparent" : d.total === 0 ? "#151515" : f === 0 ? "#222" : `rgba(184,255,44,${0.25 + 0.75 * f})`;
            return <div key={d.date} title={`${d.date}: ${d.done}/${d.total}`} style={{ aspectRatio: "1", borderRadius: 7, background: bg, border: d.future ? `1px dashed #2a2a2a` : "none", display: "flex", alignItems: "center", justifyContent: "center", color: f > 0.5 ? "#0b0b0b" : "#888", fontSize: 11, fontWeight: 800 }}>{Number(d.date.slice(8))}</div>;
          })}
        </div>

        {r.byWeek.length > 1 && <>
          <div style={sec}>Per settimana</div>
          {r.byWeek.map(w => {
            const pct = w.total ? Math.round((w.done / w.total) * 100) : 0;
            return (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ color: MUTED, fontSize: 12, width: 34 }}>{w.label}</span>
                <div style={{ flex: 1, height: 8, background: "#262626", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: GREEN, borderRadius: 4 }} /></div>
                <span style={{ color: "#fff", fontSize: 12.5, fontWeight: 800, width: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{w.total ? `${pct}%` : "—"}</span>
              </div>
            );
          })}
        </>}

        {r.types.length > 0 && <>
          <div style={{ ...sec, marginTop: 12 }}>Cosa hai fatto</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {r.types.map(([t, n]) => <span key={t} style={{ background: "#1f1f1f", border: `1px solid ${LINE}`, borderRadius: 999, padding: "4px 10px", fontSize: 12.5, color: "#ddd" }}><b style={{ color: GREEN }}>{n}</b> {t}</span>)}
          </div>
        </>}

        {r.prs.length > 0 && <>
          <div style={{ ...sec, marginTop: 12 }}>PR del mese</div>
          {r.prs.map(e => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
              <span style={prBadge}>PR</span>
              <span style={{ flex: 1, minWidth: 0, color: "#ddd", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{recTitle(e)}</span>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>{showVal(e)}</span>
            </div>
          ))}
        </>}
      </>}
    </div>
  );
}

const nav = { background: "#1c1c1c", border: `1px solid ${LINE}`, color: "#fff", width: 32, height: 32, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const sec = { color: MUTED, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 };
