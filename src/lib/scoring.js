// Logica punteggi stile SugarWOD.
// Ogni tipo ha un verso di ordinamento e una conversione testo -> numero confrontabile.
import { Clock, Flame, Dumbbell, Repeat } from "lucide-react";

export const CAP_BASE = 1_000_000; // i "CAP+reps" finiscono dopo tutti i tempi completati

export const TYPE_META = {
  time:   { better: "asc",  icon: Clock,    unit: "",      placeholder: "8:42 oppure CAP+12", label: "For Time" },
  reps:   { better: "desc", icon: Flame,    unit: "reps",  placeholder: "120",                label: "Reps" },
  rounds: { better: "desc", icon: Repeat,   unit: "",      placeholder: "5+12",               label: "Round + reps" },
  weight: { better: "desc", icon: Dumbbell, unit: "kg",    placeholder: "80",                 label: "Carico" },
};
export const TYPES = ["time", "reps", "rounds", "weight", "note"];
export const TYPE_LABEL = { time: "For Time", reps: "Reps", rounds: "Round + reps", weight: "Carico", note: "Nota (no punteggio)" };

const num = (s) => { const n = Number(String(s).replace(",", ".")); return Number.isFinite(n) ? n : null; };

// Restituisce il valore numerico, oppure null se il formato non è valido.
export function toValue(type, raw) {
  raw = String(raw || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) return null;
  if (type === "time") {
    const cap = raw.match(/^cap\+?(\d+)$/);
    if (cap) return CAP_BASE - Number(cap[1]);
    let m;
    if ((m = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})$/))) return +m[1] * 3600 + +m[2] * 60 + +m[3];
    if ((m = raw.match(/^(\d{1,3})[:.'](\d{2})$/)) && +m[2] < 60) return +m[1] * 60 + +m[2];
    if (/^\d+$/.test(raw)) return Number(raw);
    return null;
  }
  if (type === "rounds") {
    const m = raw.match(/^(\d+)(?:\+(\d+))?$/);
    if (!m) return null;
    return Number(m[1]) * 1000 + Number(m[2] || 0);
  }
  const n = num(raw);
  return n === null || n < 0 ? null : n;
}

export function display(type, value, raw) {
  if (type === "time") {
    if (value > CAP_BASE / 2) return `CAP +${CAP_BASE - value}`;
    const h = Math.floor(value / 3600), m = Math.floor((value % 3600) / 60), s = Math.round(value % 60);
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }
  if (type === "rounds") { const r = Math.floor(value / 1000), x = value % 1000; return x ? `${r}+${x}` : `${r} rd`; }
  const unit = TYPE_META[type]?.unit;
  return `${raw ?? value}${unit ? " " + unit : ""}`;
}

export function formatHint(type) {
  if (type === "time") return "Usa mm:ss (es. 8:42) oppure CAP+reps se non hai finito.";
  if (type === "rounds") return "Usa round+reps, es. 5+12.";
  return "Inserisci un numero.";
}

// Classifica: miglior risultato per atleta, Rx sopra Scaled a parità di regole SugarWOD.
export function buildBoard(entries, type, division = "all") {
  const meta = TYPE_META[type] || TYPE_META.time;
  const better = (a, b) => meta.better === "asc" ? a.value < b.value : a.value > b.value;
  const pool = entries.filter(e => division === "all" || (division === "rx" ? e.rx : !e.rx));
  const byName = {};
  for (const e of pool) {
    const cur = byName[e.name];
    if (!cur || (e.rx && !cur.rx) || (e.rx === cur.rx && better(e, cur))) byName[e.name] = e;
  }
  return Object.values(byName).sort((a, b) => {
    if (division === "all" && a.rx !== b.rx) return a.rx ? -1 : 1;
    return meta.better === "asc" ? a.value - b.value : b.value - a.value;
  });
}
