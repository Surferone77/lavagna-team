// Riepilogo mensile personale: giorni allenati, blocchi completati, PR, andamento per settimana.
import { weekInfo, todayISO } from "./weeks.js";

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
export const monthLabel = (ym) => { const [y, m] = ym.split("-").map(Number); return `${MESI[m - 1]} ${y}`; };
export const monthName = (ym) => MESI[Number(ym.split("-")[1]) - 1];
export const thisMonth = () => todayISO().slice(0, 7);
export const shiftMonth = (ym, d) => { const [y, m] = ym.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1 + d, 1)); return t.toISOString().slice(0, 7); };

// Tutte le date del mese (ISO) e le settimane che toccano
export function monthDates(ym) {
  const [y, m] = ym.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`);
}
export const monthWeekIds = (ym) => [...new Set(monthDates(ym).map(d => weekInfo(d).weekId))];

// weeks: { weekId: settimana | null }, done: Set di id, entries: punteggi di tutti, prs: eventi PR miei
export function computeRecap(ym, { weeks, done, entries, name, prEvents = [] }) {
  const today = todayISO();
  const scored = new Set(entries.filter(e => e.name === name).map(e => e.wod));
  const isDone = (id) => done.has(id) || scored.has(id);
  const days = [];
  for (const date of monthDates(ym)) {
    const { weekId, dayKey } = weekInfo(date);
    const wk = weeks[weekId];
    const blocks = wk?.days?.find(d => d.key === dayKey)?.workouts || [];
    const n = blocks.filter(w => isDone(w.id)).length;
    days.push({ date, future: date > today, total: blocks.length, done: n, blocks });
  }
  const past = days.filter(d => !d.future);
  const programmed = past.reduce((a, d) => a + d.total, 0);
  const completed = past.reduce((a, d) => a + d.done, 0);
  const sessions = past.filter(d => d.done > 0).length;
  const fullDays = past.filter(d => d.total > 0 && d.done === d.total).length;

  // serie più lunga di giorni programmati consecutivi completati almeno in parte (i giorni di riposo non la spezzano)
  let streak = 0, best = 0;
  for (const d of past) { if (d.total === 0) continue; if (d.done > 0) { streak++; best = Math.max(best, streak); } else streak = 0; }

  // per settimana (lun–dom) dentro il mese
  const byWeek = [];
  for (const d of days) {
    const id = weekInfo(d.date).weekId;
    let w = byWeek.find(x => x.id === id);
    if (!w) byWeek.push(w = { id, label: weekInfo(d.date).label.split(" · ")[0].replace("Settimana ", "S"), total: 0, done: 0 });
    if (!d.future) { w.total += d.total; w.done += d.done; }
  }

  // tipo di lavoro dei blocchi completati
  const TYPE = { time: "For Time", rounds: "AMRAP", reps: "Reps", weight: "Forza", note: "Tecnica / accessori" };
  const types = {};
  for (const d of past) for (const w of d.blocks) if (isDone(w.id)) types[TYPE[w.type] || "Altro"] = (types[TYPE[w.type] || "Altro"] || 0) + 1;

  const prs = prEvents.filter(p => p.athlete === name && p.date?.startsWith(ym));
  const scores = entries.filter(e => e.name === name && days.some(d => d.blocks.some(b => b.id === e.wod))).length;
  return {
    ym, days, programmed, completed, sessions, fullDays, bestStreak: best, scores, prs,
    pct: programmed ? Math.round((completed / programmed) * 100) : 0,
    byWeek: byWeek.filter(w => w.total > 0),
    types: Object.entries(types).sort((a, b) => b[1] - a[1]),
    hasData: programmed > 0,
  };
}
