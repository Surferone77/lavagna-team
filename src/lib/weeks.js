// Settimane, giorni e id dei workout.
export const DAY_ORDER = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
export const DAY_LABEL = { lun: "Lunedì", mar: "Martedì", mer: "Mercoledì", gio: "Giovedì", ven: "Venerdì", sab: "Sabato", dom: "Domenica" };
const MONTHS = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// "2026-10-21" -> { weekId: "2026-W43", dayKey: "mer", label: "Settimana 43 · 19–25 ott" }
export function weekInfo(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = (date.getUTCDay() + 6) % 7; // 0 = lunedì
  const thursday = new Date(date); thursday.setUTCDate(date.getUTCDate() - dow + 3);
  const isoYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const week = 1 + Math.round(((thursday - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  const mon = new Date(date); mon.setUTCDate(date.getUTCDate() - dow);
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
  const fmt = (x) => `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]}`;
  const range = mon.getUTCMonth() === sun.getUTCMonth() ? `${mon.getUTCDate()}–${fmt(sun)}` : `${fmt(mon)} – ${fmt(sun)}`;
  return { weekId: `${isoYear}-W${String(week).padStart(2, "0")}`, dayKey: DAY_ORDER[dow], label: `Settimana ${week} · ${range}` };
}

// Date ISO del lunedì..domenica di una settimana "2026-W43"
export function weekDates(weekId) {
  const [y, w] = weekId.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const mon = new Date(jan4); mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (w - 1) * 7);
  return DAY_ORDER.map((_, i) => { const d = new Date(mon); d.setUTCDate(mon.getUTCDate() + i); return d.toISOString().slice(0, 10); });
}
export const shiftWeek = (weekId, delta) => {
  const mon = weekDates(weekId)[0];
  const d = new Date(mon + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 7 * delta);
  return weekInfo(d.toISOString().slice(0, 10)).weekId;
};
export const prettyDate = (iso) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

// Toglie dal testo le righe che contengono nomi/risultati personali segnalati dall'AI.
export function stripPersonal(workouts, removed = []) {
  const names = removed.map(r => String(r).split(/[—:(-]/)[0].trim().toLowerCase()).filter(n => n.length >= 3 && /^[a-zà-ÿ' ]+$/i.test(n)); // solo nomi, mai numeri
  if (!names.length) return workouts;
  const bad = (line) => names.some(n => line.toLowerCase().includes(n));
  return workouts.map(w => ({ ...w, detail: (w.detail || "").split("\n").filter(l => !bad(l)).join("\n") }));
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const rid = () => Math.random().toString(36).slice(2, 8);

export function cleanWorkout(w) {
  const type = ["time", "reps", "rounds", "weight", "note"].includes(w.type) ? w.type : "note";
  return { ...(w.id ? { id: w.id } : {}), title: (w.title || "").trim() || "Senza titolo", tag: (w.tag || "").trim(), type, detail: (w.detail || "").trim() };
}

// Assegna id stabili: un workout con lo stesso titolo di prima mantiene il suo id,
// così i punteggi già inseriti restano attaccati anche se ricarichi o riordini il giorno.
export function assignIds(weekId, dayKey, workouts, previous = []) {
  const pool = [...previous];
  const used = new Set();
  return workouts.map(w => {
    if (w.id && !used.has(w.id)) { used.add(w.id); return w; }
    const k = pool.findIndex(p => p.id && !used.has(p.id) && norm(p.title) === norm(w.title));
    const id = k >= 0 ? pool[k].id : `${weekId}__${dayKey}__${rid()}`;
    used.add(id);
    return { ...w, id };
  });
}

// Normalizza una settimana importata (vecchio formato compreso): ogni workout ha un id.
export function ingest(week) {
  return {
    id: week.id, label: week.label || week.id,
    days: (week?.days ?? []).map(d => ({
      ...d, label: d.label || DAY_LABEL[d.key] || d.key,
      workouts: (d.workouts || []).map((w, i) => ({ ...cleanWorkout(w), id: w.id || `${week.id}__${d.key}__${i}` })),
    })),
  };
}

// Unisce i risultati di più screenshot togliendo i doppioni (stessa card fotografata due volte).
export function mergeWorkouts(lists) {
  const seen = new Set(); const out = [];
  for (const list of lists) for (const w of list || []) {
    const k = norm(w.title) + "|" + norm(w.detail).slice(0, 60);
    if (seen.has(k)) continue;
    seen.add(k); out.push(cleanWorkout(w));
  }
  return out;
}

// Settimana proposta alla coach: dal sabato in poi si programma la settimana successiva.
export function coachTargetWeek(iso = todayISO()) {
  const info = weekInfo(iso);
  return info.dayKey === "sab" || info.dayKey === "dom" ? shiftWeek(info.weekId, 1) : info.weekId;
}

// Assegna un giorno a ogni screenshot (in ordine di selezione):
// 1) giorno letto dall'AI, 2) data dentro la settimana, 3) il giorno dopo il precedente (da confermare).
export function assignDays(items, weekId) {
  const dates = weekDates(weekId);
  let last = -1;
  return items.map(it => {
    let idx = it.day ? DAY_ORDER.indexOf(it.day) : -1;
    if (idx < 0 && it.date) idx = dates.indexOf(it.date);
    const guessed = idx < 0;
    if (guessed) idx = Math.min(last + 1, 6);
    last = idx;
    return { key: it.key, dayKey: DAY_ORDER[idx], guessed };
  });
}
