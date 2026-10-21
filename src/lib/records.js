// Record personali (PR): catalogo esercizi, confronto, storico ed eventi "nuovo PR".
// kind usa gli stessi tipi dei punteggi: weight (kg, più è meglio), time (sec, meno è meglio), reps, rounds.

export const CATS = [
  { key: "lift", label: "Sollevamenti" },
  { key: "gym", label: "Ginnastica" },
  { key: "bench", label: "Benchmark" },
  { key: "hyrox", label: "HYROX" },
  { key: "engine", label: "Corsa ed Engine" },
  { key: "altro", label: "Altro" },
];
export const CAT_LABEL = Object.fromEntries(CATS.map(c => [c.key, c.label]));

const L = (name, alias = []) => ({ name, cat: "lift", kind: "weight", alias });
const T = (cat, name, alias = []) => ({ name, cat, kind: "time", alias });
const R = (cat, name, kind = "reps", alias = []) => ({ name, cat, kind, alias });

export const CATALOG = [
  L("Back Squat"), L("Front Squat"), L("Overhead Squat", ["OHS"]), L("Deadlift"), L("Sumo Deadlift"),
  L("Clean"), L("Power Clean"), L("Squat Clean"), L("Clean & Jerk", ["clean and jerk", "C&J"]),
  L("Snatch"), L("Power Snatch"), L("Squat Snatch"),
  L("Strict Press", ["shoulder press"]), L("Push Press"), L("Push Jerk"), L("Split Jerk"), L("Bench Press"), L("Thruster"),
  R("gym", "Pull-up max"), R("gym", "Chest to Bar max"), R("gym", "Toes to Bar max"), R("gym", "HSPU max"),
  R("gym", "Muscle-up max"), R("gym", "Double Unders max"), R("gym", "Push-up max"),
  T("bench", "Fran"), T("bench", "Grace"), T("bench", "Isabel"), T("bench", "Diane"), T("bench", "Elizabeth"),
  T("bench", "Helen"), T("bench", "Karen"), T("bench", "Annie"), T("bench", "Jackie"), T("bench", "DT"), T("bench", "Murph"),
  R("bench", "Cindy", "rounds"), R("bench", "Fight Gone Bad", "reps"),
  T("hyrox", "HYROX gara completa", ["hyrox race"]), T("hyrox", "SkiErg 1000 m"), T("hyrox", "Sled Push 50 m"), T("hyrox", "Sled Pull 50 m"),
  T("hyrox", "Burpee Broad Jump 80 m"), T("hyrox", "Row 1000 m"), T("hyrox", "Farmers Carry 200 m"),
  T("hyrox", "Sandbag Lunges 100 m"), T("hyrox", "Wall Balls 100"),
  T("engine", "Corsa 400 m"), T("engine", "Corsa 1 km"), T("engine", "Corsa 5 km"), T("engine", "Corsa 10 km"),
  T("engine", "Mezza maratona"), T("engine", "Maratona"), T("engine", "Row 500 m"), T("engine", "Row 2000 m"),
  T("engine", "SkiErg 500 m"), T("engine", "Bike Erg 10 km"),
];
export const findExercise = (name) => CATALOG.find(e => norm(e.name) === norm(name));
export const RMS = [1, 2, 3, 5, 10];

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim();
export const recKey = (r) => `${norm(r.exercise)}|${r.kind === "weight" ? (r.rm || 1) : ""}`;
export const recTitle = (r) => r.kind === "weight" ? `${r.exercise} ${r.rm || 1}RM` : r.exercise;

export const isBetter = (kind, a, b) => kind === "time" ? a < b : a > b;

// Ordine cronologico (data del record, poi inserimento)
const chrono = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.ts || 0) - (b.ts || 0));

// Raggruppa per atleta+esercizio: miglior valore e storico in ordine di data
export function groupRecords(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = `${r.athlete}|${recKey(r)}`;
    if (!map.has(k)) map.set(k, { key: recKey(r), athlete: r.athlete, exercise: r.exercise, kind: r.kind, rm: r.rm, category: r.category, history: [] });
    map.get(k).history.push(r);
  }
  return [...map.values()].map(g => {
    g.history.sort(chrono);
    g.best = g.history.reduce((b, r) => (!b || isBetter(g.kind, r.value, b.value) ? r : b), null);
    g.private = g.history.every(r => r.private);
    g.last = g.history[g.history.length - 1];
    return g;
  });
}

// Righe che, quando sono state fatte, battevano tutte le precedenti (gli "eventi PR")
export function prEvents(rows) {
  const out = [];
  for (const g of groupRecords(rows)) {
    let best = null;
    for (const r of g.history) if (!best || isBetter(g.kind, r.value, best.value)) { best = r; out.push({ ...r, first: g.history[0] === r }); }
  }
  return out.sort((a, b) => -chrono(a, b));
}

// Un nuovo valore è PR se batte tutti quelli già registrati da quell'atleta per lo stesso esercizio
export function wouldBePR(rows, athlete, cand) {
  const k = recKey(cand);
  const prev = rows.filter(r => r.athlete === athlete && recKey(r) === k);
  return prev.every(r => isBetter(cand.kind, cand.value, r.value));
}

// Stima del massimale (Epley) da un nRM: utile per le percentuali
export const est1RM = (kg, rm) => rm <= 1 ? kg : kg * (1 + rm / 30);

// ---- Riconoscimento automatico da un punteggio ----
// Carico: serve un esercizio del catalogo nel testo e una indicazione di massimale (3RM, heavy single, max…)
export function matchScore(w) {
  const txt = `${w.title || ""}\n${w.tag || ""}\n${w.detail || ""}`;
  const low = " " + norm(txt) + " ";
  if (w.type === "weight") {
    const rmM = txt.match(/(\d{1,2})\s*-?\s*RM\b/i);
    const single = /heavy single|1\s*rep max|max single|massimale/i.test(txt);
    if (!rmM && !single) return null;
    const lifts = CATALOG.filter(e => e.kind === "weight")
      .map(e => ({ e, hit: [e.name, ...e.alias].map(norm).filter(a => low.includes(" " + a + " ")).sort((a, b) => b.length - a.length)[0] }))
      .filter(x => x.hit).sort((a, b) => b.hit.length - a.hit.length);
    if (!lifts.length) return null;
    const rm = rmM ? Math.min(10, Math.max(1, Number(rmM[1]))) : 1;
    return { exercise: lifts[0].e.name, category: "lift", kind: "weight", rm };
  }
  if (w.type === "time" || w.type === "rounds" || w.type === "reps") {
    const t = norm(w.title);
    const b = CATALOG.find(e => e.cat === "bench" && e.kind === w.type && (t === norm(e.name) || t.startsWith(norm(e.name) + " ")));
    if (b) return { exercise: b.name, category: "bench", kind: b.kind, rm: null };
  }
  return null;
}

export const rowToRecord = (r) => ({
  id: r.id, athlete: r.athlete, category: r.category, exercise: r.exercise, kind: r.kind, rm: r.rm,
  value: Number(r.value), raw: r.raw, date: r.record_date, note: r.note || "", private: !!r.private,
  scoreId: r.score_id, ts: new Date(r.created_at).getTime(),
});
