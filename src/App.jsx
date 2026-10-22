import { useEffect, useRef, useState } from "react";
import { Home as HomeIcon, CalendarDays, Camera, MessageSquare, Upload, X, Check, ChevronRight, Calculator } from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";
import { GREEN, BG, CARD, LINE, MUTED, RED, FONT, inp, btnGreen, btnGhost } from "./lib/theme";
import { AppIcon, ShieldMark, Wordmark } from "./components/Logo";
import { toValue } from "./lib/scoring";
import { ingest, weekInfo, todayISO, shiftWeek, DAY_LABEL, prettyDate } from "./lib/weeks";
import { notify, registerSW, syncPushName } from "./lib/push";
import Novita from "./components/Novita";
import { persistDay } from "./lib/db";
import Coach, { coachCodeFromUrl, coachAllowed } from "./components/Coach";
import Home from "./components/Home";
import Calendario from "./components/Calendario";
import WorkoutEditor from "./components/WorkoutEditor";
import UploadPanel from "./components/UploadPanel";
import Bacheca from "./components/Bacheca";
import Utility from "./components/Utility";
import Profilo from "./components/Profilo";
import { rowToRecord, matchScore, wouldBePR, recKey, recTitle } from "./lib/records";
import { CAP_BASE, display as showScore } from "./lib/scoring";

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* navigazione privata */ } },
};
const session = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* navigazione privata */ } },
};
const rowToEntry = (r) => ({ _key: r.id, wod: r.workout_id, name: r.athlete, value: r.value, raw: r.raw, note: r.note, rx: r.rx, ts: new Date(r.created_at).getTime() });

export default function App() {
  if (typeof __DEMO__ !== "undefined" && __DEMO__) return <DemoRoot />;
  return <Root />;
}

// Solo nella preview demo: interruttore tra la vista del team e quella della coach.
function DemoRoot() {
  const [mode, setMode] = useState("team");
  const [n, setN] = useState(0);
  const pick = (m) => { setMode(m); setN(x => x + 1); };
  return <>
    <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#1d1d1d", borderBottom: `1px solid ${LINE}`, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: "system-ui, sans-serif" }}>
      <span style={{ color: MUTED }}>Preview demo · vista:</span>
      {[["team", "Team"], ["coach", "Coach (Giada)"]].map(([k, l]) => <button key={k} onClick={() => pick(k)} style={{ background: mode === k ? GREEN : "#2a2a2a", color: mode === k ? "#0b0b0b" : "#ccc", border: "none", borderRadius: 999, padding: "4px 10px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{l}</button>)}
    </div>
    {mode === "coach" ? <Shell><Coach key={n} /></Shell> : <Main key={n} />}
  </>;
}

function Root() {
  if (!supabaseConfigured) return <Shell><div style={{ color: "#fff", padding: 24, lineHeight: 1.5 }}>
    <h2>Configurazione mancante</h2>
    <p style={{ color: MUTED }}>Imposta <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> nel file <code>.env</code> (in locale) o nelle variabili d'ambiente di Netlify, poi rifai la build.</p>
  </div></Shell>;
  const code = coachCodeFromUrl();
  if (code !== null) return <Shell>{coachAllowed(code) ? <Coach /> : <div style={{ color: MUTED, padding: 40, textAlign: "center" }}>Link non valido. Chiedi il link aggiornato.</div>}</Shell>;
  return <Main />;
}

// Giorno da mostrare quando apri una settimana: oggi se è questa settimana, altrimenti il primo con allenamenti.
function defaultDay(weekId, week) {
  const t = weekInfo(todayISO());
  if (weekId === t.weekId) return t.dayKey;
  return week?.days?.find(d => d.workouts.length)?.key || "lun";
}

function Main() {
  const thisWeek = weekInfo(todayISO()).weekId;
  const [name, setName] = useState(store.get("athlete:name") || "");
  const [entered, setEntered] = useState(session.get("entered") === "1");
  const [weeks, setWeeks] = useState({});           // cache: id -> settimana | null
  const [entries, setEntries] = useState([]);
  const [done, setDone] = useState(() => new Set());   // blocchi completati (solo miei)
  const [records, setRecords] = useState([]);          // record personali visibili (pubblici + i miei privati)
  const [profile, setProfile] = useState(null);        // nome dell'atleta di cui vedo il profilo
  const [toast, setToast] = useState(null);
  const [news, setNews] = useState([]);                // novità dell'app (changelog)
  const [page, setPage] = useState(null);              // pagina extra: "novita"
  const [newsSeen, setNewsSeen] = useState(() => store.get("news:seen") || "");
  const nameRef = useRef(name); nameRef.current = name;
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [tab, setTab] = useState("home");           // home | calendario | carica | bacheca
  const [sub, setSub] = useState(null);             // import | edit
  const [calWeek, setCalWeek] = useState(thisWeek);
  const [calDay, setCalDay] = useState(weekInfo(todayISO()).dayKey);
  const [uploadDate, setUploadDate] = useState(null);
  const weeksRef = useRef({});
  weeksRef.current = weeks;

  const putWeek = (id, w) => setWeeks(p => ({ ...p, [id]: w }));
  const loadWeek = async (id) => {
    const { data, error } = await supabase.from("weeks").select("data").eq("id", id).maybeSingle();
    if (error) throw error;
    const w = data?.data?.days ? ingest(data.data) : null;
    putWeek(id, w);
    return w;
  };
  const loadScores = async () => {
    const { data, error } = await supabase.from("scores").select("*");
    if (!error) setEntries((data || []).map(rowToEntry));
  };

  // Record personali: i privati degli altri non arrivano mai nell'interfaccia
  const loadRecords = async () => {
    const { data, error } = await supabase.from("personal_records").select("*");
    if (!error) setRecords((data || []).map(rowToRecord).filter(r => !r.private || r.athlete === nameRef.current));
  };
  useEffect(() => { loadRecords(); }, [name]);
  const openProfile = (n) => { setProfile(n); window.scrollTo(0, 0); };
  const flash = (t) => { setToast(t); setTimeout(() => setToast(x => x === t ? null : x), 3500); };
  const addRecord = async (rec, scoreId = null) => {
    const isPR = wouldBePR(records, name, rec);
    const row = { athlete: name, category: rec.category, exercise: rec.exercise, kind: rec.kind, rm: rec.rm, value: rec.value, raw: rec.raw, record_date: rec.date || todayISO(), note: rec.note || "", private: !!rec.private, score_id: scoreId };
    const { data, error } = await supabase.from("personal_records").insert(row).select().single();
    if (error) return { error: "Record non salvato: " + error.message };
    setRecords(p => p.some(x => x.id === data.id) ? p : [...p, rowToRecord(data)]);
    if (isPR) flash(`🏆 Nuovo PR! ${recTitle(rec)} · ${showScore(rec.kind, rec.value, rec.raw)}`);
    return { pr: isPR };
  };
  const removeRecord = async (r) => {
    const { error } = await supabase.from("personal_records").delete().eq("id", r.id);
    if (!error) setRecords(p => p.filter(x => x.id !== r.id));
  };
  const setRecordPrivate = async (g, priv) => {
    const ids = records.filter(r => r.athlete === name && recKey(r) === g.key).map(r => r.id);
    setRecords(p => p.map(r => ids.includes(r.id) ? { ...r, private: priv } : r));
    await supabase.from("personal_records").update({ private: priv }).in("id", ids);
  };

  // Blocchi segnati come completati: privati, filtrati per nome atleta
  const loadDone = async (who) => {
    if (!who) return;
    const { data, error } = await supabase.from("workout_done").select("workout_id").eq("athlete", who);
    if (!error) setDone(new Set((data || []).map(r => r.workout_id)));
  };
  useEffect(() => { loadDone(name); syncPushName(name).catch(() => {}); }, [name]);

  // Novità dell'app + apertura da notifica (?tab=bacheca / calendario / novita)
  useEffect(() => {
    supabase.from("changelog").select("*").order("created_at", { ascending: false }).limit(30).then(({ data }) => setNews(data || []));
    registerSW();
    const openUrl = (href) => {
      const q = new URL(href, location.href).searchParams.get("tab");
      if (q === "novita") { setPage("novita"); setTab("home"); }
      else if (["bacheca", "calendario", "utility", "home"].includes(q)) { setPage(null); setProfile(null); setSub(null); setTab(q); }
    };
    if (location.search.includes("tab=")) { openUrl(location.href); history.replaceState(null, "", location.pathname); }
    const onMsg = (e) => { if (e.data?.type === "open") openUrl(e.data.url); };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, []);
  const openNews = () => { setPage("novita"); setProfile(null); setSub(null); setTab("home"); window.scrollTo(0, 0); if (news[0]) { setNewsSeen(news[0].id); store.set("news:seen", news[0].id); } };
  const setBlockDone = async (w, on) => {
    const had = done.has(w.id);
    if (on === had) return;
    setDone(p => { const n = new Set(p); on ? n.add(w.id) : n.delete(w.id); return n; });
    const { error } = on
      ? await supabase.from("workout_done").insert({ athlete: name, workout_id: w.id, week_id: w.id.split("__")[0] })
      : await supabase.from("workout_done").delete().eq("athlete", name).eq("workout_id", w.id);
    if (error && !/duplicate/i.test(error.message || "")) setDone(p => { const n = new Set(p); had ? n.add(w.id) : n.delete(w.id); return n; });
  };
  const toggleDone = (w) => setBlockDone(w, !done.has(w.id));

  useEffect(() => {
    let ch;
    (async () => {
      try { await loadWeek(thisWeek); await loadScores(); }
      catch (e) { setLoadErr("Non riesco a collegarmi al database. " + (e.message || "")); }
      setLoading(false);
      ch = supabase.channel("live")
        .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, loadScores)
        .on("postgres_changes", { event: "*", schema: "public", table: "personal_records" }, loadRecords)
        .on("postgres_changes", { event: "*", schema: "public", table: "weeks" }, (p) => {
          if (p.new?.id && p.new.id in weeksRef.current) putWeek(p.new.id, ingest(p.new.data));
        })
        .subscribe();
    })();
    return () => { if (ch) supabase.removeChannel(ch); };
  }, []);

  const openWeek = async (id, day) => {
    setCalWeek(id);
    const w = id in weeksRef.current ? weeksRef.current[id] : await loadWeek(id).catch(() => null);
    setCalDay(day || defaultDay(id, w));
  };
  const goDay = (dayKey) => { setTab("calendario"); setSub(null); openWeek(thisWeek, dayKey); };

  // Aggiunge o aggiorna un giorno, mantenendo gli id dei blocchi già esistenti.
  const saveDay = async (day) => {
    const { week: wk, error } = await persistDay(day);
    if (error) return error;
    putWeek(wk.id, wk);
    setCalWeek(wk.id); setCalDay(day.dayKey); setTab("calendario"); setSub(null);
    notify("workout", `✏️ Aggiornato ${DAY_LABEL[day.dayKey]?.toLowerCase() || "un giorno"}`, `${name} ha ${day.workouts?.length ? "aggiornato" : "modificato"} l'allenamento del ${prettyDate(day.date || todayISO())}`, "/?tab=calendario", name);
    return null;
  };

  // Salva il timer scelto su un singolo blocco (senza cambiare giorno o schermata)
  const setBlockTimer = async (w, timer) => {
    const [weekId, dayKey] = w.id.split("__");
    const wk = weeksRef.current[weekId]; const day = wk?.days?.find(d => d.key === dayKey);
    if (!day) return;
    const workouts = day.workouts.map(x => x.id === w.id ? { ...x, timer } : x);
    const { week, error } = await persistDay({ weekId, weekLabel: wk.label, dayKey, date: day.date, workouts });
    if (!error) putWeek(week.id, week);
  };

  const importWeek = async (raw) => {
    let data; try { data = JSON.parse(raw); } catch { return "JSON non valido."; }
    if (!data?.id || !Array.isArray(data.days)) return "Servono i campi id e days.";
    const wk = ingest(data);
    const { error } = await supabase.from("weeks").upsert({ id: wk.id, label: wk.label, data: wk, updated_at: new Date().toISOString() });
    if (error) return "Salvataggio non riuscito: " + error.message;
    putWeek(wk.id, wk); setSub(null); setTab("calendario"); openWeek(wk.id);
    notify("workout", "💪 Nuova programmazione", `${wk.label} è online`, "/?tab=calendario", name);
    return null;
  };

  const addScore = async (wo, raw, note, rx) => {
    const value = toValue(wo.type, raw);
    const { data, error } = await supabase.from("scores").insert({ workout_id: wo.id, athlete: name, value, raw: raw.trim(), note: note.trim(), rx }).select().single();
    if (error) return "Punteggio non salvato: " + error.message;
    setEntries(p => p.some(x => x._key === data.id) ? p : [...p, rowToEntry(data)]);
    setBlockDone(wo, true);   // registrare il punteggio = blocco completato
    // Se il blocco è un massimale o un benchmark e il punteggio batte il mio record, diventa un PR
    const m = matchScore(wo);
    if (m && value !== null && !(wo.type === "time" && value > CAP_BASE / 2)) {
      const cand = { ...m, value, raw: raw.trim() };
      if (wouldBePR(records, name, cand)) {
        const priv = records.some(r => r.athlete === name && recKey(r) === recKey(cand) && r.private);
        addRecord({ ...cand, date: todayISO(), note: wo.title, private: priv }, data.id);
      }
    }
    return null;
  };
  const removeEntry = async (e) => {
    const { error } = await supabase.from("scores").delete().eq("id", e._key);
    if (!error) setEntries(p => p.filter(x => x._key !== e._key));
    const linked = records.filter(r => r.scoreId === e._key);
    if (linked.length) { await supabase.from("personal_records").delete().eq("score_id", e._key); setRecords(p => p.filter(r => r.scoreId !== e._key)); }
  };
  const rename = () => { const n = prompt("Il tuo nome", name); if (n?.trim()) { setName(n.trim()); store.set("athlete:name", n.trim()); } };

  if (loading) return <Shell><div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}><AppIcon size={84} style={{ animation: "fade .5s ease both" }} /><Wordmark size={20} /></div></Shell>;
  if (!name || !entered) return <Shell><Splash name={name} onEnter={(n, target) => {
    if (n !== name) { setName(n); store.set("athlete:name", n); }
    setEntered(true); session.set("entered", "1");
    if (target === "carica") { setUploadDate(null); setTab("carica"); }
  }} /></Shell>;

  const calWeekData = weeks[calWeek];
  const calDayData = calWeekData?.days?.find(d => d.key === calDay);
  let body;
  if (sub === "import") body = <ImportPanel onImport={importWeek} onCancel={() => setSub(null)} />;
  else if (sub === "edit" && calDayData) body = <EditDay week={calWeekData} day={calDayData} onSave={saveDay} onCancel={() => setSub(null)} />;
  else if (tab === "carica") body = <UploadPanel key={uploadDate || "oggi"} initialDate={uploadDate} currentWeek={weeks[weekInfo(uploadDate || todayISO()).weekId]}
    onAdd={saveDay} onCancel={() => setTab("home")} onImportJson={() => setSub("import")} />;
  else if (tab === "bacheca") body = <Bacheca name={name} />;
  else if (page === "novita") body = <Novita items={news} onBack={() => setPage(null)} />;
  else if (profile && tab !== "carica") body = <Profilo athlete={profile} me={name} records={records} onBack={() => setProfile(null)}
    onAdd={addRecord} onRemove={removeRecord} onSetPrivate={setRecordPrivate} onRename={rename} onOpenNews={openNews} />;
  else if (tab === "utility") body = <Utility name={name} records={records} />;
  else if (tab === "calendario") body = <Calendario weekId={calWeek} week={calWeekData} dayKey={calDay} setDayKey={setCalDay}
    onShift={(d) => openWeek(shiftWeek(calWeek, d))} onToday={() => openWeek(thisWeek)}
    entries={entries} name={name} onAdd={addScore} onRemove={removeEntry} onEdit={() => setSub("edit")}
    onUpload={(date) => { setUploadDate(date); setTab("carica"); }} onSetTimer={setBlockTimer} done={done} onToggleDone={toggleDone}
    records={records} onOpenAthlete={openProfile} />;
  else body = <Home name={name} week={weeks[thisWeek]} entries={entries} done={done} onToggleDone={toggleDone} onOpenDay={goDay} onRename={() => openProfile(name)}
    records={records} onOpenAthlete={openProfile}
    onUpload={() => { setUploadDate(null); setTab("carica"); }} onBacheca={() => setTab("bacheca")}
    latestNews={news[0] && news[0].id !== newsSeen ? news[0] : null} onOpenNews={openNews} />;

  const go = (k) => { setSub(null); setProfile(null); setPage(null); if (k === "carica") setUploadDate(null); if (k === "calendario" && tab !== "calendario") openWeek(thisWeek); setTab(k); };
  return (
    <Shell>
      {loadErr && <div style={{ color: RED, fontSize: 13, marginTop: 12 }}>{loadErr}</div>}
      {body}
      {toast && <div role="status" className="fade" style={{ position: "fixed", left: 16, right: 16, bottom: "calc(80px + env(safe-area-inset-bottom))", zIndex: 30, maxWidth: 520, margin: "0 auto", background: GREEN, color: "#0b0b0b", fontWeight: 900, fontSize: 15, borderRadius: 16, padding: "13px 16px", textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,.5)" }} onClick={() => setToast(null)}>{toast}</div>}
      <div style={{ height: "calc(90px + env(safe-area-inset-bottom))" }} />
      <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "rgba(14,14,14,0.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderTop: `1px solid ${LINE}`, paddingBottom: "env(safe-area-inset-bottom)", zIndex: 10 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", height: 64, padding: "0 8px" }}>
          {[["home", "Home", HomeIcon], ["calendario", "Calendario", CalendarDays], ["carica", "Carica", Camera], ["bacheca", "Bacheca", MessageSquare], ["utility", "Utility", Calculator]].map(([k, l, I]) => {
            const on = tab === k;
            return (
              <button key={k} onClick={() => go(k)} style={{ flex: 1, background: "none", border: "none", color: on ? GREEN : MUTED, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, fontSize: 10.5, fontWeight: 800, cursor: "pointer", letterSpacing: 0.2 }}>
                <span style={{ width: 46, height: 30, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", background: on ? "rgba(184,255,44,0.14)" : "transparent", transition: "background .2s" }}><I size={20} strokeWidth={on ? 2.4 : 2} /></span>
                {l}
              </button>
            );
          })}
        </div>
      </nav>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: FONT, color: "#fff" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "env(safe-area-inset-top) 16px 0" }}>{children}</div>
    </div>
  );
}

// Schermata di apertura: logo grande, "Entra" e accesso rapido al caricamento.
// La prima volta chiede anche il nome.
function Splash({ name, onEnter }) {
  const [v, setV] = useState("");
  const needName = !name;
  const go = (target) => { const n = needName ? v.trim() : name; if (!n) return; onEnter(n, target); };
  return (
    <div className="fade" style={{ minHeight: "92vh", display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 24 }}>
      <div style={{ position: "relative", display: "flex", justifyContent: "center", marginBottom: 26 }}>
        <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(184,255,44,0.25) 0%, rgba(184,255,44,0) 68%)", top: -50 }} />
        <ShieldMark size={210} style={{ position: "relative", filter: "drop-shadow(0 16px 36px rgba(0,0,0,.65))" }} />
      </div>
      <div style={{ textAlign: "center" }}><Wordmark size={44} stacked /></div>
      <p style={{ color: MUTED, fontSize: 15.5, textAlign: "center", margin: "16px 0 30px", lineHeight: 1.45 }}>Il programma del team, i tuoi punteggi,<br />la classifica live.</p>
      {needName ? (
        <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 20, padding: 16 }}>
          <label style={{ color: MUTED, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>Come ti chiami?</label>
          <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === "Enter" && go("home")} placeholder="Nome e cognome" style={{ ...inp, width: "100%", marginTop: 8 }} autoFocus />
          <button onClick={() => go("home")} style={{ ...btnGreen, width: "100%", justifyContent: "center", marginTop: 10, padding: 15, fontSize: 17 }}>Entra</button>
        </div>
      ) : (
        <div>
          <button onClick={() => go("home")} style={{ ...btnGreen, width: "100%", justifyContent: "center", padding: 17, fontSize: 18, borderRadius: 16 }}>Entra <ChevronRight size={20} /></button>
          <button onClick={() => go("carica")} style={{ ...btnGhost, width: "100%", justifyContent: "center", padding: 15, fontSize: 15.5, borderRadius: 16, marginTop: 10, color: "#fff" }}><Camera size={18} color={GREEN} /> Carica lo screenshot</button>
          <div style={{ textAlign: "center", color: MUTED, fontSize: 13, marginTop: 16 }}>Ciao <b style={{ color: "#fff" }}>{name}</b></div>
        </div>
      )}
    </div>
  );
}

function EditDay({ week, day, onSave, onCancel }) {
  const [workouts, setWorkouts] = useState(day.workouts);
  const [err, setErr] = useState(null);
  const save = async () => {
    const e = await onSave({ weekId: week.id, weekLabel: week.label, dayKey: day.key, date: day.date, workouts: workouts.filter(w => w.title.trim() || w.detail.trim()) });
    if (e) setErr(e);
  };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 12 }}>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Modifica {day.label}</h1>
        <button onClick={onCancel} style={btnGhost} aria-label="Chiudi"><X size={16} /></button>
      </div>
      <WorkoutEditor workouts={workouts} onChange={setWorkouts} />
      {err && <div style={{ color: RED, fontSize: 13, marginTop: 10 }}>{err}</div>}
      <button onClick={save} style={{ ...btnGreen, width: "100%", justifyContent: "center", marginTop: 14 }}><Check size={16} /> Salva modifiche</button>
    </div>
  );
}

function ImportPanel({ onImport, onCancel }) {
  const [raw, setRaw] = useState(""); const [err, setErr] = useState(null);
  const go = async () => { const e = await onImport(raw); if (e) setErr(e); };
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 14 }}>
        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Importa settimana (JSON)</h1>
        <button onClick={onCancel} style={btnGhost} aria-label="Chiudi"><X size={16} /></button>
      </div>
      <textarea value={raw} onChange={e => { setRaw(e.target.value); setErr(null); }} rows={14}
        style={{ ...inp, width: "100%", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5, lineHeight: 1.5, resize: "vertical" }} />
      {err && <div style={{ color: RED, fontSize: 13, marginTop: 8 }}>{err}</div>}
      <button onClick={go} style={{ ...btnGreen, width: "100%", justifyContent: "center", marginTop: 12 }}><Upload size={16} /> Importa</button>
    </div>
  );
}
