import { useMemo, useState } from "react";
import { TimerScreen, TimerSheet } from "./Timer";
import { suggestTimer, sanitizeTimer } from "../lib/timer";
import { Plus, Trophy, X, Check, Trash2, ChevronDown, ChevronUp, NotebookPen , Timer as TimerIcon, Share2 } from "lucide-react";
import PhotoStrip from "./PhotoStrip";
import NotesSection from "./NotesSection";
import { prBadge } from "./Profilo";
import ShareSheet from "./ShareSheet";
import { TYPE_META, toValue, display, formatHint, buildBoard } from "../lib/scoring";
import { GREEN, CARD, LINE, MUTED, RED, inp, btnGreen, btnGhost, btnTextMuted, pill, pillOn } from "../lib/theme";

function Badge({ Icon, note }) {
  return <div style={{ width: 42, height: 42, borderRadius: 13, background: note ? "#1e1e1e" : "rgba(184,255,44,0.12)", border: `1px solid ${note ? "#2a2a2a" : "rgba(184,255,44,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    {note ? <NotebookPen size={19} color="#9a9a9a" /> : <Icon size={20} color={GREEN} strokeWidth={2.4} />}</div>;
}

export default function WorkoutCard({ w, name, date, entries, open, setOpen, onAdd, onRemove, onSetTimer, done = false, onToggleDone, prIds = new Set(), onOpenAthlete }) {
  const [showHist, setShowHist] = useState(false);
  const [timer, setTimer] = useState(null);     // configurazione del timer in corso
  const [sheet, setSheet] = useState(false);    // scelta del timer aperta
  const [sharing, setSharing] = useState(false);
  const [prefill, setPrefill] = useState(null); // tempo arrivato dal timer
  const suggestion = useMemo(() => suggestTimer(w), [w]);
  const [division, setDivision] = useState("all");
  const isNote = w.type === "note";
  const meta = TYPE_META[w.type] || TYPE_META.time;
  const Icon = meta.icon;
  const board = useMemo(() => buildBoard(entries, w.type, division), [entries, w.type, division]);
  const hasScaled = entries.some(e => !e.rx);
  const mineBest = isNote ? null : buildBoard(entries.filter(e => e.name === name), w.type, "all")[0];
  const scoreText = mineBest ? `${display(w.type, mineBest.value, mineBest.raw)} ${mineBest.rx ? "RX" : "Scaled"}${prIds.has(mineBest._key) ? " · PR 🏆" : ""}` : null;

  return (
    <div className="fade" style={{ background: CARD, border: `1px solid ${done ? "rgba(184,255,44,0.55)" : LINE}`, transition: "border-color .3s", borderRadius: 20, marginBottom: 14, overflow: "hidden" }}>
      <div style={{ padding: isNote ? 16 : "16px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Badge Icon={Icon} note={isNote} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ float: "right", marginLeft: 8, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            {onToggleDone && <button onClick={onToggleDone} aria-pressed={done} aria-label={done ? "Blocco completato, tocca per annullare" : "Segna il blocco come completato"}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, background: done ? GREEN : "transparent", color: done ? "#0b0b0b" : "#cfcfcf", border: `1px solid ${done ? GREEN : "#444"}`, borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer", transition: "all .2s" }}>
              <Check size={14} strokeWidth={3} /> {done ? "Fatto" : "Segna fatto"}</button>}
            <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setSharing(true)} aria-label="Condividi questo blocco" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "transparent", color: "#cfcfcf", border: "1px solid #444", borderRadius: 999, width: 32, height: 30, cursor: "pointer", padding: 0 }}><Share2 size={14} /></button>
            {<button onClick={() => setSheet(true)} aria-label="Apri timer per questo blocco" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(184,255,44,0.12)", color: GREEN, border: "1px solid rgba(184,255,44,0.3)", borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}><TimerIcon size={14} /> Timer</button>}
            </div>
            </div>
            <div style={{ color: "#fff", fontSize: 17.5, fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.2 }}>{w.title}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, background: "#222", color: isNote ? MUTED : GREEN, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999 }}>
              {isNote ? (w.tag || "Nota · senza punteggio") : <><Icon size={12} /> {w.tag && w.tag.toLowerCase().includes(meta.label.toLowerCase()) ? w.tag : [w.tag, meta.label].filter(Boolean).join(" · ")}</>}
            </div>
          </div>
        </div>
        <pre style={{ color: "#dcdcdc", fontSize: 15, lineHeight: 1.55, whiteSpace: "pre-wrap", fontFamily: "inherit", margin: "14px 0 0" }}>{w.detail}</pre>
        <PhotoStrip w={w} name={name} date={date} />
        <NotesSection w={w} name={name} />
      </div>

      {!isNote && <>
        <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 16 }} />
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              <Trophy size={13} color={GREEN} /> Classifica
            </div>
            {hasScaled && <div style={{ display: "flex", gap: 4 }}>
              {[["all", "Tutti"], ["rx", "RX"], ["scaled", "Scaled"]].map(([k, l]) =>
                <button key={k} onClick={() => setDivision(k)} style={{ ...pill, padding: "3px 9px", fontSize: 11, ...(division === k ? pillOn : {}) }}>{l}</button>)}
            </div>}
          </div>
          {board.length === 0 && <div style={{ color: MUTED, fontSize: 13.5, padding: "0 0 12px" }}>Ancora nessun punteggio. Sii il primo.</div>}
          {board.map((e, i) => {
            const mine = e.name === name; const medal = ["🥇", "🥈", "🥉"][i];
            return (
              <div key={e._key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, marginBottom: 6,
                background: mine ? "rgba(184,255,44,0.10)" : "#1f1f1f", border: mine ? `1px solid ${GREEN}` : "1px solid transparent" }}>
                <div style={{ width: 24, textAlign: "center", fontSize: medal ? 16 : 13, color: MUTED, fontWeight: 700 }}>{medal || i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <button onClick={() => onOpenAthlete?.(e.name)} aria-label={`Profilo di ${e.name}`} style={{ display: "block", maxWidth: "100%", background: "none", border: "none", padding: 0, cursor: onOpenAthlete ? "pointer" : "default", textAlign: "left", color: "#fff", fontSize: 14.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.name}{mine && <span style={{ color: GREEN, fontSize: 11, marginLeft: 6 }}>tu</span>}
                  </button>
                  {e.note && <div style={{ color: MUTED, fontSize: 12 }}>{e.note}</div>}
                </div>
                {prIds.has(e._key) && <span style={prBadge}>PR</span>}
                <span style={{ color: e.rx ? GREEN : MUTED, fontSize: 10, fontWeight: 800, border: `1px solid ${e.rx ? GREEN : "#444"}`, borderRadius: 6, padding: "1px 5px" }}>{e.rx ? "RX" : "SC"}</span>
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{display(w.type, e.value, e.raw)}</div>
                {mine && <button onClick={() => onRemove(e)} aria-label="Rimuovi" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "inline-flex", color: "#777" }}><Trash2 size={14} /></button>}
              </div>
            );
          })}
          {open
            ? <ScoreForm key={prefill ? JSON.stringify(prefill) : "new"} w={w} initial={prefill} onAdd={onAdd} onCancel={() => { setOpen(false); setPrefill(null); }} />
            : <button onClick={() => setOpen(true)} style={{ ...btnGreen, width: "100%", marginTop: 4, justifyContent: "center" }}><Plus size={16} /> Aggiungi il tuo punteggio</button>}
          {entries.length > 0 && <button onClick={() => setShowHist(s => !s)} style={{ ...btnTextMuted, marginTop: 10 }}>{showHist ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Storico ({entries.length})</button>}
          {showHist && <div style={{ marginTop: 8 }}>{[...entries].sort((a, b) => b.ts - a.ts).map(e => (
            <div key={e._key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: MUTED, padding: "4px 2px" }}>
              <span>{e.name} · {new Date(e.ts).toLocaleDateString("it-CH")}{e.rx ? "" : " · scaled"}</span><span style={{ color: "#bbb" }}>{display(w.type, e.value, e.raw)}</span>
            </div>))}</div>}
        </div>
      </>}
      {sheet && <TimerSheet w={w} suggestion={suggestion} onClose={() => setSheet(false)}
        onStart={(cfg) => { setSheet(false); setTimer(cfg); }}
        onAssign={onSetTimer ? async (cfg) => { await onSetTimer(w, sanitizeTimer(cfg)); } : undefined} />}
      {sharing && <ShareSheet w={w} scoreText={scoreText} onClose={() => setSharing(false)} />}
      {timer && <TimerScreen config={timer} title={w.title} onClose={() => setTimer(null)}
        onResult={isNote ? undefined : (sec, isCap) => {
          setTimer(null);
          setPrefill(isCap ? { cap: true } : { mm: String(Math.floor(sec / 60)), ss: String(sec % 60).padStart(2, "0") });
          setOpen(true);
        }} />}
    </div>
  );
}

function ScoreForm({ w, initial, onAdd, onCancel }) {
  const meta = TYPE_META[w.type] || TYPE_META.time;
  const [raw, setRaw] = useState(""); const [note, setNote] = useState(""); const [rx, setRx] = useState(true);
  const [err, setErr] = useState(null); const [busy, setBusy] = useState(false);
  // workout a tempo: minuti e secondi separati, oppure CAP + ripetizioni mancanti/fatte
  const [mm, setMm] = useState(initial?.mm ?? ""); const [ss, setSs] = useState(initial?.ss ?? ""); const [cap, setCap] = useState(!!initial?.cap); const [capReps, setCapReps] = useState("");
  const isTime = w.type === "time";
  const timeRaw = () => {
    if (cap) return /^\d+$/.test(capReps) ? `CAP+${Number(capReps)}` : "";
    if (mm === "" && ss === "") return "";
    const m = Number(mm || 0), sec = Number(ss || 0);
    if (!Number.isInteger(m) || !Number.isInteger(sec) || sec > 59 || m < 0 || sec < 0) return "";
    return `${m}:${String(sec).padStart(2, "0")}`;
  };
  const submit = async () => {
    const value = isTime ? timeRaw() : raw;
    if (toValue(w.type, value) === null) { setErr(isTime ? (cap ? "Inserisci le ripetizioni fatte entro il time cap." : "Inserisci minuti e secondi (secondi 0–59).") : formatHint(w.type)); return; }
    setBusy(true);
    const e = await onAdd(w, value, note, rx);
    setBusy(false);
    if (e) setErr(e);
  };
  return (
    <div style={{ marginTop: 12, padding: 14, background: "#1f1f1f", borderRadius: 12, border: `1px solid ${LINE}` }}>
      {isTime && (
        <div>
          {!cap ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input value={mm} onChange={e => { setMm(e.target.value.replace(/\D/g, "").slice(0, 3)); setErr(null); }} inputMode="numeric" placeholder="min" aria-label="Minuti" autoFocus
                style={{ ...inp, width: 84, textAlign: "center", fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums" }} />
              <span style={{ color: "#fff", fontSize: 24, fontWeight: 900 }}>:</span>
              <input value={ss} onChange={e => { setSs(e.target.value.replace(/\D/g, "").slice(0, 2)); setErr(null); }} onKeyDown={e => e.key === "Enter" && submit()} inputMode="numeric" placeholder="sec" aria-label="Secondi"
                style={{ ...inp, width: 84, textAlign: "center", fontSize: 22, fontWeight: 800, fontVariantNumeric: "tabular-nums" }} />
              <span style={{ color: MUTED, fontSize: 12.5, marginLeft: 4 }}>tempo finale</span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#fff", fontWeight: 800 }}>CAP +</span>
              <input value={capReps} onChange={e => { setCapReps(e.target.value.replace(/\D/g, "").slice(0, 4)); setErr(null); }} onKeyDown={e => e.key === "Enter" && submit()} inputMode="numeric" placeholder="reps" aria-label="Ripetizioni" autoFocus
                style={{ ...inp, width: 100, textAlign: "center", fontSize: 20, fontWeight: 800 }} />
              <span style={{ color: MUTED, fontSize: 12.5 }}>reps fatte</span>
            </div>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, fontSize: 13, marginTop: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={cap} onChange={e => { setCap(e.target.checked); setErr(null); }} style={{ accentColor: GREEN, width: 16, height: 16 }} />
            Non ho finito entro il time cap
          </label>
        </div>
      )}
      {!isTime && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={raw} onChange={e => { setRaw(e.target.value); setErr(null); }} onKeyDown={e => e.key === "Enter" && submit()}
          placeholder={meta.placeholder} style={{ ...inp, flex: 1, minWidth: 0 }} autoFocus
          inputMode={w.type === "reps" || w.type === "weight" ? "decimal" : "text"} />
        {meta.unit && <span style={{ color: MUTED, fontSize: 13 }}>{meta.unit}</span>}
      </div>}
      {err && <div style={{ color: RED, fontSize: 12, marginTop: 6 }}>{err}</div>}
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="Nota (facoltativa): carico usato, scaling…" style={{ ...inp, marginTop: 8, width: "100%" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        <button onClick={() => setRx(true)} style={{ ...pill, ...(rx ? pillOn : {}) }}>RX</button>
        <button onClick={() => setRx(false)} style={{ ...pill, ...(!rx ? pillOn : {}) }}>Scaled</button>
        <div style={{ flex: 1 }} />
        <button onClick={onCancel} style={btnGhost} aria-label="Annulla"><X size={16} /></button>
        <button onClick={submit} disabled={busy} style={{ ...btnGreen, opacity: busy ? 0.6 : 1 }}><Check size={16} /> Salva</button>
      </div>
    </div>
  );
}
