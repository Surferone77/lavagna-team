import { useMemo, useState } from "react";
import { ChevronLeft, Plus, Lock, Unlock, Trash2, Trophy, PencilLine, Check, X, ChevronDown, Sparkles, ChevronRight } from "lucide-react";
import Notifiche from "./Notifiche";
import Riepilogo from "./Riepilogo";
import { CATS, CAT_LABEL, CATALOG, RMS, groupRecords, recTitle, wouldBePR, isBetter, findExercise } from "../lib/records";
import { toValue, display } from "../lib/scoring";
import { todayISO, prettyDate } from "../lib/weeks";
import { GREEN, CARD, LINE, MUTED, RED, inp, pill, pillOn, btnGreen, btnGhost, h1 } from "../lib/theme";

const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join("");
export const showVal = (r) => display(r.kind, r.value, r.raw);
const fullDate = (iso) => `${prettyDate(iso)} ${iso.slice(0, 4)}`;
const box = { background: CARD, border: `1px solid ${LINE}`, borderRadius: 18, marginBottom: 10, overflow: "hidden" };

// Pagina profilo: i miei record (tutti) oppure quelli pubblici di un compagno
export default function Profilo({ athlete, me, records, onBack, onAdd, onRemove, onSetPrivate, onRename, onOpenNews, done, entries = [], weeks = {}, ensureWeeks }) {
  const self = athlete === me;
  const rows = records.filter(r => r.athlete === athlete && (self || !r.private));
  const groups = useMemo(() => groupRecords(rows).sort((a, b) => (b.last.date > a.last.date ? 1 : -1)), [rows]);
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(null);   // null | {} | {preset}
  const cats = CATS.filter(c => groups.some(g => g.category === c.key));
  const shown = groups.filter(g => cat === "all" || g.category === cat);

  return (
    <div className="fade">
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 16px" }}>
        <button onClick={onBack} aria-label="Indietro" style={{ background: "#1c1c1c", border: `1px solid ${LINE}`, color: "#fff", width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><ChevronLeft size={20} /></button>
        <div style={{ ...h1, fontSize: 24 }}>{self ? "Il mio profilo" : "Profilo"}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <div style={{ width: 64, height: 64, borderRadius: 32, background: "rgba(184,255,44,0.12)", border: `2px solid ${GREEN}`, color: GREEN, fontWeight: 900, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(athlete)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{athlete}</div>
          <div style={{ color: MUTED, fontSize: 13 }}>{groups.length ? `${groups.length} ${groups.length === 1 ? "record" : "record"}${self && groups.some(g => g.private) ? ` · ${groups.filter(g => g.private).length} privati` : ""}` : "Nessun record ancora"}</div>
        </div>
        {self && <button onClick={onRename} style={{ ...pill, padding: "7px 11px", display: "inline-flex", alignItems: "center", gap: 5 }}><PencilLine size={14} /> Nome</button>}
      </div>

      {self && ensureWeeks && <Riepilogo name={me} done={done || new Set()} entries={entries} records={records} weeks={weeks} ensureWeeks={ensureWeeks} />}
      {self && !adding && <button onClick={() => setAdding({})} style={{ ...btnGreen, width: "100%", justifyContent: "center", marginBottom: 14 }}><Plus size={17} /> Aggiungi record</button>}
      {self && adding && <RecordForm preset={adding.preset} rows={rows} me={me} onCancel={() => setAdding(null)} onSave={async (rec) => { const res = await onAdd(rec); if (!res?.error) setAdding(null); return res; }} />}

      {cats.length > 1 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 10 }}>
          {[{ key: "all", label: "Tutti" }, ...cats].map(c => <button key={c.key} onClick={() => setCat(c.key)} style={{ ...pill, flexShrink: 0, ...(cat === c.key ? pillOn : {}) }}>{c.label}</button>)}
        </div>
      )}

      {!groups.length && (
        <div style={{ ...box, padding: 18, color: MUTED, fontSize: 14, lineHeight: 1.5 }}>
          {self ? <>Aggiungi i tuoi massimali e i tuoi tempi migliori. Quando registri un punteggio che batte un record (es. <b style={{ color: "#ddd" }}>Back Squat 3RM</b> o <b style={{ color: "#ddd" }}>Fran</b>), si aggiorna da solo.</> : "Nessun record pubblico."}
        </div>
      )}

      {shown.map(g => {
        const k = g.key, isOpen = open === k;
        return (
          <div key={k} style={box}>
            <button onClick={() => setOpen(isOpen ? null : k)} aria-expanded={isOpen} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", padding: 14, cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(184,255,44,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Trophy size={18} color={GREEN} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontSize: 15.5, fontWeight: 800, lineHeight: 1.25 }}>{recTitle(g)} {g.private && <Lock size={12} color={MUTED} style={{ marginLeft: 3 }} />}</div>
                <div style={{ color: MUTED, fontSize: 12 }}>{CAT_LABEL[g.category] || "Altro"} · {fullDate(g.best.date)}</div>
              </div>
              {g.history.length > 1 && <Spark g={g} />}
              <div style={{ color: GREEN, fontSize: 19, fontWeight: 900, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{showVal(g.best)}</div>
              <ChevronDown size={16} color={MUTED} style={{ transform: isOpen ? "rotate(180deg)" : "none", flexShrink: 0 }} />
            </button>
            {isOpen && (
              <div style={{ borderTop: `1px solid ${LINE}`, padding: "8px 14px 14px" }}>
                {[...g.history].reverse().map(r => {
                  const isBest = r === g.best;
                  return (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${LINE}` }}>
                      <span style={{ color: MUTED, fontSize: 12.5, width: 82, flexShrink: 0 }}>{fullDate(r.date)}</span>
                      <span style={{ flex: 1, minWidth: 0, color: "#bbb", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.note}</span>
                      {isBest && <span style={prBadge}>PR</span>}
                      <span style={{ color: "#fff", fontWeight: 800, fontSize: 14.5, fontVariantNumeric: "tabular-nums" }}>{showVal(r)}</span>
                      {self && <button onClick={() => onRemove(r)} aria-label="Elimina questo valore" style={{ background: "none", border: "none", color: "#777", cursor: "pointer", padding: 4, display: "inline-flex" }}><Trash2 size={14} /></button>}
                    </div>
                  );
                })}
                {self && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <button onClick={() => { setAdding({ preset: { exercise: g.exercise, kind: g.kind, rm: g.rm, category: g.category, private: g.private } }); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ ...pill, display: "inline-flex", alignItems: "center", gap: 5 }}><Plus size={14} /> Nuovo valore</button>
                    <button onClick={() => onSetPrivate(g, !g.private)} style={{ ...pill, display: "inline-flex", alignItems: "center", gap: 5, ...(g.private ? pillOn : {}) }}>
                      {g.private ? <><Lock size={14} /> Solo per me</> : <><Unlock size={14} /> Visibile al team</>}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {self && <div style={{ marginTop: 22 }}>
        <Notifiche name={me} />
        {onOpenNews && <button onClick={onOpenNews} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: CARD, border: `1px solid ${LINE}`, borderRadius: 18, padding: 14, cursor: "pointer", textAlign: "left", color: "#fff", fontWeight: 800, fontSize: 15 }}>
          <Sparkles size={17} color={GREEN} /> <span style={{ flex: 1 }}>Novità dell'app</span> <ChevronRight size={16} color={MUTED} />
        </button>}
      </div>}
    </div>
  );
}

export const prBadge = { background: GREEN, color: "#0b0b0b", fontSize: 10, fontWeight: 900, borderRadius: 6, padding: "2px 6px", letterSpacing: 0.4, flexShrink: 0 };

// Mini grafico dell'andamento (in alto = meglio, anche per i tempi)
function Spark({ g }) {
  const pts = g.history.map(r => r.value);
  const lo = Math.min(...pts), hi = Math.max(...pts), W = 54, H = 22;
  const y = (v) => { const t = hi === lo ? 0.5 : (v - lo) / (hi - lo); return 2 + (g.kind === "time" ? t : 1 - t) * (H - 4); };
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * (W - 4) + 2},${y(v).toFixed(1)}`).join(" ");
  return <svg width={W} height={H} style={{ flexShrink: 0 }} aria-hidden="true"><polyline points={d} fill="none" stroke={GREEN} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" /></svg>;
}

// ---- Nuovo record ----
function RecordForm({ preset, rows, me, onSave, onCancel }) {
  const [category, setCategory] = useState(preset?.category || "lift");
  const [exercise, setExercise] = useState(preset?.exercise || "");
  const [custom, setCustom] = useState(preset && !findExercise(preset.exercise) ? preset.exercise : "");
  const [customKind, setCustomKind] = useState(preset?.kind || "weight");
  const [rm, setRm] = useState(preset?.rm || 1);
  const [raw, setRaw] = useState("");
  const [min, setMin] = useState(""); const [sec, setSec] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [priv, setPriv] = useState(!!preset?.private);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const list = CATALOG.filter(e => e.cat === category);
  const isCustom = category === "altro" || exercise === "__altro";
  const name = isCustom ? custom.trim() : exercise;
  const kind = isCustom ? customKind : (findExercise(exercise)?.kind || "weight");
  const value = kind === "time" ? ((min || sec) ? Number(min || 0) * 60 + Number(sec || 0) : null) : toValue(kind, raw);
  const rawOut = kind === "time" ? `${Number(min || 0)}:${String(Number(sec || 0)).padStart(2, "0")}` : raw.trim().replace(",", ".");
  const cand = name && value !== null && value > 0 ? { exercise: name, kind, rm: kind === "weight" ? rm : null, value } : null;
  const prev = cand ? rows.filter(r => r.athlete === me && r.exercise.toLowerCase() === name.toLowerCase() && (kind !== "weight" || (r.rm || 1) === rm)) : [];
  const willPR = cand && wouldBePR(rows, me, cand);
  const best = prev.reduce((b, r) => (!b || isBetter(kind, r.value, b.value) ? r : b), null);

  const save = async () => {
    if (!name) return setErr("Scegli o scrivi l'esercizio.");
    if (!cand) return setErr(kind === "time" ? "Inserisci minuti e secondi." : kind === "rounds" ? "Usa round+reps, es. 5+12." : "Inserisci un numero.");
    if (kind === "time" && Number(sec || 0) > 59) return setErr("I secondi vanno da 0 a 59.");
    setBusy(true); setErr(null);
    const res = await onSave({ category: isCustom ? "altro" : category, exercise: name, kind, rm: kind === "weight" ? rm : null, value, raw: rawOut, date, note: note.trim(), private: priv });
    setBusy(false);
    if (res?.error) setErr(res.error);
  };

  const lbl = { display: "block", color: MUTED, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, margin: "12px 0 6px" };
  return (
    <div style={{ background: CARD, border: `1px solid rgba(184,255,44,0.4)`, borderRadius: 18, padding: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: "#fff", fontWeight: 900, fontSize: 17 }}>Nuovo record</div>
        <button onClick={onCancel} aria-label="Annulla" style={{ ...btnGhost, padding: 7 }}><X size={16} /></button>
      </div>
      {!preset && <>
        <span style={lbl}>Categoria</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATS.map(c => <button key={c.key} onClick={() => { setCategory(c.key); setExercise(""); }} style={{ ...pill, padding: "5px 10px", ...(category === c.key ? pillOn : {}) }}>{c.label}</button>)}
        </div>
      </>}
      <span style={lbl}>Esercizio</span>
      {preset ? <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>{preset.exercise}</div> : <>
        {category !== "altro" && (
          <select value={exercise} onChange={e => setExercise(e.target.value)} aria-label="Esercizio" style={{ ...inp, width: "100%" }}>
            <option value="">Scegli…</option>
            {list.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
            <option value="__altro">Altro (scrivo io)…</option>
          </select>
        )}
        {isCustom && (
          <div style={{ display: "flex", gap: 6, marginTop: category === "altro" ? 0 : 8 }}>
            <input value={custom} onChange={e => setCustom(e.target.value.slice(0, 40))} placeholder="Nome, es. Wall Ball max" aria-label="Nome esercizio" style={{ ...inp, flex: 1, minWidth: 0 }} />
            <select value={customKind} onChange={e => setCustomKind(e.target.value)} aria-label="Tipo di record" style={{ ...inp }}>
              <option value="weight">Carico (kg)</option><option value="time">Tempo</option><option value="reps">Ripetizioni</option><option value="rounds">Round + reps</option>
            </select>
          </div>
        )}
      </>}
      {kind === "weight" && !preset && <>
        <span style={lbl}>Ripetizioni (massimale)</span>
        <div style={{ display: "flex", gap: 6 }}>{RMS.map(n => <button key={n} onClick={() => setRm(n)} style={{ ...pill, padding: "5px 11px", ...(rm === n ? pillOn : {}) }}>{n}RM</button>)}</div>
      </>}
      <span style={lbl}>{kind === "time" ? "Tempo" : kind === "weight" ? "Carico" : kind === "rounds" ? "Round + reps" : "Ripetizioni"}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {kind === "time" ? <>
          <input value={min} onChange={e => setMin(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="min" aria-label="Minuti" style={{ ...inp, width: 80, textAlign: "center", fontSize: 20, fontWeight: 800 }} />
          <b style={{ color: MUTED, fontSize: 20 }}>:</b>
          <input value={sec} onChange={e => setSec(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="sec" aria-label="Secondi" style={{ ...inp, width: 80, textAlign: "center", fontSize: 20, fontWeight: 800 }} />
        </> : <>
          <input value={raw} onChange={e => setRaw(e.target.value)} inputMode={kind === "rounds" ? "text" : "decimal"} placeholder={kind === "weight" ? "es. 100" : kind === "rounds" ? "es. 20+5" : "es. 25"} aria-label="Valore"
            style={{ ...inp, width: 140, fontSize: 20, fontWeight: 800 }} />
          {kind === "weight" && <span style={{ color: MUTED }}>kg</span>}
        </>}
      </div>
      {cand && <div style={{ marginTop: 8, fontSize: 13, color: willPR ? GREEN : MUTED, fontWeight: 700 }}>
        {willPR ? (best ? `Nuovo PR! Prima: ${display(kind, best.value, best.raw)}` : "Primo record per questo esercizio") : `Non batte il tuo PR (${display(kind, best.value, best.raw)}): lo salvo nello storico`}
      </div>}
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ flex: 1 }}><span style={lbl}>Data</span><input type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value || todayISO())} style={{ ...inp, width: "100%" }} /></label>
        <label style={{ flex: 1.4 }}><span style={lbl}>Nota</span><input value={note} onChange={e => setNote(e.target.value.slice(0, 80))} placeholder="facoltativa" style={{ ...inp, width: "100%" }} /></label>
      </div>
      <button onClick={() => setPriv(p => !p)} aria-pressed={priv} style={{ ...pill, marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, ...(priv ? pillOn : {}) }}>
        {priv ? <><Lock size={14} /> Solo per me</> : <><Unlock size={14} /> Visibile al team</>}
      </button>
      {err && <div style={{ color: RED, fontSize: 13, marginTop: 10 }}>{err}</div>}
      <button onClick={save} disabled={busy} style={{ ...btnGreen, width: "100%", justifyContent: "center", marginTop: 14, opacity: busy ? 0.6 : 1 }}><Check size={17} /> Salva record</button>
    </div>
  );
}
