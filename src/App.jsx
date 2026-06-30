import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trophy, Clock, Dumbbell, X, Check, Trash2, ChevronDown, ChevronUp, Flame, Upload, Calendar, Camera } from "lucide-react";
import { supabase } from "./supabaseClient";

const GREEN = "#00C136";
const BG = "#0d0d0d";
const CARD = "#181818";
const LINE = "#262626";
const MUTED = "#8a8a8a";
const DAY_ORDER = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
const DAY_LABEL = { lun: "Lunedì", mar: "Martedì", mer: "Mercoledì", gio: "Giovedì", ven: "Venerdì", sab: "Sabato", dom: "Domenica" };

const TYPE_META = {
  time:   { better: "asc",  icon: Clock,    unit: "mm:ss", placeholder: "8:42", label: "Tempo" },
  reps:   { better: "desc", icon: Flame,    unit: "reps",  placeholder: "12",   label: "Reps" },
  weight: { better: "desc", icon: Dumbbell, unit: "kg",    placeholder: "80",   label: "Carico" },
};
const toValue = (type, raw) => {
  raw = (raw || "").trim();
  if (type === "time") {
    if (/^\d{1,3}:\d{2}$/.test(raw)) { const [m, s] = raw.split(":").map(Number); return m * 60 + s; }
    if (/^\d+$/.test(raw)) return Number(raw);
    return null;
  }
  const n = Number(raw.replace(",", ".")); return isNaN(n) ? null : n;
};
const display = (type, value, raw) => {
  if (type === "time") { const m = Math.floor(value / 60), s = value % 60; return `${m}:${String(s).padStart(2, "0")}`; }
  return `${raw} ${TYPE_META[type].unit}`;
};
const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };
function ingest(week) {
  return { ...week, days: ((week?.days ?? []) || []).map(d => ({
    ...d, workouts: (d.workouts || []).map((w, i) => ({ id: `${week.id}__${d.key}__${i}`, title: w.title, tag: w.tag || "", type: w.type, detail: w.detail || "" })),
  })) };
}
const toB64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });

export default function App() {
  const [name, setName] = useState(localStorage.getItem("athlete:name") || "");
  const [nameDraft, setNameDraft] = useState("");
  const [index, setIndex] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [week, setWeek] = useState(null);
  const [entries, setEntries] = useState([]);
  const [dayKey, setDayKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(null);
  const [screen, setScreen] = useState("board");
  const currentIdRef = useRef(null);

  const loadScores = async () => {
    const { data } = await supabase.from("scores").select("*");
    setEntries((data || []).map(r => ({ _key: r.id, wod: r.workout_id, name: r.athlete, value: r.value, raw: r.raw, note: r.note, rx: r.rx, ts: new Date(r.created_at).getTime() })));
  };
  const loadIndex = async () => {
    const { data } = await supabase.from("weeks").select("id,label").order("id");
    setIndex(data || []); return data || [];
  };
  const loadWeek = async (id) => {
    const { data } = await supabase.from("weeks").select("data").eq("id", id).maybeSingle();
    if (data && data.data) { setWeek(data.data); setDayKey((data.data.days[0] || {}).key || null); }
    else { setWeek(null); setDayKey(null); }
    currentIdRef.current = id;
  };

  useEffect(() => { (async () => {
    const idx = await loadIndex();
    let cur = localStorage.getItem("current:week");
    if (!cur || !idx.find(x => x.id === cur)) cur = idx.length ? idx[idx.length - 1].id : null;
    setCurrentId(cur);
    if (cur) await loadWeek(cur);
    await loadScores();
    setLoading(false);
    // realtime classifica
    const ch = supabase.channel("scores-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, () => loadScores())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  })(); }, []);

  const saveName = () => { const n = nameDraft.trim(); if (!n) return; setName(n); localStorage.setItem("athlete:name", n); };
  const switchWeek = async (id) => { setCurrentId(id); localStorage.setItem("current:week", id); await loadWeek(id); };

  const upsertWeek = async (w) => {
    await supabase.from("weeks").upsert({ id: w.id, label: w.label, data: w, updated_at: new Date().toISOString() });
    const idx = await loadIndex();
    setCurrentId(w.id); localStorage.setItem("current:week", w.id);
    setWeek(w); setDayKey((w.days[0] || {}).key || null); currentIdRef.current = w.id;
    return idx;
  };

  const importWeek = async (raw) => {
    const data = parse(raw);
    if (!data || !data.id || !Array.isArray(data.days)) return "JSON non valido: servono i campi id e days.";
    await upsertWeek(ingest(data)); setScreen("board"); return null;
  };

  const addDay = async ({ weekId, weekLabel, dayKey: dk, date, workouts }) => {
    const { data: ex } = await supabase.from("weeks").select("data").eq("id", weekId).maybeSingle();
    let wk = (ex && ex.data && ex.data.days) ? ex.data : { id: weekId, label: weekLabel || weekId, days: [] };
    wk.id = weekId; if (weekLabel) wk.label = weekLabel;
    wk.days = (wk.days || []).filter(d => d.key !== dk);
    wk.days.push({ key: dk, label: DAY_LABEL[dk] || dk, date, workouts });
    wk.days.sort((a, b) => DAY_ORDER.indexOf(a.key) - DAY_ORDER.indexOf(b.key));
    await upsertWeek(ingest(wk)); setDayKey(dk); setScreen("board");
  };

  const addScore = async (wo, raw, note, rx) => {
    const value = toValue(wo.type, raw); if (value === null) return false;
    const { data, error } = await supabase.from("scores").insert({ workout_id: wo.id, athlete: name, value, raw: raw.trim(), note: note.trim(), rx }).select().single();
    if (error) return false;
    setEntries(p => [...p, { _key: data.id, wod: data.workout_id, name: data.athlete, value: data.value, raw: data.raw, note: data.note, rx: data.rx, ts: Date.now() }]);
    setOpenForm(null); return true;
  };
  const removeEntry = async (e) => { await supabase.from("scores").delete().eq("id", e._key); setEntries(p => p.filter(x => x._key !== e._key)); };

  if (loading) return <Shell><div style={{ color: MUTED, padding: 40, textAlign: "center" }}>Carico la lavagna…</div></Shell>;

  if (!name) return (
    <Shell>
      <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 16, padding: 24, marginTop: 24 }}>
        <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: 0 }}>Come ti chiami?</h2>
        <p style={{ color: MUTED, fontSize: 14, marginTop: 6 }}>Il nome appare nella classifica del team. Lo imposti una volta sola.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && saveName()} placeholder="Nome e cognome" style={inp} autoFocus />
          <button onClick={saveName} style={btnGreen}>Entra</button>
        </div>
      </div>
    </Shell>
  );

  if (screen === "import") return <ImportPanel onImport={importWeek} onCancel={() => setScreen("board")} />;
  if (screen === "upload") return <UploadPanel defaultWeekId={currentId || "2026-W27"} defaultWeekLabel={week ? week.label : ""} onAdd={addDay} onCancel={() => setScreen("board")} />;

  const day = week ? (week?.days ?? []).find(d => d.key === dayKey) : null;

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Calendar size={18} color={GREEN} />
          {index.length > 1
            ? <select value={currentId || ""} onChange={e => switchWeek(e.target.value)} style={{ ...inp, padding: "7px 10px", maxWidth: 200 }}>
                {index.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            : <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: 0 }}>{week ? week.label : "Lavagna"}</h1>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setScreen("import")} style={btnGhost} title="Incolla JSON"><Upload size={16} /></button>
          <button onClick={() => setScreen("upload")} style={btnGreen}><Camera size={16} /> Carica screenshot</button>
        </div>
      </div>
      <div style={{ color: MUTED, fontSize: 12, margin: "8px 0 16px" }}>Ciao <span style={{ color: GREEN, fontWeight: 600 }}>{name}</span> · classifica live, condivisa col team</div>

      {week && (week?.days ?? []).length > 0 && (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
          {(week?.days ?? []).map(d => {
            const on = d.key === dayKey;
            return (
              <button key={d.key} onClick={() => setDayKey(d.key)} style={{
                flexShrink: 0, textAlign: "left", padding: "9px 14px", borderRadius: 12, cursor: "pointer",
                background: on ? "rgba(0,193,54,0.14)" : CARD, border: on ? `1px solid ${GREEN}` : `1px solid ${LINE}` }}>
                <div style={{ color: on ? GREEN : "#fff", fontSize: 14, fontWeight: 700 }}>{d.label}</div>
                <div style={{ color: MUTED, fontSize: 11 }}>{d.date || ""} · {d.workouts.length} blocchi</div>
              </button>
            );
          })}
        </div>
      )}

      {!week && <div style={{ color: MUTED, padding: 24, textAlign: "center" }}>Nessuna settimana. Premi <b style={{ color: GREEN }}>Carica screenshot</b> per iniziare.</div>}
      {day && day.workouts.map(w => (
        <WorkoutCard key={w.id} w={w} name={name} entries={entries.filter(e => e.wod === w.id)}
          open={openForm === w.id} setOpen={o => setOpenForm(o ? w.id : null)} onAdd={addScore} onRemove={removeEntry} />
      ))}
      {day && day.workouts.length === 0 && <div style={{ color: MUTED, padding: 16 }}>Giorno di riposo.</div>}
      <div style={{ height: 40 }} />
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px 24px" }}>{children}</div>
    </div>
  );
}
function Logo() {
  return <div style={{ width: 40, height: 40, borderRadius: 12, background: "#3a3a3a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <div style={{ width: 16, height: 16, borderRadius: "50%", border: `4px solid ${BG}` }} /></div>;
}

function WorkoutCard({ w, name, entries, open, setOpen, onAdd, onRemove }) {
  const [showHist, setShowHist] = useState(false);
  const isNote = w.type === "note";
  const meta = TYPE_META[w.type] || TYPE_META.time;
  const Icon = meta.icon;
  const board = useMemo(() => {
    const byName = {};
    for (const e of entries) {
      const cur = byName[e.name];
      if (!cur || (meta.better === "asc" ? e.value < cur.value : e.value > cur.value)) byName[e.name] = e;
    }
    return Object.values(byName).sort((a, b) => meta.better === "asc" ? a.value - b.value : b.value - a.value);
  }, [entries, meta.better]);

  return (
    <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 16, marginBottom: 16, overflow: "hidden" }}>
      <div style={{ padding: isNote ? "16px" : "16px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontSize: 17, fontWeight: 700, lineHeight: 1.2 }}>{w.title}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, background: "#222", color: isNote ? MUTED : GREEN, fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999 }}>
              {isNote ? (w.tag || "Nota · non a punteggio") : <><Icon size={12} /> {w.tag} · {meta.label}</>}
            </div>
          </div>
        </div>
        <pre style={{ color: "#dcdcdc", fontSize: 14.5, lineHeight: 1.55, whiteSpace: "pre-wrap", fontFamily: "inherit", margin: "14px 0 0" }}>{w.detail}</pre>
      </div>

      {!isNote && <>
        <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 16 }} />
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: board.length ? 12 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              <Trophy size={13} color={GREEN} /> Classifica live
            </div>
            {board.length > 0 && <span style={{ color: MUTED, fontSize: 12 }}>{board.length} atleti</span>}
          </div>
          {board.length === 0 && <div style={{ color: MUTED, fontSize: 13.5, padding: "4px 0 12px" }}>Ancora nessun punteggio. Sii il primo a salire in cima.</div>}
          {board.map((e, i) => {
            const mine = e.name === name; const medal = ["🥇", "🥈", "🥉"][i];
            return (
              <div key={e._key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, marginBottom: 6,
                background: mine ? "rgba(0,193,54,0.10)" : "#1f1f1f", border: mine ? `1px solid ${GREEN}` : "1px solid transparent" }}>
                <div style={{ width: 24, textAlign: "center", fontSize: medal ? 16 : 13, color: MUTED, fontWeight: 700 }}>{medal || i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#fff", fontSize: 14.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.name}{mine && <span style={{ color: GREEN, fontSize: 11, marginLeft: 6 }}>tu</span>}
                  </div>
                  {e.note && <div style={{ color: MUTED, fontSize: 12 }}>{e.note}</div>}
                </div>
                {e.rx && <span style={{ color: GREEN, fontSize: 10, fontWeight: 800, border: `1px solid ${GREEN}`, borderRadius: 6, padding: "1px 5px" }}>RX</span>}
                <div style={{ color: "#fff", fontSize: 15, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{display(w.type, e.value, e.raw)}</div>
                {mine && <button onClick={() => onRemove(e)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "inline-flex", color: "#777" }} title="Rimuovi"><Trash2 size={14} /></button>}
              </div>
            );
          })}
          {open
            ? <ScoreForm w={w} onAdd={onAdd} onCancel={() => setOpen(false)} />
            : <button onClick={() => setOpen(true)} style={{ ...btnGreen, width: "100%", marginTop: board.length ? 6 : 4, justifyContent: "center" }}><Plus size={16} /> Aggiungi il tuo punteggio</button>}
          {entries.length > 0 && <button onClick={() => setShowHist(s => !s)} style={{ ...btnTextMuted, marginTop: 10 }}>{showHist ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Storico ({entries.length})</button>}
          {showHist && <div style={{ marginTop: 8 }}>{[...entries].sort((a, b) => b.ts - a.ts).map(e => (
            <div key={e._key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: MUTED, padding: "4px 2px" }}>
              <span>{e.name} · {new Date(e.ts).toLocaleDateString("it-CH")}</span><span style={{ color: "#bbb" }}>{display(w.type, e.value, e.raw)}</span>
            </div>))}</div>}
        </div>
      </>}
    </div>
  );
}

function ScoreForm({ w, onAdd, onCancel }) {
  const meta = TYPE_META[w.type] || TYPE_META.time;
  const [raw, setRaw] = useState(""); const [note, setNote] = useState(""); const [rx, setRx] = useState(true); const [err, setErr] = useState(false);
  const submit = async () => { const ok = await onAdd(w, raw, note, rx); if (!ok) setErr(true); };
  return (
    <div style={{ marginTop: 12, padding: 14, background: "#1f1f1f", borderRadius: 12, border: `1px solid ${LINE}` }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={raw} onChange={e => { setRaw(e.target.value); setErr(false); }} onKeyDown={e => e.key === "Enter" && submit()} placeholder={meta.placeholder} style={{ ...inp, flex: 1 }} autoFocus inputMode={w.type === "time" ? "text" : "decimal"} />
        <span style={{ color: MUTED, fontSize: 13, width: 44 }}>{meta.unit}</span>
      </div>
      {err && <div style={{ color: "#ff6b6b", fontSize: 12, marginTop: 6 }}>Formato non valido. {w.type === "time" ? "Usa mm:ss, es. 8:42." : "Inserisci un numero."}</div>}
      {w.type === "reps" && <input value={note} onChange={e => setNote(e.target.value)} placeholder="Nota: 2RM usato, es. 60kg" style={{ ...inp, marginTop: 8, width: "100%" }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
        <button onClick={() => setRx(true)} style={{ ...pill, ...(rx ? pillOn : {}) }}>RX</button>
        <button onClick={() => setRx(false)} style={{ ...pill, ...(!rx ? pillOn : {}) }}>Scaled</button>
        <div style={{ flex: 1 }} />
        <button onClick={onCancel} style={btnGhost}><X size={16} /></button>
        <button onClick={submit} style={btnGreen}><Check size={16} /> Salva</button>
      </div>
    </div>
  );
}

function ImportPanel({ onImport, onCancel }) {
  const [raw, setRaw] = useState(""); const [err, setErr] = useState(null);
  const go = async () => { const e = await onImport(raw); if (e) setErr(e); };
  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 14 }}>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Importa settimana (JSON)</h1>
        <button onClick={onCancel} style={btnGhost}><X size={16} /></button>
      </div>
      <textarea value={raw} onChange={e => { setRaw(e.target.value); setErr(null); }} rows={14}
        style={{ ...inp, width: "100%", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5, lineHeight: 1.5, resize: "vertical" }} autoFocus />
      {err && <div style={{ color: "#ff6b6b", fontSize: 13, marginTop: 8 }}>{err}</div>}
      <button onClick={go} style={{ ...btnGreen, width: "100%", justifyContent: "center", marginTop: 12 }}><Upload size={16} /> Carica</button>
      <div style={{ height: 40 }} />
    </Shell>
  );
}

function UploadPanel({ defaultWeekId, defaultWeekLabel, onAdd, onCancel }) {
  const [weekId, setWeekId] = useState(defaultWeekId || "2026-W27");
  const [weekLabel, setWeekLabel] = useState(defaultWeekLabel || "");
  const [dk, setDk] = useState("mar");
  const [date, setDate] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [resultText, setResultText] = useState("");
  const [phase, setPhase] = useState("pick");

  const archive = async () => {
    for (const f of files) {
      try { await supabase.storage.from("screenshots").upload(`${weekId}/${dk}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`, f, { upsert: true }); } catch {}
    }
  };

  const readWithAI = async () => {
    setErr(null);
    if (files.length === 0) { setErr("Aggiungi almeno uno screenshot."); return; }
    setBusy(true);
    try {
      const images = [];
      for (const f of files) images.push({ media_type: f.type || "image/jpeg", data: await toB64(f) });
      const { data, error } = await supabase.functions.invoke("read-screenshots", { body: { images } });
      if (error) throw error;
      if (data.error === "parse") { setResultText(data.raw || ""); setPhase("review"); setErr("Lettura incompleta: controlla/correggi il testo qui sotto."); }
      else if (data.workouts) { setResultText(JSON.stringify(data.workouts, null, 2)); setPhase("review"); archive(); }
      else throw new Error(data.error || "errore");
    } catch (e) {
      setErr("Non sono riuscito a leggere automaticamente. Correggi/incolla i workout a mano qui sotto.");
      if (!resultText) setResultText('[\n  { "title": "", "tag": "", "type": "time", "detail": "" }\n]');
      setPhase("review");
    } finally { setBusy(false); }
  };

  const confirm = () => {
    const arr = parse(resultText);
    if (!Array.isArray(arr) || arr.length === 0) { setErr("Il contenuto non è un array JSON valido."); return; }
    const workouts = arr.map(w => ({ title: w.title || "Senza titolo", tag: w.tag || "", type: ["time", "reps", "weight", "note"].includes(w.type) ? w.type : "note", detail: w.detail || "" }));
    onAdd({ weekId: weekId.trim() || "settimana", weekLabel: weekLabel.trim(), dayKey: dk, date: date.trim(), workouts });
  };

  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 8 }}>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Carica screenshot</h1>
        <button onClick={onCancel} style={btnGhost}><X size={16} /></button>
      </div>
      <p style={{ color: MUTED, fontSize: 13.5, marginTop: 0 }}>Scegli gli screenshot di una giornata: l’AI li legge e prepara i workout. Tu controlli e confermi.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 130 }}>
          <label style={lbl}>Settimana (id)</label>
          <input value={weekId} onChange={e => setWeekId(e.target.value)} placeholder="2026-W27" style={{ ...inp, width: "100%" }} />
        </div>
        <div style={{ flex: 1, minWidth: 130 }}>
          <label style={lbl}>Giorno</label>
          <select value={dk} onChange={e => setDk(e.target.value)} style={{ ...inp, width: "100%" }}>
            {DAY_ORDER.map(k => <option key={k} value={k}>{DAY_LABEL[k]}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 130 }}>
          <label style={lbl}>Data</label>
          <input value={date} onChange={e => setDate(e.target.value)} placeholder="2026-06-30" style={{ ...inp, width: "100%" }} />
        </div>
      </div>
      <label style={lbl}>Etichetta settimana (facoltativa)</label>
      <input value={weekLabel} onChange={e => setWeekLabel(e.target.value)} placeholder="Settimana 27 · 29 giu – 5 lug" style={{ ...inp, width: "100%", marginBottom: 12 }} />

      <label style={lbl}>Screenshot</label>
      <input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files || []))} style={{ ...inp, width: "100%", padding: 10 }} />
      {files.length > 0 && <div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>{files.length} immagine/i selezionate</div>}

      {err && <div style={{ color: "#ff6b6b", fontSize: 13, marginTop: 10 }}>{err}</div>}

      {phase === "pick" && (
        <button onClick={readWithAI} disabled={busy} style={{ ...btnGreen, width: "100%", justifyContent: "center", marginTop: 14, opacity: busy ? 0.6 : 1 }}>
          <Camera size={16} /> {busy ? "Leggo gli screenshot…" : "Leggi con AI"}
        </button>
      )}

      {phase === "review" && (
        <>
          <label style={{ ...lbl, marginTop: 16 }}>Controlla e correggi (JSON dei workout)</label>
          <textarea value={resultText} onChange={e => { setResultText(e.target.value); setErr(null); }} rows={14}
            style={{ ...inp, width: "100%", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5, lineHeight: 1.5, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={readWithAI} disabled={busy} style={{ ...btnGhost, justifyContent: "center", opacity: busy ? 0.6 : 1 }}>{busy ? "…" : "Rileggi"}</button>
            <button onClick={confirm} style={{ ...btnGreen, flex: 1, justifyContent: "center" }}><Check size={16} /> Aggiungi {DAY_LABEL[dk]} alla lavagna</button>
          </div>
        </>
      )}
      <div style={{ height: 40 }} />
    </Shell>
  );
}

const inp = { background: "#101010", border: `1px solid ${LINE}`, color: "#fff", borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none" };
const btnGreen = { display: "inline-flex", alignItems: "center", gap: 6, background: GREEN, color: "#062b0f", fontWeight: 700, fontSize: 14, border: "none", borderRadius: 10, padding: "10px 14px", cursor: "pointer" };
const btnGhost = { display: "inline-flex", alignItems: "center", gap: 6, background: "#222", color: "#ccc", fontSize: 14, border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 11px", cursor: "pointer" };
const btnTextMuted = { display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", color: MUTED, fontSize: 12.5, cursor: "pointer", padding: 4 };
const pill = { background: "#1a1a1a", border: `1px solid ${LINE}`, color: MUTED, fontSize: 12, fontWeight: 700, borderRadius: 999, padding: "5px 12px", cursor: "pointer" };
const pillOn = { background: "rgba(0,193,54,0.15)", borderColor: GREEN, color: GREEN };
const lbl = { color: MUTED, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 };
