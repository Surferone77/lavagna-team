import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, Pause, RotateCcw, X, Volume2, VolumeX, Plus, Check, Trash2, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { MODES, DEFAULTS, DEFAULT_PARTS, PART_TYPES, buildSegments, stateAt, totalDuration, fmtClock, sanitizeTimer, sequenceTotal } from "../lib/timer";
import SevenSeg from "./SevenSeg";
import { GREEN, LINE, MUTED, FONT, inp, pill, pillOn, btnGreen } from "../lib/theme";

const BLUE = "#2F86FF";
const ls = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privato */ } },
};

// ---- Suoni (Web Audio): bip corto a -3/-2/-1, lungo al via e a fine intervallo ----
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

// Elenco modalità come sull'orologio del box: codice LED + nome + descrizione
const LIST = [
  { code: "UP", title: "Contare", sub: "00:00 → 99:59 · For Time con time cap facoltativo", cfg: { mode: "fortime" } },
  { code: "dn", title: "Conto alla rovescia", sub: "Dal tempo scelto fino a 00:00", cfg: { mode: "countdown" } },
  { code: "AP", title: "AMRAP", sub: "Più round possibili in N minuti", cfg: { mode: "amrap" } },
  { code: "En", title: "EMOM", sub: "Un intervallo ogni N secondi", cfg: { mode: "emom" } },
  { code: "H1", title: "Intervalli", sub: "Lavoro / riposo per N round", cfg: { mode: "intervals" } },
  { code: "tb", title: "Tabata", sub: "8 round · 20\" lavoro – 10\" riposo", cfg: { mode: "intervals", work: 20, rest: 10, rounds: 8 } },
  { code: "SE", title: "Sequenza", sub: "Tutto il workout di fila: warm-up, intervalli, riposi", cfg: { mode: "sequence" } },
];
const CODE = { fortime: "UP", countdown: "dn", amrap: "AP", emom: "En", intervals: "H1", sequence: "SE" };

function Row({ code, title, sub, open, onClick, children, extra }) {
  return (
    <div style={{ borderBottom: `1px solid ${LINE}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={onClick} aria-expanded={open} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 14, background: "none", border: "none", padding: "12px 2px", cursor: "pointer", textAlign: "left" }}>
        <div style={{ width: 58, flexShrink: 0 }}><SevenSeg text={code} size={34} color={BLUE} off="rgba(47,134,255,0.08)" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>{title}</div>
          <div style={{ color: MUTED, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
        </div>
        <ChevronDown size={18} color={MUTED} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
      </button>
      {extra}
      </div>
      {open && <div style={{ padding: "2px 2px 16px" }}>{children}</div>}
    </div>
  );
}

// ---- Scelta e configurazione (dentro Utility) ----
export function TimerSetup({ onStart, onAssign }) {
  const [openKey, setOpenKey] = useState(null);
  const [favs, setFavs] = useState(ls.get("timer:favs", []));
  const saveFavs = (f) => { setFavs(f); ls.set("timer:favs", f); };
  const base = ls.get("timer:cfg", {});
  const common = { prep: base.prep ?? DEFAULTS.prep, sound: base.sound ?? true };

  return (
    <div>
      {LIST.map((r, i) => (
        <Row key={r.code} {...r} open={openKey === `l${i}`} onClick={() => setOpenKey(openKey === `l${i}` ? null : `l${i}`)}>
          <Config initial={{ ...DEFAULTS, ...common, ...(base.mode === r.cfg.mode && !r.cfg.work ? base : {}), ...r.cfg, ...(r.cfg.mode === "sequence" ? { parts: base.mode === "sequence" && base.parts?.length ? base.parts : DEFAULT_PARTS } : {}) }} onStart={onStart} onAssign={onAssign}
            onSave={(c, name) => { saveFavs([...favs, { ...c, name }]); setOpenKey(`f${favs.length}`); }} />
        </Row>
      ))}
      {favs.map((f, i) => (
        <Row key={`f${i}`} code={`P${(i + 1) % 10}`} title={f.name} sub={describe(f)} open={openKey === `f${i}`} onClick={() => setOpenKey(openKey === `f${i}` ? null : `f${i}`)}
          extra={<button onClick={() => onStart(f)} aria-label={`Avvia ${f.name}`} style={{ ...btnGreen, padding: "8px 11px", borderRadius: 10, flexShrink: 0 }}><Play size={14} fill="#0b0b0b" /></button>}>
          <Config initial={f} onStart={onStart} onAssign={onAssign} favName={f.name}
            onSave={(c, name) => saveFavs(favs.map((x, k) => k === i ? { ...c, name } : x))}
            onDelete={() => { saveFavs(favs.filter((_, k) => k !== i)); setOpenKey(null); }} />
        </Row>
      ))}
      <div style={{ color: MUTED, fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, paddingTop: 12 }}>
        <Plus size={15} color={GREEN} /> Apri una modalità, imposta i valori e premi <b style={{ color: "#ddd" }}>Salva</b> per creare un timer personalizzato.
      </div>
    </div>
  );
}

function Config({ initial, onStart, onSave, onDelete, favName, onAssign }) {
  const [c, setC] = useState(initial);
  const [name, setName] = useState(favName || "");
  const [naming, setNaming] = useState(false);
  const set = (p) => setC(x => ({ ...x, ...p }));
  const clean = () => {
    const o = { ...c };
    for (const k of ["minutes", "every", "rounds", "work"]) o[k] = Math.max(1, Number(o[k]) || 1);
    for (const k of ["cap", "rest"]) o[k] = Math.max(0, Number(o[k]) || 0);
    if (o.mode === "sequence") o.parts = sanitizeTimer(o)?.parts || DEFAULT_PARTS;
    return o;
  };
  const num = (key, label, unit, min = 1, max = 999) => (
    <label style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: "block", color: MUTED, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <input value={c[key]} inputMode="numeric" aria-label={label}
          onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); set({ [key]: v === "" ? "" : Math.min(max, Number(v)) }); }}
          onBlur={() => set({ [key]: Math.max(min, Number(c[key]) || min) })}
          style={{ ...inp, width: "100%", textAlign: "center", fontSize: 20, fontWeight: 800 }} />
        <span style={{ color: MUTED, fontSize: 12 }}>{unit}</span>
      </div>
    </label>
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(c.mode === "amrap" || c.mode === "countdown") && num("minutes", "Durata", "min", 1, 180)}
        {c.mode === "fortime" && num("cap", "Time cap (0 = no)", "min", 0, 180)}
        {c.mode === "emom" && <>{num("every", "Ogni", "sec", 5, 600)}{num("rounds", "Round", "×", 1, 200)}</>}
        {c.mode === "intervals" && <>{num("work", "Lavoro", "sec", 1, 3600)}{num("rest", "Riposo", "sec", 0, 3600)}{num("rounds", "Round", "×", 1, 200)}</>}
      </div>
      {c.mode === "sequence" && <div style={{ marginBottom: 12 }}><SequenceEditor parts={c.parts || DEFAULT_PARTS} onChange={(parts) => set({ parts })} /></div>}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ color: MUTED, fontSize: 12.5 }}>Via dopo</span>
        {[0, 5, 10].map(s => <button key={s} onClick={() => set({ prep: s })} style={{ ...pill, padding: "4px 11px", ...(c.prep === s ? pillOn : {}) }}>{s ? `${s} s` : "subito"}</button>)}
        <button onClick={() => set({ sound: !c.sound })} aria-label={c.sound ? "Suono attivo" : "Suono disattivato"} style={{ ...pill, padding: "4px 10px", marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, ...(c.sound ? pillOn : {}) }}>
          {c.sound ? <Volume2 size={14} /> : <VolumeX size={14} />} {c.sound ? "Suono" : "Muto"}
        </button>
      </div>
      {naming && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <input value={name} onChange={e => setName(e.target.value.slice(0, 30))} placeholder="Nome, es. EMOM 12 burpee" aria-label="Nome timer" autoFocus style={{ ...inp, flex: 1, minWidth: 0 }} />
          <button onClick={() => { if (!name.trim()) return; onSave(clean(), name.trim()); setNaming(false); }} style={{ ...btnGreen, borderRadius: 12 }}><Check size={16} /> Salva</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { const o = clean(); ls.set("timer:cfg", o); onStart(o); }} style={{ ...btnGreen, flex: 1, justifyContent: "center", padding: 14, fontSize: 16, borderRadius: 14 }}><Play size={17} fill="#0b0b0b" /> Avvia</button>
        {!naming && <button onClick={() => setNaming(true)} style={{ ...pill, borderRadius: 14, padding: "0 14px", fontSize: 13 }}>{favName ? "Rinomina / salva" : "Salva"}</button>}
        {onDelete && <button onClick={onDelete} aria-label="Elimina timer" style={{ ...pill, borderRadius: 14, padding: "0 12px", color: "#ff8a8a" }}><Trash2 size={15} /></button>}
      </div>
      {onAssign && <button onClick={() => onAssign(clean())} style={{ ...pill, width: "100%", marginTop: 8, padding: "10px 12px", borderRadius: 12, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Check size={15} /> Imposta come timer di questo blocco</button>}
    </div>
  );
}

function describe(c) {
  const prep = c.prep ? ` · via dopo ${c.prep}s` : "";
  if (c.mode === "sequence") return `Sequenza · ${c.parts?.length || 0} parti · ${fmtClock(sequenceTotal(c))}${prep}`;
  if (c.mode === "fortime") return `Contare${c.cap ? ` · cap ${c.cap} min` : ""}${prep}`;
  if (c.mode === "amrap") return `AMRAP ${c.minutes} min${prep}`;
  if (c.mode === "countdown") return `Conto alla rovescia ${c.minutes} min${prep}`;
  if (c.mode === "emom") return `Ogni ${c.every}s × ${c.rounds}${prep}`;
  return `${c.work}" lavoro – ${c.rest}" riposo × ${c.rounds}${prep}`;
}

// dimensione delle cifre in base allo schermo (funziona anche in orizzontale)
// In orizzontale su telefoni bassi i comandi vanno a destra e le cifre usano l'altezza libera
const isLand = () => window.innerWidth > window.innerHeight && window.innerHeight < 560;
function useDigitSize(chars, extra = 0) {
  const calc = () => {
    const w = window.innerWidth, h = window.innerHeight;
    if (isLand()) return Math.max(40, Math.min(((w - 130) * 0.9) / (chars * 0.68), (h - 150 - extra) * 0.95));
    return Math.max(40, Math.min((w * 0.92) / (chars * 0.68), h * 0.36));
  };
  const [s, setS] = useState(calc);
  const [land, setLand] = useState(isLand);
  useEffect(() => { const f = () => { setS(calc()); setLand(isLand()); }; f(); window.addEventListener("resize", f); window.addEventListener("orientationchange", f); return () => { window.removeEventListener("resize", f); window.removeEventListener("orientationchange", f); }; }, [chars, extra]);
  return [s, land];
}

// ---- Schermo intero, stile orologio da box ----
export function TimerScreen({ config, title, onClose, onResult }) {
  const segs = useRef(buildSegments(config)).current;
  const total = totalDuration(segs);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [stopped, setStopped] = useState(null);
  const [sound, setSound] = useState(config.sound);
  const base = useRef({ startedAt: 0, acc: 0 });
  const last = useRef({ i: -1, sec: null, ended: false });
  const wake = useRef(null);
  const soundRef = useRef(sound); soundRef.current = sound;

  const st = stateAt(segs, elapsed);

  useEffect(() => {
    if (!running) return;
    let raf;
    const now = () => base.current.acc + (performance.now() - base.current.startedAt) / 1000;
    const loop = () => { setElapsed(now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const iv = setInterval(() => setElapsed(now()), 250);
    return () => { cancelAnimationFrame(raf); clearInterval(iv); };
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const L = last.current, snd = soundRef.current;
    if (st.done) {
      if (!L.ended) { L.ended = true; snd && sounds.end(); setRunning(false); releaseWake(); }
      return;
    }
    if (st.i !== L.i) {
      if (L.i !== -1 || st.seg.kind !== "prep") snd && (st.seg.kind === "rest" ? sounds.rest() : sounds.go());
      L.i = st.i; L.sec = null;
    }
    if (st.remaining !== null) {
      const sec = Math.ceil(st.remaining);
      if (sec !== L.sec) { L.sec = sec; if (sec >= 1 && sec <= 3 && st.seg.dur > 3) snd && sounds.tick(); }
    }
  }, [elapsed, running]);

  const requestWake = async () => { try { wake.current = await navigator.wakeLock?.request("screen"); } catch { /* non supportato */ } };
  const releaseWake = () => { try { wake.current?.release(); } catch { /* */ } wake.current = null; };
  useEffect(() => () => releaseWake(), []);

  const play = () => { audio(); beep(1, 1, 0.0001); base.current.startedAt = performance.now(); setRunning(true); setStopped(null); requestWake(); };
  const pause = () => { base.current.acc = elapsed; setRunning(false); releaseWake(); };
  const reset = () => { setRunning(false); setElapsed(0); setRounds(0); setStopped(null); base.current = { startedAt: 0, acc: 0 }; last.current = { i: -1, sec: null, ended: false }; releaseWake(); };
  const finish = () => { pause(); setStopped(st.workElapsed); soundRef.current && sounds.end(); };

  const seg = st.seg;
  const notStarted = elapsed === 0 && !running;
  const isForTime = config.mode === "fortime";
  const resultSec = stopped ?? (st.done && isForTime ? st.workElapsed : null);
  const color = (seg.kind === "prep" || seg.kind === "rest") && !notStarted && !st.done ? BLUE : GREEN;
  const urgent = running && !seg.up && st.remaining !== null && st.remaining <= 3.05;
  const blinkOff = urgent && (st.remaining % 1) < 0.5;

  let clock;
  if (resultSec !== null) clock = fmtClock(resultSec);
  else if (notStarted) clock = fmtClock(seg.kind === "prep" ? (segs[1]?.up ? 0 : segs[1]?.dur || 0) : (seg.up ? 0 : seg.dur));
  else if (st.done) clock = "00:00";
  else if (seg.kind === "prep") clock = `  :${String(Math.ceil(st.remaining)).padStart(2, "0")}`;
  else clock = fmtClock(seg.up ? st.inSeg : st.remaining);
  const [size, land] = useDigitSize(clock.replace(":", "").length + 0.6, (config.mode === "sequence" ? 40 : 0) + (config.mode === "amrap" || resultSec !== null ? 50 : 0));

  const isSeq = config.mode === "sequence";
  const paused = !running && !notStarted && !st.done && resultSec === null;
  const phase = st.done ? (isForTime && stopped === null && config.cap ? "Time cap" : "Fine") : notStarted ? "Pronto" : seg.kind === "prep" ? "Preparati" : seg.kind === "rest" ? "Riposo" : seg.up ? "Via!" : "Lavoro";
  const roundText = seg.rounds > 0 ? String(Math.min(seg.round, 99)).padStart(2, "0") : config.mode === "amrap" ? String(Math.min(rounds, 99)).padStart(2, "0") : "--";

  return createPortal(
    <div role="dialog" aria-label="Timer" style={{ position: "fixed", inset: 0, zIndex: 70, background: "#050505", color: "#fff", display: "flex", flexDirection: "column", fontFamily: FONT, userSelect: "none", WebkitUserSelect: "none" }}>
      {/* barra superiore: codice modalità e round */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "max(12px, env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) 6px max(14px, env(safe-area-inset-left))" }}>
        <SevenSeg text={CODE[config.mode] || "UP"} size={30} color={BLUE} off="rgba(47,134,255,0.08)" />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <SevenSeg text="r" size={30} color={GREEN} off="rgba(184,255,44,0.06)" />
          <SevenSeg text={roundText} size={30} color={GREEN} off="rgba(184,255,44,0.06)" label={`Round ${roundText}`} />
          {seg.rounds > 0 && <span style={{ color: MUTED, fontSize: 13, fontWeight: 700 }}>/ {seg.rounds}</span>}
          {isSeq && (seg.part || segs[1]?.part) && <span style={{ color: MUTED, fontSize: 12, fontWeight: 700, marginLeft: 4 }}>P{seg.part || segs[1].part}/{(seg.parts || segs[1].parts)}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: "right", color: MUTED, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title || describe(config)}</div>
        <button onClick={() => setSound(s => !s)} aria-label={sound ? "Disattiva suono" : "Attiva suono"} style={iconBtn}>{sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
        <button onClick={() => { releaseWake(); onClose(); }} aria-label="Chiudi timer" style={iconBtn}><X size={20} /></button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: land ? "row" : "column" }}>
      {/* orologio */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: land ? 6 : size * 0.12 }}>
        <div onClick={() => { if (st.done) return; running ? pause() : play(); }} title={running ? "Tocca per mettere in pausa" : "Tocca per avviare"}
          style={{ opacity: blinkOff ? 0.35 : 1, transition: "opacity .08s", cursor: "pointer" }}>
          <SevenSeg text={clock} size={size} color={color} off="rgba(255,255,255,0.045)" label={clock} />
        </div>
        <div style={{ color, fontWeight: 900, fontSize: Math.max(14, size * 0.16), letterSpacing: 4, textTransform: "uppercase" }}>{paused ? "Pausa" : stopped !== null && !st.done ? "Fermato" : phase}</div>
        {isSeq && (() => {
          const cur = seg.kind === "prep" ? segs[1] : seg;
          const next = st.done ? null : segs[(seg.kind === "prep" ? 1 : st.i) + 1];
          return <div style={{ textAlign: "center", lineHeight: 1.35 }}>
            {cur && !st.done && <div style={{ color: "#fff", fontSize: Math.max(15, size * 0.13), fontWeight: 800 }}>{cur.partLabel} <span style={{ color: MUTED, fontWeight: 700, fontSize: "0.8em" }}>· parte {cur.part}/{cur.parts}</span></div>}
            {next && <div style={{ color: MUTED, fontSize: 13.5 }}>Poi: {next.kind === "rest" ? "Riposo" : next.label} {fmtClock(next.dur)}</div>}
          </div>;
        })()}
        {(config.mode === "emom" || config.mode === "intervals" || isSeq) && !notStarted && (
          <div style={{ color: MUTED, fontSize: 13 }}>Totale {fmtClock(st.workElapsed)}{total ? ` / ${fmtClock(total - (segs[0]?.kind === "prep" ? segs[0].dur : 0))}` : ""}</div>
        )}
        {isForTime && config.cap > 0 && <div style={{ color: MUTED, fontSize: 13 }}>Time cap {config.cap}:00</div>}
        {config.mode === "amrap" && (
          <button onClick={() => setRounds(r => r + 1)} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(184,255,44,0.1)", border: "1px solid rgba(184,255,44,0.35)", color: GREEN, borderRadius: 14, padding: "10px 18px", fontSize: 15, fontWeight: 900, cursor: "pointer", marginTop: 4 }}>
            <Plus size={18} /> ROUND
          </button>
        )}
        {resultSec !== null && onResult && (
          <button onClick={() => onResult(Math.round(resultSec), st.done && config.cap > 0 && stopped === null)} style={{ ...btnGreen, padding: "12px 18px", fontSize: 15, borderRadius: 14, marginTop: 4 }}>
            <Check size={18} /> Registra {st.done && config.cap > 0 && stopped === null ? "CAP" : fmtClock(resultSec)} come punteggio
          </button>
        )}
      </div>

      {/* comandi: sotto in verticale, a destra in orizzontale */}
      <div style={land
        ? { display: "flex", flexDirection: "column-reverse", justifyContent: "center", alignItems: "center", gap: 14, padding: "8px max(16px, env(safe-area-inset-right)) 12px 8px" }
        : { display: "flex", justifyContent: "center", alignItems: "center", gap: 22, padding: "8px 16px max(20px, env(safe-area-inset-bottom))" }}>
        <button onClick={reset} aria-label="Azzera" style={ctrl("#151515", "#fff", 58)}><RotateCcw size={22} /></button>
        {running
          ? <button onClick={pause} aria-label="Pausa" style={ctrl("#fff", "#050505", 78)}><Pause size={32} fill="#050505" /></button>
          : <button onClick={play} disabled={st.done} aria-label={notStarted ? "Avvia" : "Riprendi"} style={{ ...ctrl(GREEN, "#050505", 78), opacity: st.done ? 0.35 : 1 }}><Play size={32} fill="#050505" style={{ marginLeft: 4 }} /></button>}
        {isForTime
          ? <button onClick={finish} disabled={notStarted || resultSec !== null} aria-label="Ho finito" style={{ ...ctrl("#151515", GREEN, 58), opacity: notStarted || resultSec !== null ? 0.35 : 1, fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>STOP</button>
          : <div style={{ width: 58, height: land ? 0 : "auto" }} />}
      </div>
      </div>
    </div>,
    document.body
  );
}

const iconBtn = { background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", width: 38, height: 38, borderRadius: 19, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
const ctrl = (bg, fg, size) => ({ width: size, height: size, borderRadius: size / 2, background: bg, color: fg, border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" });

// Scelta del timer per un blocco: timer consigliato in alto, tutte le modalità sotto
export function TimerSheet({ w, suggestion, onStart, onAssign, onClose }) {
  const [more, setMore] = useState(false);
  const base = ls.get("timer:cfg", {});
  const cfg = { ...DEFAULTS, prep: base.prep ?? 10, sound: base.sound ?? true, ...suggestion.cfg };
  const src = { blocco: "Impostato su questo blocco", auto: "Dedotto dal testo del blocco", base: "Cronometro semplice (nessun formato riconosciuto)" }[suggestion.source];
  return createPortal(
    <div role="dialog" aria-label={`Timer per ${w.title}`} style={{ position: "fixed", inset: 0, zIndex: 65, background: "#0b0b0b", color: "#fff", fontFamily: FONT, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "max(14px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={onClose} aria-label="Chiudi" style={iconBtn}><X size={20} /></button>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: MUTED, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Timer per</div>
            <div style={{ fontSize: 19, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</div>
          </div>
        </div>
        <div style={{ background: "linear-gradient(150deg, #1b2410 0%, #141414 60%)", border: "1px solid rgba(184,255,44,0.35)", borderRadius: 20, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <SevenSeg text={CODE[cfg.mode]} size={40} color={BLUE} off="rgba(47,134,255,0.08)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: GREEN, fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.6 }}>Timer consigliato</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{describe(cfg)}</div>
              <div style={{ color: MUTED, fontSize: 12.5 }}>{src}</div>
            </div>
          </div>
          <button onClick={() => onStart(cfg)} style={{ ...btnGreen, width: "100%", justifyContent: "center", padding: 15, fontSize: 17, borderRadius: 14, marginTop: 14 }}><Play size={18} fill="#0b0b0b" /> Avvia</button>
        </div>
        <button onClick={() => setMore(m => !m)} aria-expanded={more} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#141414", border: `1px solid ${LINE}`, color: "#fff", borderRadius: 14, padding: "13px 14px", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
          Scegli un altro timer <ChevronDown size={18} style={{ transform: more ? "rotate(180deg)" : "none" }} />
        </button>
        {more && <div style={{ marginTop: 6 }}><TimerSetup onStart={onStart} onAssign={onAssign} /></div>}
      </div>
    </div>,
    document.body
  );
}

// ---- Editor della sequenza: parti in fila, ognuna a tempo, a intervalli o di riposo ----
const sec2 = (t) => ({ m: Math.floor((t || 0) / 60), s: (t || 0) % 60 });
function MinSec({ value, onChange, label }) {
  const { m, s } = sec2(value);
  const f = (v) => String(v).replace(/\D/g, "").slice(0, 3);
  const box = { ...inp, width: 46, padding: "7px 4px", textAlign: "center", fontSize: 15, fontWeight: 800 };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      <input value={m} inputMode="numeric" aria-label={`${label} minuti`} onChange={e => onChange(Number(f(e.target.value) || 0) * 60 + s)} style={box} />
      <b style={{ color: MUTED }}>:</b>
      <input value={String(s).padStart(2, "0")} inputMode="numeric" aria-label={`${label} secondi`} onChange={e => onChange(m * 60 + Math.min(59, Number(f(e.target.value).slice(-2) || 0)))} style={box} />
    </span>
  );
}
const small = { color: MUTED, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 };

export function SequenceEditor({ parts, onChange }) {
  const set = (i, p) => onChange(parts.map((x, k) => k === i ? { ...x, ...p } : x));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= parts.length) return; const a = [...parts]; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  const add = (type) => onChange([...parts, type === "intervalli" ? { type, label: "Lavoro", work: 60, rest: 20, rounds: 5 } : type === "riposo" ? { type, label: "Riposo", sec: 60 } : { type, label: "Corsa", sec: 300 }]);
  const total = sequenceTotal({ mode: "sequence", parts: sanitizeTimer({ mode: "sequence", parts })?.parts || [] });
  return (
    <div>
      {parts.map((p, i) => (
        <div key={i} style={{ background: "#101010", border: `1px solid ${LINE}`, borderLeft: `3px solid ${p.type === "riposo" ? BLUE : p.type === "intervalli" ? GREEN : "#888"}`, borderRadius: 12, padding: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ color: MUTED, fontSize: 12, fontWeight: 800, width: 16 }}>{i + 1}</span>
            <select value={p.type} aria-label="Tipo di parte" onChange={e => { const t = e.target.value; set(i, t === "intervalli" ? { type: t, work: p.work || p.sec || 60, rest: p.rest ?? 20, rounds: p.rounds || 5 } : { type: t, sec: p.sec || p.work || 60 }); }}
              style={{ ...inp, padding: "6px 6px", fontSize: 13 }}>
              {Object.entries(PART_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input value={p.label} onChange={e => set(i, { label: e.target.value.slice(0, 40) })} placeholder="Nome (es. Warm-up)" aria-label="Nome della parte" style={{ ...inp, flex: 1, minWidth: 0, padding: "6px 8px", fontSize: 14 }} />
            <button onClick={() => move(i, -1)} aria-label="Sposta su" style={mini}><ArrowUp size={13} /></button>
            <button onClick={() => move(i, 1)} aria-label="Sposta giù" style={mini}><ArrowDown size={13} /></button>
            <button onClick={() => onChange(parts.filter((_, k) => k !== i))} aria-label="Togli parte" style={{ ...mini, color: "#ff8a8a" }}><Trash2 size={13} /></button>
          </div>
          {p.type === "intervalli"
            ? <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", paddingLeft: 22 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={small}>Set</span>
                  <input value={p.rounds} inputMode="numeric" aria-label="Numero di set" onChange={e => set(i, { rounds: Number(e.target.value.replace(/\D/g, "").slice(0, 3)) || "" })} style={{ ...inp, width: 48, padding: "7px 4px", textAlign: "center", fontSize: 15, fontWeight: 800 }} /></label>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={small}>Lavoro</span><MinSec value={p.work} label="Lavoro" onChange={v => set(i, { work: v })} /></label>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={small}>Riposo</span><MinSec value={p.rest} label="Riposo" onChange={v => set(i, { rest: v })} /></label>
              </div>
            : <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 22 }}><span style={small}>Durata</span><MinSec value={p.sec} label="Durata" onChange={v => set(i, { sec: v })} /></div>}
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => add("tempo")} style={{ ...pill, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}><Plus size={13} /> Tempo</button>
        <button onClick={() => add("intervalli")} style={{ ...pill, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}><Plus size={13} /> Intervalli</button>
        <button onClick={() => add("riposo")} style={{ ...pill, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}><Plus size={13} /> Riposo</button>
        <span style={{ marginLeft: "auto", color: "#fff", fontWeight: 800, fontSize: 14 }}>Totale {fmtClock(total)}</span>
      </div>
    </div>
  );
}
const mini = { background: "#1b1b1b", border: `1px solid ${LINE}`, color: "#ddd", width: 28, height: 28, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0 };
