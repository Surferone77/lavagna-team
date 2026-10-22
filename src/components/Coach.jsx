import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Check, RotateCw, X, Send, ShieldCheck } from "lucide-react";
import { mapLimit } from "../lib/images";
import { newItem, readOne } from "../lib/reader";
import { persistDay } from "../lib/db";
import { notify } from "../lib/push";
import { supabase } from "../supabaseClient";
import { DAY_ORDER, DAY_LABEL, weekInfo, weekDates, shiftWeek, coachTargetWeek, assignDays, mergeWorkouts, prettyDate } from "../lib/weeks";
import { GREEN, CARD, LINE, MUTED, RED, btnGreen, btnGhost } from "../lib/theme";
import { AppIcon, Wordmark } from "./Logo";

const SHORT = { lun: "L", mar: "M", mer: "M", gio: "G", ven: "V", sab: "S", dom: "D" };
const AMBER = "#f0b84a";

// Link coach: ?coach=CODICE oppure /coach?c=CODICE
export function coachCodeFromUrl() {
  const q = new URLSearchParams(window.location.search);
  if (q.has("coach")) return q.get("coach") || "";
  if (/\/coach\/?$/.test(window.location.pathname)) return q.get("c") || "";
  return null;
}
export function coachAllowed(code) {
  const expected = import.meta.env.VITE_COACH_CODE;
  return !expected || code === expected;
}
export const teamUrl = () => window.location.origin + window.location.pathname.replace(/\/coach\/?$/, "/");

// Pagina della coach: carica gli screenshot della settimana e pubblica. Nient'altro.
export default function Coach({ by = "Giada", embedded = false, onClose }) {
  const [weekId, setWeekId] = useState(coachTargetWeek());
  const [items, setItems] = useState([]);
  const [days, setDays] = useState({});        // key -> { dayKey, guessed }
  const [phase, setPhase] = useState("start"); // start | reading | review | publishing | done
  const [err, setErr] = useState(null);
  const [published, setPublished] = useState([]);
  const fileRef = useRef(null);
  const info = weekInfo(weekDates(weekId)[0]);
  const dates = weekDates(weekId);

  const patch = (key, p) => setItems(l => l.map(x => x.key === key ? { ...x, ...p } : x));

  const readAll = async (list, all) => {
    setPhase("reading"); setErr(null);
    const res = await mapLimit(list, 2, async (it) => {
      patch(it.key, { status: "reading", error: null });
      try { const r = await readOne(it); patch(it.key, { ...r, status: "done" }); return { ...it, ...r, status: "done" }; }
      catch (e) { patch(it.key, { status: "error", error: e.message || String(e) }); return { ...it, status: "error" }; }
    });
    const merged = all.map(it => res.find(r => r.key === it.key) || it);
    const ok = merged.filter(it => it.status === "done");
    // i giorni già scelti a mano restano; gli altri si ricalcolano in ordine
    const auto = Object.fromEntries(assignDays(ok, weekId).map(a => [a.key, a]));
    setDays(prev => { const n = { ...auto }; for (const k in prev) if (prev[k].manual && n[k]) n[k] = prev[k]; return n; });
    setPhase("review");
  };

  const onPick = (files) => {
    const fresh = Array.from(files || []).filter(f => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)).map(newItem);
    if (!fresh.length) return;
    const all = [...items, ...fresh];
    setItems(all);
    readAll(fresh, all);
  };

  const remove = (key) => { setItems(l => l.filter(x => x.key !== key)); setDays(d => { const n = { ...d }; delete n[key]; return n; }); };
  const setDay = (key, dayKey) => setDays(d => ({ ...d, [key]: { key, dayKey, guessed: false, manual: true } }));

  const ok = items.filter(it => it.status === "done");
  const groups = DAY_ORDER.map(k => ({ dayKey: k, items: ok.filter(it => days[it.key]?.dayKey === k) })).filter(g => g.items.length);
  const guessedCount = ok.filter(it => days[it.key]?.guessed).length;
  const removed = [...new Set(ok.flatMap(it => it.removed || []))];

  const publish = async () => {
    setPhase("publishing"); setErr(null);
    for (const g of groups) {
      const r = await persistDay({ weekId, weekLabel: info.label, dayKey: g.dayKey, date: dates[DAY_ORDER.indexOf(g.dayKey)], workouts: mergeWorkouts(g.items.map(it => it.workouts)) });
      if (r.error) { setErr(r.error); setPhase("review"); return; }
    }
    for (const it of ok) for (const [i, t] of (it.tiles || []).entries())
      supabase.storage.from("screenshots").upload(`${weekId}/${days[it.key]?.dayKey}/${Date.now()}-${it.key}-${i}.jpg`, t.blob, { contentType: "image/jpeg", upsert: true }).catch(() => {});
    setPublished(groups.map(g => ({ dayKey: g.dayKey, n: mergeWorkouts(g.items.map(it => it.workouts)).length })));
    setPhase("done");
    const giorni = groups.map(g => DAY_LABEL[g.dayKey]).filter(Boolean);
    notify("workout", `💪 Programma della ${info.label.split(" · ")[0].toLowerCase()} online`, `${by} ha pubblicato: ${giorni.join(", ")}. Segna i tuoi punteggi!`, "/?tab=calendario", embedded ? by : null);
  };

  const restart = () => { setItems([]); setDays({}); setPublished([]); setPhase("start"); };
  const waText = `💪 The Hybrid One · programma della ${info.label.toLowerCase()} online! Segna i tuoi punteggi qui: ${teamUrl()}`;

  const header = embedded ? (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 14 }}>
      <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Carica la settimana</h1>
      {onClose && <button onClick={onClose} style={btnGhost} aria-label="Chiudi"><X size={16} /></button>}
    </div>
  ) : (
    <div style={{ marginTop: 22, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}><AppIcon size={36} /><Wordmark size={15} /><span style={{ marginLeft: "auto", color: "#0b0b0b", background: GREEN, fontSize: 10.5, fontWeight: 900, letterSpacing: 1, borderRadius: 999, padding: "3px 9px" }}>COACH</span></div>
      <div style={{ color: "#fff", fontSize: 28, fontWeight: 900, letterSpacing: -0.6, marginTop: 20 }}>Programma della settimana</div>
    </div>
  );
  const weekPicker = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: CARD, border: `1px solid ${LINE}`, borderRadius: 14, padding: 8, marginBottom: 16 }}>
      <button onClick={() => setWeekId(shiftWeek(weekId, -1))} disabled={phase !== "start" && phase !== "review"} style={{ ...btnGhost, padding: 8 }} aria-label="Settimana precedente"><ChevronLeft size={18} /></button>
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>{info.label.split(" · ")[0]}</div>
        <div style={{ color: MUTED, fontSize: 12.5 }}>{info.label.split(" · ")[1]}</div>
      </div>
      <button onClick={() => setWeekId(shiftWeek(weekId, 1))} disabled={phase !== "start" && phase !== "review"} style={{ ...btnGhost, padding: 8 }} aria-label="Settimana successiva"><ChevronRight size={18} /></button>
    </div>
  );
  const picker = <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={e => { onPick(e.target.files); e.target.value = ""; }} />;

  if (phase === "done") return (
    <div>
      {header}
      <div style={{ background: CARD, border: `1px solid rgba(184,255,44,0.5)`, borderRadius: 18, padding: 24, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 32, background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Check size={36} color="#0b0b0b" strokeWidth={3} /></div>
        <div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>Pubblicato!</div>
        <div style={{ color: MUTED, fontSize: 14, marginTop: 4 }}>{info.label}</div>
        <div style={{ marginTop: 16, textAlign: "left" }}>
          {published.map(p => <div key={p.dayKey} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${LINE}`, color: "#ddd", fontSize: 14.5 }}>
            <span>{DAY_LABEL[p.dayKey]}</span><span style={{ color: MUTED }}>{p.n} {p.n === 1 ? "blocco" : "blocchi"}</span></div>)}
        </div>
      </div>
      <a href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer"
        style={{ ...btnGreen, width: "100%", justifyContent: "center", marginTop: 16, padding: "16px", fontSize: 16, textDecoration: "none", boxSizing: "border-box" }}>
        <Send size={18} /> Avvisa il gruppo su WhatsApp
      </a>
      <button onClick={restart} style={{ ...btnGhost, width: "100%", justifyContent: "center", marginTop: 10 }}>Carica un'altra settimana</button>
    </div>
  );

  if (phase === "start") return (
    <div>
      {header}{weekPicker}{picker}
      <button onClick={() => fileRef.current?.click()} style={{ width: "100%", background: GREEN, color: "#0b0b0b", border: "none", borderRadius: 22, padding: "38px 16px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <ImagePlus size={44} />
        <span style={{ fontSize: 20, fontWeight: 800 }}>Carica gli screenshot</span>
        <span style={{ fontSize: 13.5, fontWeight: 600, opacity: 0.8 }}>Selezionali tutti insieme, in ordine da lunedì a domenica</span>
      </button>
      <div style={{ color: "#ccc", fontSize: 13, marginTop: 14, lineHeight: 1.5, background: CARD, border: `1px solid ${LINE}`, borderRadius: 14, padding: "10px 12px" }}>
        <b style={{ color: "#fff" }}>Niente data sugli screenshot?</b> Nessun problema: se il giorno non è scritto li metto in ordine (il primo è lunedì, poi martedì…) e te li mostro in giallo. Puoi cambiare il giorno di ognuno con un tocco prima di pubblicare.
      </div>
      <div style={{ color: MUTED, fontSize: 13, marginTop: 16, lineHeight: 1.5, display: "flex", gap: 8 }}>
        <ShieldCheck size={16} color={GREEN} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>I giorni vengono riconosciuti in automatico. Nomi e risultati personali vengono tolti: il programma vale per tutto il team.</span>
      </div>
    </div>
  );

  const reading = items.filter(it => it.status === "reading" || it.status === "pending").length;
  return (
    <div>
      {header}{weekPicker}{picker}
      {phase === "reading" && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
        <Loader2 size={18} className="spin" color={GREEN} /> Leggo gli screenshot… {items.length - reading}/{items.length}
      </div>}
      {phase === "review" && guessedCount > 0 && <div style={{ color: AMBER, fontSize: 13.5, marginBottom: 12, lineHeight: 1.4 }}>
        Su {guessedCount} screenshot il giorno non era scritto: l'ho messo in ordine. Controlla i giorni in giallo.
      </div>}

      {items.map(it => {
        const d = days[it.key];
        return (
          <div key={it.key} style={{ display: "flex", gap: 12, background: CARD, border: `1px solid ${it.status === "error" ? RED : d?.guessed ? "rgba(240,184,74,0.5)" : LINE}`, borderRadius: 14, padding: 10, marginBottom: 10 }}>
            <div style={{ width: 62, height: 84, borderRadius: 8, overflow: "hidden", background: "#111", flexShrink: 0 }}>
              {it.preview && <img src={it.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {it.status === "done" && <>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.workouts.map(w => w.title).join(" · ") || "Nessun blocco trovato"}</div>
                <div style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>{it.workouts.length} {it.workouts.length === 1 ? "blocco" : "blocchi"}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {DAY_ORDER.map((k, i) => {
                    const on = d?.dayKey === k;
                    return <button key={k} onClick={() => setDay(it.key, k)} aria-label={`${DAY_LABEL[k]} ${prettyDate(dates[i])}`} style={{
                      flex: 1, minWidth: 0, padding: "6px 0", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer",
                      background: on ? (d.guessed ? "rgba(240,184,74,0.18)" : "rgba(184,255,44,0.18)") : "#1f1f1f",
                      color: on ? (d.guessed ? AMBER : GREEN) : MUTED, border: `1px solid ${on ? (d.guessed ? AMBER : GREEN) : "transparent"}` }}>{SHORT[k]}</button>;
                  })}
                </div>
              </>}
              {(it.status === "reading" || it.status === "pending") && <div style={{ color: MUTED, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6, height: "100%" }}><Loader2 size={14} className="spin" /> Lettura in corso…</div>}
              {it.status === "error" && <div>
                <div style={{ color: RED, fontSize: 13 }}>Non riuscito: {it.error}</div>
                <button onClick={() => readAll([it], items)} style={{ ...btnGhost, marginTop: 6, fontSize: 13 }}><RotateCw size={13} /> Riprova</button>
              </div>}
            </div>
            {it.status !== "reading" && <button onClick={() => remove(it.key)} aria-label="Togli" style={{ background: "none", border: "none", color: "#666", cursor: "pointer", padding: 2, alignSelf: "flex-start" }}><X size={16} /></button>}
          </div>
        );
      })}

      {removed.length > 0 && phase !== "reading" && <div style={{ color: MUTED, fontSize: 12, margin: "4px 0 12px", display: "flex", gap: 6 }}>
        <ShieldCheck size={14} color={GREEN} style={{ flexShrink: 0 }} /> <span>Esclusi perché personali: {removed.map(r => r.split(" — ")[0]).join(", ")}</span>
      </div>}
      {err && <div style={{ color: RED, fontSize: 13, marginBottom: 10 }}>{err}</div>}

      {phase !== "reading" && <>
        <button onClick={publish} disabled={!groups.length || phase === "publishing"} style={{ ...btnGreen, width: "100%", justifyContent: "center", padding: 16, fontSize: 17, marginTop: 6, opacity: groups.length && phase !== "publishing" ? 1 : 0.5 }}>
          {phase === "publishing" ? <><Loader2 size={18} className="spin" /> Pubblico…</> : <><Check size={18} /> Pubblica {groups.length} {groups.length === 1 ? "giorno" : "giorni"}</>}
        </button>
        <button onClick={() => fileRef.current?.click()} style={{ ...btnGhost, width: "100%", justifyContent: "center", marginTop: 10 }}><ImagePlus size={15} /> Aggiungi altri screenshot</button>
      </>}
    </div>
  );
}
