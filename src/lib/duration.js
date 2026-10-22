// Stima della durata dei blocchi e della giornata. Sempre una forbice (min–max) in secondi.
// Ordine: note informative (nessuna durata) → timer del blocco → lettura riga per riga del testo → tempi del team / time cap → regole per tipo.
// I blocchi OPTIONAL e le alternative ("recupero attivo 45-75 min") non entrano nel totale del giorno.
import { suggestTimer, sequenceTotal, parseDur } from "./timer.js";
import { CAP_BASE } from "./scoring.js";

export const TRANSITION = 180; // cambio tra un blocco e l'altro
const M = 60;

function timerSeconds(c) {
  if (c.mode === "amrap" || c.mode === "countdown") return c.minutes * M;
  if (c.mode === "emom") return c.every * c.rounds;
  if (c.mode === "intervals") return c.rounds * c.work + Math.max(0, c.rounds - 1) * c.rest;
  if (c.mode === "sequence") return sequenceTotal(c);
  return null;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); const i = Math.floor(s.length / 2); return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };

export const isOptional = (w) => /^\s*(optional|opzionale|facoltativ)/i.test(w.title || "") || /^\s*(optional|opzionale)/i.test(w.tag || "");

// Blocco solo informativo (descrizione del ciclo, note del coach): testo lungo in prosa, nessun esercizio
export function isInfo(w) {
  const t = String(w.title || "").trim();
  const d = String(w.detail || "");
  if (/^(notes?|note|info|week\s*\d+|settimana\s*\d+)\b/i.test(t) || /\bcycle\b|\bciclo\b/i.test(t)) return true;
  const lines = d.split("\n").filter(l => l.trim());
  const sentences = (d.match(/[.!?](\s|$)/g) || []).length;
  return d.length > 250 && lines.length <= 3 && sentences >= 3;
}

// Una riga del programma → secondi stimati
const PACE = [
  [/sled|farmer|carry|lunge|walking|sandbag/i, 0.9],
  [/burpee\s*broad|broad\s*jump/i, 1.3],
  [/row|ski/i, 0.24],
  [/bike|airbike|assault|echo/i, 0.12],
  [/swim/i, 1.2],
  [/run|jog|corsa/i, 0.3],
];
const REP = [[/burpee/i, 4], [/wall\s*ball/i, 2.6], [/pull-?up|chest|toes|t2b|hspu|muscle/i, 3], [/swing|sit-?up|crunch|twist|jump|du\b|double/i, 2], [/clean|snatch|jerk|deadlift|squat|press|thruster|lunge/i, 3.5]];
function lineSeconds(raw) {
  const l = raw.replace(/\*.*$/, "").trim();
  if (!l) return { work: 0 };
  const rest = /\b(rest|riposo|recupero)\b/i.test(l);
  const dAny = parseDur(l.replace(/\b\d{1,2}\/\d{1,2}\s*RPE\b/i, ""));
  if (dAny && rest) return { rest: dAny.sec };
  if (rest) return { rest: 60 };
  // durata solo se apre la riga ("3 min Threshold Run", "60-sec plank"): "24/20\"" è un'altezza, non un tempo
  const d = dAny && l.indexOf(dAny.text) === 0 ? dAny : null;
  if (d) return { work: d.sec, timed: true };
  let m;
  if ((m = l.match(/(\d{2,5})\s*m\b/i))) { const pace = PACE.find(([rx]) => rx.test(l))?.[1] ?? 0.3; return { work: +m[1] * pace }; }
  if ((m = l.match(/(\d{1,3})(?:\/\d{1,3})?\s*(?:reps?\s*)?[^\n]*?\b(cal|calories|calorie)\b/i))) return { work: +m[1] * 4 };
  if ((m = l.match(/^(\d{1,3})(?:\s*-\s*(\d{1,3}))?(?:\/\d{1,3})?\s*(reps?|x\b)?/i)) && (m[3] || /[a-z]/i.test(l.slice(m[0].length)))) {
    const reps = +(m[2] || m[1]) * (/\beach\b|per lato|per gamba/i.test(l) ? 2 : 1);
    const per = REP.find(([rx]) => rx.test(l))?.[1] ?? 3;
    return { work: reps * per };
  }
  return { work: 0 };
}

// Legge il testo a sezioni: righe singole si sommano, "N sets:/N Rounds:" moltiplica il gruppo fino alla riga vuota
export function textSeconds(detail, { strength = false } = {}) {
  const lines = String(detail || "").split("\n");
  let total = 0, group = null, found = false, untimed = false;
  const close = () => {
    if (!group) return;
    const work = group.items.reduce((a, x) => a + (x.work || 0), 0);
    const rest = group.rest ?? (strength && !group.timed ? 60 : 0);
    if (work) { total += group.n * work + Math.max(0, group.n - 1) * rest; found = true; if (group.items.some(x => x.work && !x.timed)) untimed = true; }
    group = null;
  };
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { close(); continue; }
    const h = l.match(/^(\d{1,2})\s*(?:x\s*)?(sets?|rounds?|serie|giri|round)\b/i);
    if (h) { close(); group = { n: +h[1], items: [], rest: null, timed: false }; continue; }
    if (/^(finisher|then|poi|cash.?out|buy.?in)\s*:?$/i.test(l)) { close(); continue; }
    const s = lineSeconds(l);
    if (group) {
      if (s.rest !== undefined) group.rest = s.rest;
      else { group.items.push(s); if (s.timed) group.timed = true; }
    } else {
      if (s.rest !== undefined) total += s.rest;
      else if (s.work) { total += s.work; found = true; if (!s.timed) untimed = true; }
    }
  }
  close();
  return found ? { sec: Math.round(total), exact: !untimed } : { sec: 0, exact: false };
}

// entries: punteggi del team su questo blocco
export function estimateBlock(w, entries = []) {
  if (isInfo(w)) {
    // nota con un'alternativa consigliata ("45-75 minutes of zone 2…")
    const r = String(w.detail || "").match(/(\d{2,3})\s*[-–]\s*(\d{2,3})\s*(?:minutes?|min|')/i);
    return r ? { min: +r[1] * M, max: +r[2] * M, sure: false, src: "alternativa", info: true, alt: true } : { min: 0, max: 0, info: true };
  }
  const txt = `${w.tag || ""}\n${w.detail || ""}`;
  const sug = suggestTimer(w);
  const c = sug.cfg;
  const strength = w.type === "weight" || /strength|forza|accessor/i.test(w.title || "");
  const tx = textSeconds(w.detail, { strength });
  if (sug.source !== "base" && c.mode !== "fortime") {
    const s = timerSeconds(c);
    // una sequenza letta dal testo può perdere dei pezzi: se la lettura riga per riga trova di più, vale quella
    if (s && c.mode === "sequence" && tx.sec > s * 1.1) return { min: Math.round(tx.sec * 0.95), max: Math.round(tx.sec * 1.15), sure: false, src: "testo" };
    if (s) return { min: s, max: s, sure: true, src: "timer" };
  }
  const cap = c.mode === "fortime" && c.cap ? c.cap * M : null;
  // For Time già fatto: tempi veri del team
  const times = entries.map(e => e.value).filter(v => v > 0 && v < CAP_BASE / 2);
  if ((w.type === "time" || c.mode === "fortime") && times.length) {
    const md = median(times);
    return { min: Math.round(md * 0.85), max: Math.round(Math.min(cap || Infinity, md * 1.25)), sure: false, src: "team" };
  }
  // minuti scritti esplicitamente come forbice: "60-75' corsa facile"
  const work = txt.split("\n").filter(l => !/rest|riposo|recupero|between|tra le serie/i.test(l)).join("\n");
  const r = work.match(/(\d{1,3})\s*[-–]\s*(\d{1,3})\s*(?:'|′|min)/i);
  if (r && !/\b\d+\s*(sets?|rounds?)\b/i.test(work)) return { min: +r[1] * M, max: +r[2] * M, sure: false, src: "testo" };
  // lettura riga per riga
  const t = tx.sec;
  if (t >= 60 && tx.exact) return { min: t, max: t, sure: true, src: "testo" };
  if (t >= 60) {
    let min = Math.round(t * 0.9), max = Math.round(t * 1.2 + 60);
    if (cap) { max = Math.min(max, cap); min = Math.min(min, cap * 0.9); }
    return { min, max: Math.max(min, max), sure: false, src: "testo" };
  }
  if (cap) return { min: Math.round(cap * 0.6), max: cap, sure: false, src: "cap" };
  if (w.type === "weight") return { min: 12 * M, max: 20 * M, sure: false, src: "tipo" };
  if (w.type === "rounds" || w.type === "reps") return { min: 10 * M, max: 18 * M, sure: false, src: "tipo" };
  if (w.type === "time") return { min: 8 * M, max: 16 * M, sure: false, src: "tipo" };
  return { min: 8 * M, max: 15 * M, sure: false, src: "tipo" };
}

const round5 = (s, up) => Math.max(5, (up ? Math.ceil : Math.floor)(s / 300) * 5);
export function fmtRange(min, max) {
  if (Math.abs(max - min) < 60) return `${Math.round(max / 60)} min`;
  const a = round5(min, false), b = round5(max, true);
  return a === b ? `${a} min` : `${a}–${b} min`;
}
export const fmtBlock = (e) => {
  if (!e || (e.info && !e.alt)) return "";
  const a = Math.round(e.min / 60), b = Math.round(e.max / 60);
  if (e.alt) return `alternativa ${a}–${b}'`;
  return e.sure || a === b ? `${b}'` : `~${a}–${b}'`;
};

// Giorno: totale dei blocchi principali; opzionali e alternative a parte
export function estimateDay(workouts = [], entriesFor = () => []) {
  const blocks = workouts.map(w => ({ w, est: estimateBlock(w, entriesFor(w)), optional: isOptional(w) }));
  const sum = (list) => {
    const n = list.length; const tr = Math.max(0, n - 1) * TRANSITION;
    return { n, min: list.reduce((a, b) => a + b.est.min, 0) + tr, max: list.reduce((a, b) => a + b.est.max, 0) + tr };
  };
  const main = sum(blocks.filter(b => !b.est.info && !b.optional));
  const opt = sum(blocks.filter(b => !b.est.info && b.optional));
  const alt = blocks.find(b => b.est.alt);
  let label = main.n ? fmtRange(main.min, main.max) : "";
  if (opt.n) label += `${label ? " " : ""}+ ${fmtRange(opt.min - (main.n ? 0 : 0), opt.max)} opzionali`;
  return { blocks, main, opt, alt: alt ? fmtRange(alt.est.min, alt.est.max) : null, label, min: main.min, max: main.max };
}
