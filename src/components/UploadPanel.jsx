import { useEffect, useRef, useState } from "react";
import { Camera, Check, ImagePlus, RotateCw, X, Loader2, AlertTriangle, PencilLine, ShieldCheck } from "lucide-react";
import { prepareImage, mapLimit } from "../lib/images";
import { weekInfo, todayISO, mergeWorkouts, DAY_LABEL } from "../lib/weeks";
import { supabase } from "../supabaseClient";
import WorkoutEditor from "./WorkoutEditor";
import { GREEN, CARD, LINE, MUTED, RED, inp, btnGreen, btnGhost, lbl } from "../lib/theme";

import { newItem, readOne } from "../lib/reader";

export default function UploadPanel({ currentWeek, initialDate, onAdd, onCancel, onImportJson }) {
  const [date, setDate] = useState(initialDate || todayISO());
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("pick"); // pick | review
  const [workouts, setWorkouts] = useState([]);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const info = weekInfo(date);
  const existing = currentWeek?.id === info.weekId ? currentWeek.days.find(d => d.key === info.dayKey) : null;

  useEffect(() => () => items.forEach(it => it.preview && URL.revokeObjectURL(it.preview)), []); // eslint-disable-line

  const patch = (key, p) => setItems(list => list.map(it => it.key === key ? { ...it, ...p } : it));

  const addFiles = (files) => {
    const list = Array.from(files || []).filter(f => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    const fresh = list.map(newItem);
    setItems(prev => [...prev, ...fresh]);
    setErr(null);
    // preparo subito anteprima e pezzi (tutto in locale): errori di formato emergono prima dell'AI
    fresh.forEach(it => prepareImage(it.file)
      .then(p => setItems(l => l.map(x => x.key === it.key && !x.tiles ? { ...x, preview: p.preview, tiles: p.tiles } : x)))
      .catch(e => patch(it.key, { status: "error", error: e.message || "Immagine non leggibile" })));
  };

  const process = async (targets) => {
    setBusy(true); setErr(null);
    const done = await mapLimit(targets, 2, async (it) => {
      patch(it.key, { status: "reading", error: null });
      try {
        const r = await readOne(it);
        patch(it.key, { ...r, status: "done" });
        return { ...it, ...r, status: "done" };
      } catch (e) {
        patch(it.key, { status: "error", error: e.message || String(e) });
        return { ...it, status: "error" };
      }
    });
    setBusy(false);
    return done;
  };

  const readAll = async () => {
    if (!items.length) { setErr("Aggiungi almeno uno screenshot."); return; }
    const todo = items.filter(it => it.status !== "done");
    const done = await process(todo);
    const all = items.map(it => done.find(d => d.key === it.key) || it);
    const ok = all.filter(it => it.status === "done");
    if (!ok.length) { setErr("Nessuno screenshot letto. Controlla la connessione oppure inserisci i blocchi a mano."); return; }
    setWorkouts(mergeWorkouts(ok.map(it => it.workouts)));
    setPhase("review");
  };

  const retry = async (it) => {
    const [r] = await process([it]);
    if (r.status === "done" && phase === "review") setWorkouts(w => mergeWorkouts([w, r.workouts]));
  };

  const confirm = async () => {
    const list = workouts.filter(w => w.title.trim() || w.detail.trim());
    if (!list.length) { setErr("Non ci sono blocchi da salvare."); return; }
    setSaving(true);
    const e = await onAdd({ weekId: info.weekId, weekLabel: info.label, dayKey: info.dayKey, date, workouts: list });
    setSaving(false);
    if (e) { setErr(e); return; }
    // archivio gli screenshot già ottimizzati (non blocca l'utente)
    for (const it of items) for (const [i, t] of (it.tiles || []).entries()) {
      supabase.storage.from("screenshots").upload(`${info.weekId}/${info.dayKey}/${Date.now()}-${it.key}-${i}.jpg`, t.blob, { contentType: "image/jpeg", upsert: true }).catch(() => {});
    }
  };

  const removedAll = [...new Set(items.flatMap(it => it.removed || []))];
  const aiDate = items.map(it => it.date).find(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d !== date);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 8 }}>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Carica allenamento</h1>
        <button onClick={onCancel} style={btnGhost} aria-label="Chiudi"><X size={16} /></button>
      </div>

      <label style={lbl}>Giorno dell'allenamento</label>
      <input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} style={{ ...inp, width: "100%" }} />
      <div style={{ color: MUTED, fontSize: 12.5, marginTop: 6 }}>
        <span style={{ color: GREEN, fontWeight: 600 }}>{DAY_LABEL[info.dayKey]}</span> · {info.label}
        {existing && <span style={{ color: "#f0b84a" }}> · {DAY_LABEL[info.dayKey]} esiste già: verrà aggiornato, i punteggi restano sui blocchi con lo stesso titolo.</span>}
      </div>
      {aiDate && <button onClick={() => setDate(aiDate)} style={{ ...btnGhost, marginTop: 8, fontSize: 12.5 }}>Nello screenshot c'è la data {aiDate}: usala</button>}

      <div style={{ marginTop: 16 }}>
        <label style={lbl}>Screenshot o foto</label>
        <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
          {items.map(it => (
            <div key={it.key} style={{ position: "relative", background: CARD, border: `1px solid ${it.status === "error" ? RED : LINE}`, borderRadius: 12, overflow: "hidden", aspectRatio: "3 / 4" }}>
              {it.preview
                ? <img src={it.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                : <div style={{ color: MUTED, fontSize: 11, padding: 8, wordBreak: "break-all" }}>{it.file.name}</div>}
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: 11, padding: "4px 6px", display: "flex", alignItems: "center", gap: 4 }}>
                {it.status === "pending" && <span style={{ color: MUTED }}>Da leggere</span>}
                {it.status === "reading" && <><Loader2 size={12} className="spin" /> Leggo…</>}
                {it.status === "done" && <><Check size={12} color={GREEN} /> {it.workouts.length} blocchi{it.tiles?.length > 1 ? ` · ${it.tiles.length} pezzi` : ""}</>}
                {it.status === "error" && <button onClick={() => retry(it)} disabled={busy} style={{ background: "none", border: "none", color: RED, fontSize: 11, padding: 0, display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }}><RotateCw size={11} /> Riprova</button>}
              </div>
              {it.status !== "reading" && <button onClick={() => setItems(l => l.filter(x => x.key !== it.key))} aria-label="Togli"
                style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", borderRadius: 999, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><X size={12} /></button>}
            </div>
          ))}
          <button onClick={() => fileRef.current?.click()} style={{ background: "#141414", border: `1px dashed #3a3a3a`, borderRadius: 12, color: MUTED, aspectRatio: "3 / 4", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontSize: 12 }}>
            <ImagePlus size={20} /> Aggiungi
          </button>
        </div>
        {items.filter(it => it.error).map(it => <div key={it.key} style={{ color: RED, fontSize: 12, marginTop: 6 }}>{it.file.name}: {it.error}</div>)}
        {items.filter(it => it.warning).map(it => <div key={it.key} style={{ color: "#f0b84a", fontSize: 12, marginTop: 6, display: "flex", gap: 4 }}><AlertTriangle size={13} /> {it.warning}</div>)}
      </div>

      {err && <div style={{ color: RED, fontSize: 13, marginTop: 10 }}>{err}</div>}

      {phase === "pick" && <>
        <button onClick={readAll} disabled={busy} style={{ ...btnGreen, width: "100%", justifyContent: "center", marginTop: 14, opacity: busy ? 0.6 : 1 }}>
          {busy ? <Loader2 size={16} className="spin" /> : <Camera size={16} />} {busy ? "Leggo gli screenshot…" : "Leggi con AI"}
        </button>
        <button onClick={() => { setWorkouts([{ title: "", tag: "", type: "time", detail: "" }]); setPhase("review"); }} style={{ ...btnGhost, width: "100%", justifyContent: "center", marginTop: 8 }}>
          <PencilLine size={15} /> Inserisci a mano
        </button>
        <button onClick={onImportJson} style={{ background: "none", border: "none", color: MUTED, fontSize: 12, marginTop: 14, cursor: "pointer", textDecoration: "underline" }}>Avanzate: importa settimana da JSON</button>
      </>}

      {phase === "review" && <>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, margin: "20px 0 4px" }}>Controlla i blocchi</div>
        <div style={{ color: MUTED, fontSize: 12.5, marginBottom: 10 }}>Correggi quello che serve, poi salva. Il tipo di punteggio decide come si ordina la classifica.</div>
        {removedAll.length > 0 && <div style={{ background: "rgba(184,255,44,0.07)", border: `1px solid rgba(184,255,44,0.3)`, borderRadius: 12, padding: "10px 12px", marginBottom: 12, fontSize: 12.5, color: "#cfcfcf" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: GREEN, fontWeight: 700, marginBottom: 4 }}><ShieldCheck size={14} /> Dati personali esclusi: l'allenamento vale per tutti</div>
          {removedAll.map((r, i) => <div key={i}>· {r}</div>)}
        </div>}
        <WorkoutEditor workouts={workouts} onChange={setWorkouts} />
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={() => setPhase("pick")} style={btnGhost}>Indietro</button>
          <button onClick={confirm} disabled={saving} style={{ ...btnGreen, flex: 1, justifyContent: "center", opacity: saving ? 0.6 : 1 }}>
            <Check size={16} /> Salva {DAY_LABEL[info.dayKey]}
          </button>
        </div>
      </>}
      <div style={{ height: 40 }} />
    </div>
  );
}
