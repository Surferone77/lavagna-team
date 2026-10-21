// Avanzamento personale: ogni blocco del giorno vale uguale (4 blocchi → 25% ciascuno).
export function progress(workouts = [], done = new Set()) {
  const total = workouts.length;
  const n = workouts.filter(w => done.has(w.id)).length;
  return { n, total, pct: total ? Math.round((n / total) * 100) : 0 };
}
