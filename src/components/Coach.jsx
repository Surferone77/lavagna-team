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
  const pickDay = useRef(null);      // giorno per cui sto scegliendo gli screenshot (null = tutti insieme)
  const pickDayOf = useRef({});      // key -> giorno scelto al caricamento
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
    const auto = Object.fromEntries(assignDays(ok.filter(it => !pickDayOf.current[it.key]), weekId).map(a => [a.key, a]));
    for (const it of ok) if (pickDayOf.current[it.key]) auto[it.key] = { key: it.key, dayKey: pickDayOf.current[it.key], guessed: false, manual: true };
    // unisco: le letture in parallelo (un giorno dopo l'altro) non devono cancellarsi a vicenda
    setDays(prev => { const n = { ...prev, ...auto }; for (const k in prev) if (prev[k].manual) n[k] = prev[k]; return n; });
    setPhase("review");
  };

  const onPick = (files) => {
    const fresh = Array.from(files || []).filter(f => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)).map(newItem);
    if (!fresh.length) return;
    const target = pickDay.current;
    if (target) {
      for (const it of fresh) pickDayOf.current[it.key] = target;
      setDays(d => ({ ...d, ...Object.fromEntries(fresh.map(it => [it.key, { key: it.key, dayKey: target, guessed: false, manual: true }])) }));
    }
    const all = [...items, ...fresh];
    setItems(all);
    readAll(fresh, all);
  };

  const remove = (key) => { setItems(l => l.filter(x => x.key !== key)); setDays(d => { const n = { ...d }; delete n[key]; return n; }); };
  const setDay = (key, dayKey) => { pickDayOf.current[key] = dayKey; setDays(d => ({ ...d, [key]: { key, dayKey, guessed: false, manual: true } })); };

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

  const restart = () => { setItems([]); setDays({}); setPublished([]); setPhase("start"); pickDayOf.current = {}; };
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

  // Una riga per giorno: ogni giorno ha i suoi screenshot (anche tanti). "Tutti insieme" solo se hanno la data scritta.
  const pickFor = (dayKey) => { pickDay.current = dayKey; fileRef.current?.click(); };
  const reading = items.filter(it => it.status === "reading" || it.status === "pending").length;
  const unread = items.filter(it => it.status === "error").length;
  const thumb = (it) => {
    const d = days[it.key];
    const mismatch = it.status === "done" && it.day && d?.manual && it.day !== d.dayKey;
    return (
      <div key={it.key} style={{ width: 64, flexShrink: 0 }}>
        <div style={{ position: "relative", width: 64, height: 86, borderRadius: 9, overflow: "hidden", background: "#111", border: `1.5px solid ${it.status === "error" ? RED : d?.guessed || mismatch ? AMBER : it.status === "done" ? "rgba(184,255,44,0.5)" : LINE}` }}>
          {it.preview && <img src={it.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />}
          {(it.status === "reading" || it.status === "pending") && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={18} className="spin" color={GREEN} /></div>}
          {it.status === "done" && <div style={{ position: "absolute", left: 4, bottom: 4, background: "rgba(0,0,0,.75)", color: GREEN, fontSize: 10.5, fontWeight: 900, borderRadius: 6, padding: "1px 5px" }}>{it.workouts.length} bl.</div>}
          {it.status !== "reading" && <button onClick={() => remove(it.key)} aria-label="Togli" style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: 10, background: "rgba(0,0,0,.7)", border: "none", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><X size={12} /></button>}
        </div>
        {it.status === "error"
          ? <button onClick={() => readAll([it], items)} style={{ width: "100%", marginTop: 4, background: "none", border: "none", color: RED, fontSize: 11, fontWeight: 800, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}><RotateCw size={11} /> Riprova</button>
          : <select value={d?.dayKey || ""} onChange={e => setDay(it.key, e.target.value)} aria-label="Sposta in un altro giorno"
              style={{ width: "100%", marginTop: 4, background: "#1c1c1c", color: d?.guessed || mismatch ? AMBER : "#bbb", border: `1px solid ${LINE}`, borderRadius: 7, fontSize: 11, padding: "2px 2px" }}>
              {DAY_ORDER.map(k => <option key={k} value={k}>{SHORT[k]} · {DAY_LABEL[k].slice(0, 3)}</option>)}
            </select>}
        {mismatch && <div style={{ color: AMBER, fontSize: 10, lineHeight: 1.2, marginTop: 2 }}>c'è scritto {DAY_LABEL[it.day].toLowerCase()}</div>}
      </div>
    );
  };

  return (
    <div>
      {header}{weekPicker}{picker}
      <div style={{ color: "#ccc", fontSize: 13.5, lineHeight: 1.5, marginBottom: 12 }}>
        Tocca <b style={{ color: "#fff" }}>+</b> su ogni giorno e scegli i suoi screenshot (anche più di uno). L'AI legge gli esercizi e toglie nomi e risultati personali.
      </div>
      {reading > 0 && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
        <Loader2 size={16} className="spin" color={GREEN} /> Leggo gli screenshot… {items.length - reading}/{items.length}
      </div>}
      {guessedCount > 0 && <div style={{ color: AMBER, fontSize: 13, marginBottom: 10, lineHeight: 1.4 }}>
        Su {guessedCount} screenshot il giorno non era scritto e li ho messi in ordine: controlla quelli in giallo e spostali se serve.
      </div>}

      {DAY_ORDER.map((k, i) => {
        const its = items.filter(it => days[it.key]?.dayKey === k || (!days[it.key] && pickDayOf.current[it.key] === k));
        const blocks = mergeWorkouts(its.filter(it => it.status === "done").map(it => it.workouts));
        return (
          <div key={k} style={{ background: CARD, border: `1px solid ${its.length ? "rgba(184,255,44,0.25)" : LINE}`, borderRadius: 16, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: "#fff", fontSize: 15.5, fontWeight: 800 }}>{DAY_LABEL[k]}</span>
                <span style={{ color: MUTED, fontSize: 12.5 }}> · {prettyDate(dates[i])}</span>
                {blocks.length > 0 && <div style={{ color: MUTED, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{blocks.length} {blocks.length === 1 ? "blocco" : "blocchi"}: {blocks.map(w => w.title).join(" · ")}</div>}
              </div>
              <button onClick={() => pickFor(k)} disabled={phase === "publishing"} aria-label={`Aggiungi screenshot di ${DAY_LABEL[k]}`}
                style={{ width: 40, height: 40, borderRadius: 20, background: its.length ? "#1f1f1f" : GREEN, color: its.length ? GREEN : "#0b0b0b", border: its.length ? `1px solid rgba(184,255,44,0.4)` : "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <ImagePlus size={19} />
              </button>
            </div>
            {its.length > 0 && <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 10, paddingBottom: 2 }}>{its.map(thumb)}</div>}
          </div>
        );
      })}

      {removed.length > 0 && <div style={{ color: MUTED, fontSize: 12, margin: "4px 0 12px", display: "flex", gap: 6 }}>
        <ShieldCheck size={14} color={GREEN} style={{ flexShrink: 0 }} /> <span>Esclusi perché personali: {removed.map(r => r.split(" — ")[0]).join(", ")}</span>
      </div>}
      {unread > 0 && <div style={{ color: RED, fontSize: 13, marginBottom: 8 }}>{unread} screenshot non letti: tocca Riprova sotto l'immagine.</div>}
      {err && <div style={{ color: RED, fontSize: 13, marginBottom: 10 }}>{err}</div>}

      <button onClick={publish} disabled={!groups.length || reading > 0 || phase === "publishing"} style={{ ...btnGreen, width: "100%", justifyContent: "center", padding: 16, fontSize: 17, marginTop: 6, opacity: groups.length && !reading && phase !== "publishing" ? 1 : 0.5 }}>
        {phase === "publishing" ? <><Loader2 size={18} className="spin" /> Pubblico…</> : groups.length ? <><Check size={18} /> Pubblica {groups.length} {groups.length === 1 ? "giorno" : "giorni"}</> : <>Aggiungi gli screenshot dei giorni</>}
      </button>
      <button onClick={() => pickFor(null)} style={{ background: "none", border: "none", color: MUTED, fontSize: 12.5, textDecoration: "underline", cursor: "pointer", padding: "12px 0 0", width: "100%" }}>
        Gli screenshot hanno il giorno scritto sopra? Caricali tutti insieme
      </button>
    </div>
  );
}
