// Motore del timer: trasforma una configurazione in segmenti (preparazione, lavoro, riposo)
// e calcola lo stato in base al tempo trascorso. Nessuna dipendenza dal DOM: è testabile.

export const MODES = {
  fortime:   { label: "For Time",  hint: "Conta in avanti, time cap facoltativo" },
  amrap:     { label: "AMRAP",     hint: "Conto alla rovescia per N minuti" },
  emom:      { label: "EMOM",      hint: "Un intervallo ogni N secondi" },
  intervals: { label: "Intervalli", hint: "Lavoro / riposo per N round (es. Tabata)" },
  countdown: { label: "Countdown", hint: "Timer semplice alla rovescia" },
  sequence:  { label: "Sequenza",  hint: "Più parti di fila: warm-up, intervalli, riposi" },
};

// Parti di una sequenza:
//   { type: "tempo",      label, sec }                 un tratto a tempo (warm-up, corsa, ecc.)
//   { type: "intervalli", label, work, rest, rounds }  N set lavoro/riposo
//   { type: "riposo",     label, sec }                 una pausa
export const PART_TYPES = { tempo: "Tempo", intervalli: "Intervalli", riposo: "Riposo" };
export const DEFAULT_PARTS = [
  { type: "tempo", label: "Warm-up", sec: 300 },
  { type: "intervalli", label: "Lavoro", work: 90, rest: 25, rounds: 12 },
  { type: "tempo", label: "Warm-down", sec: 300 },
];

export const DEFAULTS = { mode: "amrap", minutes: 12, cap: 0, every: 60, rounds: 10, work: 20, rest: 10, prep: 10, sound: true, parts: DEFAULT_PARTS };

// Restituisce la lista dei segmenti. dur = null → segmento aperto (conta in avanti senza fine)
export function buildSegments(c) {
  const segs = [];
  if (c.prep > 0) segs.push({ kind: "prep", label: "Preparati", dur: c.prep, up: false, round: 0, rounds: 0 });
  if (c.mode === "fortime") segs.push({ kind: "work", label: "For Time", dur: c.cap > 0 ? c.cap * 60 : null, up: true, round: 0, rounds: 0 });
  if (c.mode === "amrap") segs.push({ kind: "work", label: "AMRAP", dur: c.minutes * 60, up: false, round: 0, rounds: 0 });
  if (c.mode === "countdown") segs.push({ kind: "work", label: "Countdown", dur: c.minutes * 60, up: false, round: 0, rounds: 0 });
  if (c.mode === "emom") for (let r = 1; r <= c.rounds; r++) segs.push({ kind: "work", label: "EMOM", dur: c.every, up: false, round: r, rounds: c.rounds });
  if (c.mode === "intervals") for (let r = 1; r <= c.rounds; r++) {
    segs.push({ kind: "work", label: "Lavoro", dur: c.work, up: false, round: r, rounds: c.rounds });
    if (r < c.rounds && c.rest > 0) segs.push({ kind: "rest", label: "Riposo", dur: c.rest, up: false, round: r, rounds: c.rounds });
  }
  if (c.mode === "sequence") {
    const parts = c.parts || [];
    parts.forEach((p, k) => {
      const info = { part: k + 1, parts: parts.length, partLabel: p.label || PART_TYPES[p.type] };
      if (p.type === "intervalli") for (let r = 1; r <= p.rounds; r++) {
        segs.push({ kind: "work", label: p.label || "Lavoro", dur: p.work, up: false, round: r, rounds: p.rounds, ...info });
        if (r < p.rounds && p.rest > 0) segs.push({ kind: "rest", label: "Riposo", dur: p.rest, up: false, round: r, rounds: p.rounds, ...info });
      } else if (p.sec > 0) segs.push({ kind: p.type === "riposo" ? "rest" : "work", label: p.label || PART_TYPES[p.type], dur: p.sec, up: false, round: 0, rounds: 0, ...info });
    });
  }
  return segs;
}

// Durata totale in secondi (null se il workout è aperto)
export const totalDuration = (segs) => segs.some(s => s.dur === null) ? null : segs.reduce((a, s) => a + s.dur, 0);

// Stato al tempo t (secondi dall'avvio, pause escluse)
export function stateAt(segs, t) {
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.dur === null || t < acc + s.dur) {
      const inSeg = t - acc;
      return { i, seg: s, inSeg, remaining: s.dur === null ? null : s.dur - inSeg, done: false, workElapsed: workElapsed(segs, t) };
    }
    acc += s.dur;
  }
  const last = segs[segs.length - 1];
  return { i: segs.length - 1, seg: last, inSeg: last?.dur || 0, remaining: 0, done: true, workElapsed: workElapsed(segs, t) };
}

// Tempo di lavoro trascorso (esclusa la preparazione): è il "tempo del workout"
function workElapsed(segs, t) {
  const prep = segs[0]?.kind === "prep" ? segs[0].dur : 0;
  const tot = totalDuration(segs);
  const capped = tot === null ? t : Math.min(t, tot);
  return Math.max(0, capped - prep);
}

export const fmtClock = (sec) => {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// Legge formato e testo di un blocco e propone la configurazione del timer
export function configFromWorkout(w) {
  const txt = `${w.tag || ""}\n${w.title || ""}\n${w.detail || ""}`;
  let m;
  if ((m = txt.match(/E(?:\d+)?MOM\s*(?:x\s*)?(\d+)/i))) {
    const every = (m = txt.match(/E(\d+)MOM/i)) ? Number(m[1]) * 60 : 60;
    const r = Number(txt.match(/E(?:\d+)?MOM\s*(?:x\s*)?(\d+)/i)[1]);
    return { mode: "emom", every, rounds: Math.max(1, Math.round(r * 60 / every)) };
  }
  if ((m = txt.match(/AMRAP\s*(\d+)/i))) return { mode: "amrap", minutes: Number(m[1]) };
  if ((m = txt.match(/tabata/i))) return { mode: "intervals", work: 20, rest: 10, rounds: 8 };
  if (w.type === "time" || /for\s*time/i.test(txt)) {
    const cap = (m = txt.match(/(?:time\s*cap|cap|tc)\s*:?\s*(\d+)\s*(?:'|min|m\b|′)?/i)) ? Number(m[1]) : 0;
    return { mode: "fortime", cap };
  }
  return null;
}

// Pulisce un timer salvato sul blocco (valori numerici validi e modalità nota)
export function sanitizeTimer(t) {
  if (!t || !MODES[t.mode]) return null;
  const n = (v, min, max, d) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : d; };
  const o = { mode: t.mode };
  if (t.mode === "fortime") o.cap = n(t.cap, 0, 180, 0);
  if (t.mode === "amrap" || t.mode === "countdown") o.minutes = n(t.minutes, 1, 180, 10);
  if (t.mode === "emom") { o.every = n(t.every, 5, 600, 60); o.rounds = n(t.rounds, 1, 200, 10); }
  if (t.mode === "intervals") { o.work = n(t.work, 1, 3600, 20); o.rest = n(t.rest, 0, 3600, 10); o.rounds = n(t.rounds, 1, 200, 8); }
  if (t.mode === "sequence") {
    o.parts = (Array.isArray(t.parts) ? t.parts : []).slice(0, 30).map(p => {
      const type = PART_TYPES[p?.type] ? p.type : "tempo";
      const label = String(p?.label || "").trim().slice(0, 40) || PART_TYPES[type];
      return type === "intervalli"
        ? { type, label, work: n(p.work, 1, 3600, 60), rest: n(p.rest, 0, 3600, 0), rounds: n(p.rounds, 1, 200, 1) }
        : { type, label, sec: n(p.sec, 1, 7200, 60) };
    });
    if (!o.parts.length) return null;
  }
  return o;
}

// Timer consigliato per un blocco: quello impostato sul blocco, altrimenti dedotto dal testo,
// altrimenti un cronometro semplice.
export function suggestTimer(w) {
  const saved = sanitizeTimer(w.timer);
  if (saved) return { cfg: saved, source: "blocco" };
  const auto = configFromSequence(w) || configFromWorkout(w) || configFromText(w);
  if (auto) return { cfg: auto, source: "auto" };
  return { cfg: { mode: "fortime", cap: 0 }, source: "base" };
}

// Altri formati comuni: "Every 2:00 x 5", "Every 90 sec for 10 rounds", "On the minute x 8", "8 rounds: 30s on / 30s off"
function configFromText(w) {
  const txt = `${w.tag || ""}\n${w.detail || ""}`;
  let m;
  if ((m = txt.match(/every\s*(\d+)(?::(\d{2}))?\s*(min|'|sec|s|")?[^\n]*?(?:x|for)\s*(\d+)/i))) {
    const unitSec = /sec|s|"/i.test(m[3] || "") && !m[2];
    const every = m[2] ? Number(m[1]) * 60 + Number(m[2]) : unitSec ? Number(m[1]) : Number(m[1]) * 60;
    return { mode: "emom", every, rounds: Number(m[4]) };
  }
  if ((m = txt.match(/on the minute[^\n]*?x\s*(\d+)/i))) return { mode: "emom", every: 60, rounds: Number(m[1]) };
  if ((m = txt.match(/(\d+)\s*(?:rounds?|round|sets?)[^\n]*?(\d+)\s*(?:s|sec|")\s*(?:on|work|lavoro)[^\n]*?(\d+)\s*(?:s|sec|")\s*(?:off|rest|riposo)/i)))
    return { mode: "intervals", rounds: Number(m[1]), work: Number(m[2]), rest: Number(m[3]) };
  return null;
}

// ---- Sequenze lette dal testo ----
// Durata dentro una riga: "1 min 30-sec", "1:30", "90 sec", "25-sec", "5 min", "5'"
export function parseDur(line) {
  let m;
  if ((m = line.match(/(\d+)\s*min(?:utes?|uti)?\.?\s*(?:and\s*|e\s*)?(\d+)\s*-?\s*(?:sec(?:onds?|ondi)?|s)\b/i))) return { sec: +m[1] * 60 + +m[2], text: m[0] };
  if ((m = line.match(/\b(\d{1,2}):(\d{2})\b/))) return { sec: +m[1] * 60 + +m[2], text: m[0] };
  if ((m = line.match(/(\d+)\s*-?\s*(?:sec(?:onds?|ondi)?|s\b|")/i))) return { sec: +m[1], text: m[0] };
  if ((m = line.match(/(\d+)\s*-?\s*(?:min(?:utes?|uti)?\b|'|′)/i))) return { sec: +m[1] * 60, text: m[0] };
  return null;
}
function allDurs(str) {
  const out = []; let d;
  while ((d = parseDur(str)) && out.length < 4) { out.push(d); str = str.replace(d.text, " "); }
  return out;
}
const tidy = (line, cut) => {
  const t = line.replace(cut, "").replace(/\b(of|di)\b/gi, " ").replace(/^[\s\-–·:,.]+|[\s\-–·:,.]+$/g, "").replace(/\s+/g, " ");
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};
const REST_RX = /\b(rest|riposo|recupero|off|pausa)\b/i;
const EASY_RX = /warm.?up|warm.?down|cool.?down|riscaldamento|defaticamento|jog|easy|walk|camminata/i;

// "5 min warm-up jog / 12 sets: 1 min 30-sec Row, 25-sec rest / 5 min warm-down" → sequenza
export function configFromSequence(w) {
  const lines = String(w.detail || "").split("\n").map(l => l.trim());
  const parts = [];
  let group = null;
  const close = () => { if (group?.work) parts.push({ type: "intervalli", label: group.label || "Lavoro", work: group.work, rest: group.rest || 0, rounds: group.rounds }); group = null; };
  for (const line of lines) {
    if (!line) { if (group?.work) close(); continue; }
    const sets = line.match(/^(\d+)\s*(?:x\s*)?(?:sets?|rounds?|serie|giri|round)\b/i) || line.match(/^(?:sets?|rounds?)\s*(?:x\s*)?(\d+)/i)
      || (/^(\d+)\s*x\s*/i.test(line) && parseDur(line.replace(/^(\d+)\s*x\s*/i, "")) ? line.match(/^(\d+)\s*x\s*/i) : null);
    if (sets) {
      close(); group = { rounds: Math.min(200, +sets[1]) };
      const rest = line.slice(line.indexOf(sets[0]) + sets[0].length);
      const ds = allDurs(rest);
      if (ds.length >= 2 && REST_RX.test(rest)) { group.work = ds[0].sec; group.rest = ds[1].sec; group.label = group.label || "Lavoro"; close(); }
      else if (ds.length && !REST_RX.test(rest)) { group.work = ds[0].sec; group.label = tidy(rest, ds[0].text); }
      continue;
    }
    const d = parseDur(line);
    if (group && d && d.sec >= 60 && EASY_RX.test(line) && group.work) close();
    if (group) {
      if (!d) { if (!group.label && !group.work) group.label = tidy(line, ""); continue; }
      if (REST_RX.test(line)) { group.rest = d.sec; close(); }
      else if (!group.work) { group.work = d.sec; group.label = tidy(line, d.text) || group.label; }
      continue;
    }
    if (d && d.sec >= 60 && EASY_RX.test(line)) parts.push({ type: "tempo", label: tidy(line, d.text) || "Tempo", sec: d.sec });
    else if (d && REST_RX.test(line) && parts.length) parts.push({ type: "riposo", label: "Riposo", sec: d.sec });
  }
  close();
  if (parts.length < 2 || !parts.some(p => p.type === "tempo") || !parts.some(p => p.type !== "tempo")) return null;
  return { mode: "sequence", parts };
}

export const sequenceTotal = (c) => totalDuration(buildSegments({ ...c, prep: 0 })) || 0;

export function describeTimer(c) {
  if (!c) return "";
  if (c.mode === "sequence") return `Sequenza · ${c.parts?.length || 0} parti · ${fmtClock(sequenceTotal(c))}`;
  if (c.mode === "fortime") return c.cap ? `Contare · time cap ${c.cap} min` : "Contare (cronometro)";
  if (c.mode === "amrap") return `AMRAP ${c.minutes} min`;
  if (c.mode === "countdown") return `Conto alla rovescia ${c.minutes} min`;
  if (c.mode === "emom") return `EMOM ogni ${c.every >= 60 && c.every % 60 === 0 ? `${c.every / 60} min` : `${c.every} s`} × ${c.rounds}`;
  return `${c.work}" lavoro – ${c.rest}" riposo × ${c.rounds}`;
}
