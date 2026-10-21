import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, Pause, RotateCcw, X, Volume2, VolumeX, Timer as TimerIcon, Plus, Check } from "lucide-react";
import { MODES, DEFAULTS, buildSegments, stateAt, totalDuration, fmtClock } from "../lib/timer";
import { GREEN, CARD, LINE, MUTED, FONT, inp, pill, pillOn, btnGreen } from "../lib/theme";

const ORANGE = "#ff9f43", RED = "#ff5c5c";
const store = {
  get: () => { try { return JSON.parse(localStorage.getItem("timer:cfg")) || null; } catch { return null; } },
  set: (c) => { try { localStorage.setItem("timer:cfg", JSON.stringify(c)); } catch { /* privato */ } },
};

// ---- Suoni (Web Audio): bip corto per -3/-2/-1, lungo per il via e la fine ----
let ctx = null;
function audio() {
  if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (A) ctx = new A(); }
  if (ctx?.state === "suspended") ctx.resume();
  return ctx;
}
function beep(freq = 880, ms = 140, vol = 0.35) {
  const a = audio(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = "square"; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + ms / 1000);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + ms / 1000 + 0.02);
}
const sounds = {
  tick: () => { beep(880, 120); navigator.vibrate?.(60); },
  go: () => { beep(1320, 450, 0.45); navigator.vibrate?.(250); },
  rest: () => { beep(660, 400, 0.4); navigator.vibrate?.(200); },
  end: () => { beep(1320, 300, 0.45); setTimeout(() => beep(1320, 300, 0.45), 380); setTimeout(() => beep(1760, 700, 0.5), 760); navigator.vibrate?.([200, 100, 200, 100, 400]); },
};

// ---- Configurazione (dentro Utility) ----
export function TimerSetup({ onStart }) {
  const [c, setC] = useState({ ...DEFAULTS, ...store.get() });
  const set = (p) => setC(x => ({ ...x, ...p }));
  const numField = (key, label, unit, min = 1, max = 999) => (
    <label style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: "block", color: MUTED, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input value={c[key]} inputMode="numeric" aria-label={label}
          onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); set({ [key]: v === "" ? "" : Math.min(max, Number(v)) }); }}
          onBlur={() => set({ [key]: Math.max(min, Number(c[key]) || min) })}
          style={{ ...inp, width: "100%", textAlign: "center", fontSize: 20, fontWeight: 800 }} />
        <span style={{ color: MUTED, fontSize: 12.5 }}>{unit}</span>
      </div>
    </label>
  );
  const start = () => {
    const clean = { ...c };
    for (const k of ["minutes", "every", "rounds", "work"]) clean[k] = Math.max(1, Number(clean[k]) || 1);
    for (const k of ["cap", "rest"]) clean[k] = Math.max(0, Number(clean[k]) || 0);
    store.set(clean); setC(clean); onStart(clean);
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {Object.entries(MODES).map(([k, m]) => <button key={k} onClick={() => set({ mode: k })} style={{ ...pill, padding: "7px 12px", ...(c.mode === k ? pillOn : {}) }}>{m.label}</button>)}
      </div>
      <div style={{ color: MUTED, fontSize: 12.5, marginBottom: 12 }}>{MODES[c.mode].hint}</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        {(c.mode === "amrap" || c.mode === "countdown") && numField("minutes", "Durata", "min", 1, 180)}
        {c.mode === "fortime" && numField("cap", "Time cap (0 = nessuno)", "min", 0, 180)}
        {c.mode === "emom" && <>{numField("every", "Ogni", "sec", 5, 600)}{numField("rounds", "Round", "×", 1, 200)}</>}
        {c.mode === "intervals" && <>{numField("work", "Lavoro", "sec", 1, 3600)}{numField("rest", "Riposo", "sec", 0, 3600)}{numField("rounds", "Round", "×", 1, 200)}</>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ color: MUTED, fontSize: 12.5 }}>Conto alla rovescia iniziale</span>
        {[0, 5, 10].map(s => <button key={s} onClick={() => set({ prep: s })} style={{ ...pill, padding: "4px 11px", ...(c.prep === s ? pillOn : {}) }}>{s ? `${s} s` : "No"}</button>)}
        <button onClick={() => set({ sound: !c.sound })} aria-label={c.sound ? "Suono attivo" : "Suono disattivato"} style={{ ...pill, padding: "4px 10px", marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, ...(c.sound ? pillOn : {}) }}>
          {c.sound ? <Volume2 size={14} /> : <VolumeX size={14} />} {c.sound ? "Suono" : "Muto"}
        </button>
      </div>
      <button onClick={start} style={{ ...btnGreen, width: "100%", justifyContent: "center", padding: 15, fontSize: 17, borderRadius: 14 }}><Play size={18} fill="#0b0b0b" /> Avvia timer</button>
    </div>
  );
}

// ---- Schermo intero ----
export function TimerScreen({ config, title, onClose, onResult }) {
  const segs = useRef(buildSegments(config)).current;
  const total = totalDuration(segs);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);   // secondi (con decimali)
  const [rounds, setRounds] = useState(0);     // contatore round manuale (AMRAP)
  const [stopped, setStopped] = useState(null); // tempo fermato a mano (For Time)
  const base = useRef({ startedAt: 0, acc: 0 });
  const last = useRef({ i: -1, sec: null, ended: false });
  const wake = useRef(null);
  const sound = config.sound;

  const st = stateAt(segs, elapsed);

  // ciclo di aggiornamento
  useEffect(() => {
    if (!running) return;
    let raf;
    const loop = () => {
      const t = base.current.acc + (performance.now() - base.current.startedAt) / 1000;
      setElapsed(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const iv = setInterval(() => setElapsed(base.current.acc + (performance.now() - base.current.startedAt) / 1000), 250); // anche se rAF rallenta
    return () => { cancelAnimationFrame(raf); clearInterval(iv); };
  }, [running]);

  // suoni e fine
  useEffect(() => {
    if (!running) return;
    const L = last.current;
    if (st.done) {
      if (!L.ended) { L.ended = true; sound && sounds.end(); setRunning(false); releaseWake(); }
      return;
    }
    if (st.i !== L.i) {
      if (L.i !== -1 || st.seg.kind !== "prep") sound && (st.seg.kind === "rest" ? sounds.rest() : sounds.go());
      L.i = st.i; L.sec = null;
    }
    if (st.remaining !== null) {
      const sec = Math.ceil(st.remaining);
      if (sec !== L.sec) { L.sec = sec; if (sec >= 1 && sec <= 3 && st.seg.dur > 3) sound && sounds.tick(); }
    }
  }, [elapsed, running]);

  const requestWake = async () => { try { wake.current = await navigator.wakeLock?.request("screen"); } catch { /* non supportato */ } };
  const releaseWake = () => { try { wake.current?.release(); } catch { /* */ } wake.current = null; };
  useEffect(() => () => releaseWake(), []);

  const play = () => {
    audio(); beep(1, 1, 0.0001); // sblocca l'audio su iPhone (serve un tocco)
    base.current.startedAt = performance.now();
    setRunning(true); setStopped(null); requestWake();
  };
  const pause = () => { base.current.acc = elapsed; setRunning(false); releaseWake(); };
  const reset = () => { setRunning(false); setElapsed(0); setRounds(0); setStopped(null); base.current = { startedAt: 0, acc: 0 }; last.current = { i: -1, sec: null, ended: false }; releaseWake(); };
  const finish = () => { pause(); setStopped(st.workElapsed); sound && sounds.end(); };

  const seg = st.seg;
  const color = seg.kind === "prep" ? ORANGE : seg.kind === "rest" ? ORANGE : GREEN;
  const big = seg.up ? st.inSeg : st.remaining;
  const urgent = !seg.up && st.remaining !== null && st.remaining <= 3.05 && running;
  const segProgress = seg.dur ? Math.min(1, st.inSeg / seg.dur) : 0;
  const notStarted = elapsed === 0 && !running;
  const isForTime = config.mode === "fortime";
  const resultSec = stopped ?? (st.done && isForTime ? st.workElapsed : null);
  const R = 132, C = 2 * Math.PI * R;

  return createPortal(
    <div role="dialog" aria-label="Timer" style={{ position: "fixed", inset: 0, zIndex: 70, background: "#070707", color: "#fff", display: "flex", flexDirection: "column", fontFamily: FONT, userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "max(12px, env(safe-area-inset-top)) 14px 8px" }}>
        <button onClick={() => { releaseWake(); onClose(); }} aria-label="Chiudi timer" style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={20} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title || MODES[config.mode].label}</div>
          <div style={{ color: MUTED, fontSize: 12 }}>{summary(config)}</div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 12 }}>
        <div style={{ position: "relative", width: 300, height: 300, maxWidth: "80vw", maxHeight: "80vw" }}>
          <svg viewBox="0 0 300 300" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
            <circle cx="150" cy="150" r={R} fill="none" stroke="#1d1d1d" strokeWidth="14" />
            {seg.dur && <circle cx="150" cy="150" r={R} fill="none" stroke={urgent ? RED : color} strokeWidth="14" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * segProgress} />}
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: urgent ? RED : color, fontWeight: 900, fontSize: 15, letterSpacing: 2, textTransform: "uppercase" }}>
              {st.done ? "Fine!" : notStarted ? "Pronto" : seg.label}
            </div>
            <div aria-live="off" style={{ fontSize: seg.kind === "prep" ? 96 : 76, fontWeight: 900, fontVariantNumeric: "tabular-nums", letterSpacing: -2, lineHeight: 1.05, color: urgent ? RED : "#fff" }}>
              {seg.kind === "prep" && !notStarted ? Math.ceil(st.remaining) : fmtClock(notStarted ? (seg.up ? 0 : seg.dur) : (resultSec ?? big))}
            </div>
            {seg.rounds > 0 && !st.done && <div style={{ color: "#ddd", fontSize: 17, fontWeight: 800 }}>Round {seg.round} / {seg.rounds}</div>}
            {(config.mode === "emom" || config.mode === "intervals") && !notStarted && <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>Totale {fmtClock(st.workElapsed)}{total ? ` / ${fmtClock(total - (segs[0]?.kind === "prep" ? segs[0].dur : 0))}` : ""}</div>}
            {isForTime && config.cap > 0 && !notStarted && <div style={{ color: MUTED, fontSize: 13, marginTop: 2 }}>Time cap {config.cap}:00</div>}
          </div>
        </div>

        {config.mode === "amrap" && (
          <button onClick={() => setRounds(r => r + 1)} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: CARD, border: `1px solid ${LINE}`, color: "#fff", borderRadius: 16, padding: "12px 18px", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
            <Plus size={18} color={GREEN} /> Round fatti: <span style={{ color: GREEN, fontSize: 22 }}>{rounds}</span>
          </button>
        )}

        {resultSec !== null && onResult && (
          <button onClick={() => onResult(Math.round(resultSec), st.done && config.cap > 0 && !stopped)} style={{ ...btnGreen, padding: "13px 20px", fontSize: 16, borderRadius: 14 }}>
            <Check size={18} /> Registra {st.done && config.cap > 0 && !stopped ? "CAP" : fmtClock(resultSec)} come punteggio
          </button>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 18, padding: "10px 16px max(22px, env(safe-area-inset-bottom))" }}>
        <button onClick={reset} aria-label="Azzera" style={ctrl("#1d1d1d", "#fff", 60)}><RotateCcw size={24} /></button>
        {running
          ? <button onClick={pause} aria-label="Pausa" style={ctrl("#fff", "#0b0b0b", 84)}><Pause size={36} fill="#0b0b0b" /></button>
          : <button onClick={play} disabled={st.done} aria-label={notStarted ? "Avvia" : "Riprendi"} style={{ ...ctrl(GREEN, "#0b0b0b", 84), opacity: st.done ? 0.4 : 1 }}><Play size={36} fill="#0b0b0b" style={{ marginLeft: 4 }} /></button>}
        {isForTime
          ? <button onClick={finish} disabled={notStarted || resultSec !== null} aria-label="Ho finito" style={{ ...ctrl("#1d1d1d", GREEN, 60), opacity: notStarted || resultSec !== null ? 0.4 : 1, fontSize: 12, fontWeight: 900 }}>STOP</button>
          : <div style={{ width: 60 }} />}
      </div>
    </div>,
    document.body
  );
}

const ctrl = (bg, fg, size) => ({ width: size, height: size, borderRadius: size / 2, background: bg, color: fg, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" });

function summary(c) {
  const prep = c.prep ? ` · via dopo ${c.prep} s` : "";
  if (c.mode === "fortime") return `${c.cap ? `Time cap ${c.cap} min` : "Senza time cap"}${prep}`;
  if (c.mode === "amrap") return `${c.minutes} minuti${prep}`;
  if (c.mode === "countdown") return `${c.minutes} minuti${prep}`;
  if (c.mode === "emom") return `Ogni ${c.every} s × ${c.rounds} round${prep}`;
  return `${c.work}s lavoro / ${c.rest}s riposo × ${c.rounds}${prep}`;
}

export const TimerIconSmall = TimerIcon;
