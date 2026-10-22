// Stima della durata dei blocchi e della giornata. Sempre una forbice (min–max) in secondi.
// Fonti, in ordine di affidabilità: timer del blocco → tempi reali del team → minuti scritti nel testo → regole per tipo.
import { suggestTimer, sequenceTotal } from "./timer.js";
import { CAP_BASE } from "./scoring.js";

export const TRANSITION = 180; // cambio tra un blocco e l'altro (attrezzi, acqua)
const m = (min) => min * 60;

function timerSeconds(c) {
  if (c.mode === "amrap" || c.mode === "countdown") return m(c.minutes);
  if (c.mode === "emom") return c.every * c.rounds;
  if (c.mode === "intervals") return c.rounds * c.work + Math.max(0, c.rounds - 1) * c.rest;
  if (c.mode === "sequence") return sequenceTotal(c);
  return null;
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); const i = Math.floor(s.length / 2); return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2; };

// entries: punteggi del team su questo blocco (servono per i For Time già fatti)
export function estimateBlock(w, entries = []) {
  const txt = `${w.tag || ""}\n${w.detail || ""}`;
  const sug = suggestTimer(w);
  const c = sug.cfg;
  if (sug.source !== "base" && c.mode !== "fortime") {
    const s = timerSeconds(c);
    if (s) return { min: s, max: s, sure: true, src: "timer" };
  }
  // For Time: tempi veri del team, poi il time cap
  if (w.type === "time" || c.mode === "fortime") {
    const times = entries.map(e => e.value).filter(v => v > 0 && v < CAP_BASE / 2);
    const cap = c.mode === "fortime" && c.cap ? m(c.cap) : null;
    if (times.length) { const md = median(times); return { min: Math.round(md * 0.85), max: Math.round(Math.min(cap || Infinity, md * 1.25)), sure: false, src: "team" }; }
    if (cap) return { min: Math.round(cap * 0.6), max: cap, sure: false, src: "cap" };
  }
  // minuti scritti nel testo: "60-75'", "Flow 20'", "20 min" (escluse le righe dei riposi)
  const work = txt.split("\n").filter(l => !/rest|riposo|recupero|tra le serie|between/i.test(l)).join("\n");
  let r;
  if ((r = work.match(/(\d{1,3})\s*[-–]\s*(\d{1,3})\s*(?:'|′|min)/i))) return { min: m(+r[1]), max: m(+r[2]), sure: false, src: "testo" };
  const single = [...work.matchAll(/\b(\d{1,3})\s*(?:'|′|min\b|minutes?)(?!\s*(?:rest|riposo|recupero|off))/gi)].map(x => +x[1]).filter(x => x >= 5 && x <= 120);
  if (single.length && !/\d+\s*(?:sets?|rounds?|serie|x)\b/i.test(work)) { const t = Math.max(...single); return { min: m(t), max: m(Math.round(t * 1.15)), sure: false, src: "testo" }; }
  // lavoro a serie: serie × (lavoro + riposo)
  const sets = +(txt.match(/(\d{1,2})\s*(?:sets?|rounds?|serie|giri)\b/i)?.[1] || txt.match(/\b\d{1,2}\s*x\s*\d{1,3}\b/i)?.[0].split(/x/i)[0] || 0);
  const lines = String(w.detail || "").split("\n").filter(l => l.trim() && !/rest|riposo|recupero/i.test(l)).length || 1;
  const restM = txt.match(/(?:rest|riposo|recupero)\D{0,12}(\d{1,3})\s*(?:-\s*(\d))?\s*(sec|s\b|"|'|min)?/i);
  let rest = 90;
  if (restM) { const v = +restM[1]; rest = /sec|s\b|"/i.test(restM[3] || "") || v > 10 ? v : v * 60; }
  if (sets) {
    const per = lines * 45 + rest;
    const t = sets * per;
    return { min: Math.round(t * 0.85), max: Math.round(t * 1.2 + 120), sure: false, src: "serie" };
  }
  if (w.type === "weight") return { min: m(12), max: m(20), sure: false, src: "tipo" };
  if (w.type === "rounds" || w.type === "reps") return { min: m(10), max: m(18), sure: false, src: "tipo" };
  if (w.type === "time") return { min: m(8), max: m(16), sure: false, src: "tipo" };
  return { min: m(Math.min(8 + lines * 2, 15)), max: m(Math.min(12 + lines * 3, 25)), sure: false, src: "tipo" };
}

const round5 = (s, up) => Math.max(5, (up ? Math.ceil : Math.floor)(s / 300) * 5);
export function estimateDay(workouts = [], entriesFor = () => []) {
  const blocks = workouts.map(w => ({ w, est: estimateBlock(w, entriesFor(w)) }));
  const tr = Math.max(0, blocks.length - 1) * TRANSITION;
  const min = blocks.reduce((a, b) => a + b.est.min, 0) + tr;
  const max = blocks.reduce((a, b) => a + b.est.max, 0) + tr;
  return { blocks, min, max, label: blocks.length ? fmtRange(min, max) : "" };
}

export function fmtRange(min, max) {
  const a = round5(min, false), b = round5(max, true);
  return a === b ? `${a} min` : `${a}–${b} min`;
}
export const fmtBlock = (e) => {
  const a = Math.round(e.min / 60), b = Math.round(e.max / 60);
  return e.sure || a === b ? `${b}'` : `~${a}–${b}'`;
};
