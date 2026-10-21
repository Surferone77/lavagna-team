// Supabase finto, tutto in memoria: serve solo per la preview demo (vite.demo.config.js).
import { weekInfo, todayISO, shiftWeek, weekInfo as wi, weekDates } from "../src/lib/weeks";

const info = weekInfo(todayISO());
const W = info.weekId;
const iso = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const dow = (new Date().getDay() + 6) % 7;
const dateOf = (k) => iso(["lun", "mar", "mer", "gio", "ven", "sab", "dom"].indexOf(k) - dow);

const day = (key, label, workouts) => ({ key, label, date: dateOf(key), workouts: workouts.map((w, i) => ({ id: `${W}__${key}__${i}`, ...w })) });
const week = {
  id: W, label: info.label,
  days: [
    day("lun", "Lunedì", [
      { title: "Engine", tag: "For Time", type: "time", detail: "1000m Run\n50 Wall Balls 9/6 kg\n1000m Row\n50 Walking Lunges\n1000m Run" },
      { title: "Build to Heavy", tag: "Build to 3RM", type: "weight", detail: "Back Squat 3RM\nRiposo 2-3' tra le serie" },
    ]),
    day(info.dayKey, ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"][dow], [
      { title: "Strength - Dual KB Box Step Over", tag: "3 sets", type: "note", detail: "10 reps, each Dual KB Box Step Over 24/20\", 7/10 RPE\n4 reps Box Jump AHAP" },
      { title: "Applied Strength", tag: "4 sets", type: "note", detail: "10 reps, each Seated KB Calf Raise 6/10 RPE\n60-sec Dball Bottom of squat hold 100/70#\n25 reps Wt'd GHD Back Extension 6/10 RPE" },
      { title: "Metcon", tag: "AMRAP 14", type: "rounds", detail: "200m Run\n12 Burpee Box Jump Over\n16 KB Swing 24/16 kg" },
      { title: "Sled Finisher", tag: "For Time", type: "time", detail: "4x 25m Sled Push\n4x 25m Sled Pull\nTime cap 6'" },
    ]),
  ].filter((d, i, a) => a.findIndex(x => x.key === d.key) === i),
};
const today = week.days.find(d => d.key === info.dayKey);
const id = (t) => today.workouts.find(w => w.title === t)?.id;
const mon = week.days[0].workouts;
let n = 0;
const sc = (wid, athlete, value, raw, rx = true, note = "") => ({ id: `s${++n}`, workout_id: wid, athlete, value, raw, rx, note, created_at: new Date(Date.now() - n * 3600e3).toISOString() });

const PW = shiftWeek(W, -1);
const pd = weekDates(PW);
const prevWeek = { id: PW, label: wi(pd[0]).label, days: [
  { key: "mar", label: "Martedì", date: pd[1], workouts: [{ id: `${PW}__mar__0`, title: "HYROX Sim", tag: "For Time", type: "time", detail: "4x (1km Run + 1 stazione)\nSkiErg 1000m · Sled Push 50m · Burpee Broad Jump 80m · Row 1000m" }] },
  { key: "ven", label: "Venerdì", date: pd[4], workouts: [{ id: `${PW}__ven__0`, title: "Partner WOD", tag: "AMRAP 20", type: "rounds", detail: "In coppia, un lavora uno riposa:\n10 Wall Balls\n10 Toes to Bar\n200m Run" }] },
] };
const db = {
  weeks: [{ id: W, label: week.label, data: week }, { id: PW, label: prevWeek.label, data: prevWeek }],
  scores: [
    sc(id("Metcon"), "Marco", 7008, "7+8"), sc(id("Metcon"), "Giulia", 6022, "6+22"), sc(id("Metcon"), "Luca", 7002, "7+2", false, "KB 16 kg"),
    sc(id("Sled Finisher"), "Giulia", 312, "5:12"), sc(id("Sled Finisher"), "Marco", 1e6 - 3, "CAP+3"),
    sc(mon[0].id, "Marco", 1395, "23:15"), sc(mon[0].id, "Giulia", 1442, "24:02"), sc(mon[0].id, "Luca", 1510, "25:10", false),
    sc(`${PW}__mar__0`, "Chicco", 2710, "45:10"), sc(`${PW}__mar__0`, "Marco", 2650, "44:10"),
    sc(mon[1].id, "Chicco", 115, "115"), sc(mon[0].id, "Chicco", 1460, "24:20"),
    sc(mon[1].id, "Marco", 120, "120"), sc(mon[1].id, "Luca", 110, "110"), sc(mon[1].id, "Giulia", 85, "85"),
  ],
  workout_done: [mon[0].id, mon[1].id, `${PW}__mar__0`].map((w, i) => ({ id: `d${i}`, athlete: "Chicco", workout_id: w, week_id: w.split("__")[0] })),
  comunicazioni: [
    { id: "c1", utente: "Giulia", messaggio: "Domani alle 18:30 chi c'è? Porto i sacchi per il sled 💪", created_at: new Date(Date.now() - 5 * 3600e3).toISOString() },
    { id: "c2", utente: "Marco", messaggio: "Presente. Metcon di oggi brutale.", created_at: new Date(Date.now() - 2 * 3600e3).toISOString() },
  ],
};

const listeners = [];
const files = {}; // storage finto: percorso -> URL locale
const notify = (table, row) => listeners.filter(l => l.table === table).forEach(l => setTimeout(() => l.cb({ new: row }), 0));
const clone = (x) => JSON.parse(JSON.stringify(x));

function query(table) {
  const st = { op: "select", filters: [], order: null, limit: null, single: false, maybe: false, payload: null, cols: "*", returning: false };
  const run = async () => {
    const rows = db[table] || (db[table] = []);
    if (st.op === "insert") {
      const items = (Array.isArray(st.payload) ? st.payload : [st.payload]).map(r => ({ id: `${table}${Date.now()}${Math.random().toString(36).slice(2, 6)}`, created_at: new Date().toISOString(), ...r }));
      rows.push(...items); items.forEach(r => notify(table, r));
      return { data: st.returning ? (st.single ? clone(items[0]) : clone(items)) : null, error: null };
    }
    if (st.op === "upsert") {
      const r = st.payload; const i = rows.findIndex(x => x.id === r.id);
      if (i >= 0) rows[i] = { ...rows[i], ...clone(r) }; else rows.push(clone(r));
      notify(table, r);
      return { data: null, error: null };
    }
    let out = rows.filter(r => st.filters.every(([k, v]) => r[k] === v));
    if (st.op === "delete") { db[table] = rows.filter(r => !out.includes(r)); return { data: null, error: null }; }
    if (st.order) out = [...out].sort((a, b) => (a[st.order.col] > b[st.order.col] ? 1 : -1) * (st.order.asc ? 1 : -1));
    if (st.limit) out = out.slice(0, st.limit);
    if (st.cols !== "*") { const cs = st.cols.split(","); out = out.map(r => Object.fromEntries(cs.map(c => [c, r[c]]))); }
    if (st.maybe || st.single) return { data: out[0] ? clone(out[0]) : null, error: null };
    return { data: clone(out), error: null };
  };
  const b = {
    select(cols) { if (st.op === "select") st.cols = cols || "*"; else st.returning = true; return b; },
    insert(p) { st.op = "insert"; st.payload = p; return b; },
    upsert(p) { st.op = "upsert"; st.payload = p; return b; },
    delete() { st.op = "delete"; return b; },
    eq(k, v) { st.filters.push([k, v]); return b; },
    order(col, o = {}) { st.order = { col, asc: o.ascending !== false }; return b; },
    limit(x) { st.limit = x; return b; },
    single() { st.single = true; return b; },
    maybeSingle() { st.maybe = true; return b; },
    then(res, rej) { return run().then(res, rej); },
  };
  return b;
}

export const supabaseConfigured = true;
export const supabase = {
  from: query,
  channel() {
    const ch = { on(_e, f, cb) { listeners.push({ table: f.table, cb }); return ch; }, subscribe() { return ch; } };
    return ch;
  },
  removeChannel() {},
  storage: {
    from: () => ({
      upload: async (path, blob) => { files[path] = URL.createObjectURL(blob); return { data: { path }, error: null }; },
      getPublicUrl: (path) => ({ data: { publicUrl: files[path] || "" } }),
      remove: async (paths) => { paths.forEach(p => delete files[p]); return { data: null, error: null }; },
    }),
  },
};

// Lettura AI simulata. Il primo screenshot restituisce le card del vero screenshot SugarWOD;
// i successivi simulano gli altri giorni della settimana (uno senza giorno scritto, da confermare).
const DEMO_DAYS = ["lun", "mar", "mer", null, "ven", "sab", "dom"];
const DEMO_WODS = [
  [{ title: "Strength - Dual KB Box Step Over", tag: "3 sets", type: "note", detail: `10 reps, each Dual KB Box Step Over 24/20", 7/10 RPE\n4 reps Box Jump AHAP\nGiada Bonardi` },
   { title: "Applied Strength", tag: "4 sets", type: "note", detail: "10 reps, each Seated KB Calf Raise 6/10 RPE\n60-sec Dball Bottom of squat hold 100/70#\n25 reps Wt'd GHD Back Extension 6/10 RPE" }],
  [{ title: "Run Intervals", tag: "6 rounds", type: "note", detail: "800m Run @ ritmo 10k\n2' recupero camminando" },
   { title: "Metcon", tag: "For Time", type: "time", detail: "50 Wall Balls 9/6 kg\n40 Cal Row\n30 Burpee Broad Jump\nTime cap 15'" }],
  [{ title: "Strength", tag: "Build to 5RM", type: "weight", detail: "Deadlift 5RM" },
   { title: "Engine", tag: "AMRAP 16", type: "rounds", detail: "12 Cal SkiErg\n10 KB Goblet Lunges 24/16\n8 Toes to Bar" }],
  [{ title: "Mobility & Core", tag: "", type: "note", detail: "Flow 20'\n3x 45'' Hollow hold" }],
  [{ title: "HYROX Stations", tag: "For Time", type: "time", detail: "1000m SkiErg\n50m Sled Push\n50m Sled Pull\n80m Burpee Broad Jump\n1000m Row" }],
  [{ title: "Partner WOD", tag: "AMRAP 30", type: "reps", detail: "In coppia:\n400m Run insieme\nMax reps Wall Balls nel resto del minuto" }],
  [{ title: "Long Run", tag: "Zona 2", type: "note", detail: "60-75' corsa facile" }],
];
let demoCall = 0;
export async function callFunction(_name, body) {
  await new Promise(r => setTimeout(r, 900 + Math.random() * 900));
  const i = demoCall++ % DEMO_WODS.length;
  return {
    workouts: DEMO_WODS[i],
    date: null, day: DEMO_DAYS[i],
    removed: ["Giada Bonardi — nome e foto sotto la card", "Pulsanti dell'app: Leaderboard, Add your score, History"],
    warning: null,
  };
}
