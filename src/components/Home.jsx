import { useEffect, useState } from "react";
import { Camera, ChevronRight, MessageSquare, Trophy, Flame, Sparkles } from "lucide-react";
import Notifiche from "./Notifiche";
import { supabase } from "../supabaseClient";
import { storageUsageMB, PHOTO_LIMITS } from "../lib/photos";
import { display, TYPE_META } from "../lib/scoring";
import { DAY_LABEL, weekInfo, todayISO, prettyDate } from "../lib/weeks";
import { GREEN, CARD, LINE, MUTED, btnGreen, h1 } from "../lib/theme";
import { AppIcon, Wordmark } from "./Logo";
import { Ring, DoneCheck } from "./Progress";
import { progress } from "../lib/progress";
import { prEvents, recTitle } from "../lib/records";
import { showVal, prBadge } from "./Profilo";

const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join("");

const box = { background: CARD, border: `1px solid ${LINE}`, borderRadius: 20, padding: 18, marginBottom: 14 };
const h = { color: MUTED, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 6, marginBottom: 10 };

export default function Home({ name, week, entries, done: doneSet = new Set(), onToggleDone, records = [], onOpenAthlete, latestNews, onOpenNews, onOpenDay, onUpload, onBacheca, onRename }) {
  const [msgs, setMsgs] = useState([]);
  const [usage, setUsage] = useState(null);
  const [pushLater, setPushLater] = useState(() => { try { return localStorage.getItem("push:later") === "1"; } catch { return false; } });
  const today = todayISO();
  const info = weekInfo(today);
  const todayDay = week?.days?.find(d => d.key === info.dayKey);

  useEffect(() => {
    supabase.from("comunicazioni").select("*").order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setMsgs((data || []).filter(m => !m.eliminato).slice(0, 2)));
    storageUsageMB().then(setUsage);
  }, []);

  // Statistiche della settimana corrente
  const all = (week?.days || []).flatMap(d => d.workouts.map(w => ({ ...w, day: d.key })));
  const mine = entries.filter(e => e.name === name);
  const wk = progress(all, doneSet);
  const td = progress(todayDay?.workouts, doneSet);
  const events = prEvents(records.filter(r => !r.private));
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const teamPR = events.filter(e => e.date >= since).slice(0, 5);
  const myCount = new Set(records.filter(r => r.athlete === name).map(r => `${r.exercise}|${r.rm}`)).size;
  const ago = (iso) => { const d = Math.round((Date.parse(today) - Date.parse(iso)) / 864e5); return d <= 0 ? "oggi" : d === 1 ? "ieri" : `${d} g fa`; };
  const recent = mine.map(e => ({ e, w: all.find(w => w.id === e.wod) })).filter(x => x.w).sort((a, b) => b.e.ts - a.e.ts).slice(0, 4);

  return (
    <div>
      <div className="fade" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
        <AppIcon size={40} />
        <Wordmark size={17} />
        <div style={{ flex: 1 }} />
        <button onClick={onRename} aria-label="Cambia nome" style={{ width: 38, height: 38, borderRadius: 19, background: "#1c1c1c", border: `1px solid ${LINE}`, color: GREEN, fontWeight: 900, fontSize: 14, cursor: "pointer" }}>{initials(name)}</button>
      </div>
      <div className="fade" style={{ margin: "22px 0 18px" }}>
        <div style={{ color: MUTED, fontSize: 13.5, fontWeight: 600 }}>{DAY_LABEL[info.dayKey]} {prettyDate(today)} · {info.label.split(" · ")[0]}</div>
        <div style={{ ...h1, marginTop: 4 }}>Ciao {name.split(" ")[0]}</div>
      </div>

      {latestNews && (
        <button onClick={onOpenNews} className="fade" style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "rgba(184,255,44,0.1)", border: "1px solid rgba(184,255,44,0.4)", borderRadius: 16, padding: "11px 14px", marginBottom: 14, cursor: "pointer", textAlign: "left" }}>
          <Sparkles size={18} color={GREEN} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", color: GREEN, fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>Novità</span>
            <span style={{ display: "block", color: "#fff", fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{latestNews.title}</span>
          </span>
          <ChevronRight size={16} color={GREEN} />
        </button>
      )}
      {!pushLater && <Notifiche name={name} compact onDismiss={() => { setPushLater(true); try { localStorage.setItem("push:later", "1"); } catch { /* */ } }} />}

      <div className="fade" style={{ ...box, position: "relative", overflow: "hidden", borderColor: todayDay ? "rgba(184,255,44,0.35)" : LINE, background: todayDay ? "linear-gradient(160deg, #1b2410 0%, #141414 45%)" : CARD }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={h}><Flame size={13} color={GREEN} /> Allenamento di oggi</div>
          {todayDay && td.total > 0 && <Ring pct={td.pct} size={58} stroke={7} font={13} />}
        </div>
        {todayDay && td.total > 0 && <div style={{ color: MUTED, fontSize: 12.5, margin: "-6px 0 8px" }}>{td.pct === 100 ? "Tutto fatto, grande! 💪" : `${td.n} di ${td.total} blocchi completati · tocca il cerchio per segnarli`}</div>}
        {todayDay ? <>
          {todayDay.workouts.map(w => {
            const meta = TYPE_META[w.type];
            return (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${LINE}` }}>
                {onToggleDone && <DoneCheck on={doneSet.has(w.id)} onClick={() => onToggleDone(w)} size={26} label={`${w.title}: ${doneSet.has(w.id) ? "completato, tocca per annullare" : "segna come completato"}`} />}
                <span style={{ color: doneSet.has(w.id) ? MUTED : "#fff", textDecoration: doneSet.has(w.id) ? "line-through" : "none", fontSize: 15, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</span>
                <span style={{ color: MUTED, fontSize: 12, flexShrink: 0 }}>{w.tag || meta?.label || ""}</span>
              </div>
            );
          })}
          <button onClick={() => onOpenDay(info.dayKey)} style={{ ...btnGreen, width: "100%", justifyContent: "center", marginTop: 14 }}>Apri e registra i punteggi <ChevronRight size={16} /></button>
        </> : <>
          <div style={{ color: MUTED, fontSize: 14, marginBottom: 12 }}>Ancora nessun allenamento caricato per oggi.</div>
          <button onClick={onUpload} style={{ ...btnGreen, width: "100%", justifyContent: "center" }}><Camera size={16} /> Carica lo screenshot</button>
        </>}
      </div>

      {wk.total > 0 && <div style={box}>
        <div style={h}><Trophy size={13} color={GREEN} /> La tua settimana</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Ring pct={wk.pct} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontSize: 30, fontWeight: 900, letterSpacing: -0.5 }}>{wk.n}<span style={{ color: MUTED, fontSize: 17 }}> / {wk.total}</span></div>
            <div style={{ color: MUTED, fontSize: 13 }}>blocchi completati in settimana</div>
          </div>
        </div>
        {recent.length > 0 && <div style={{ marginTop: 14 }}>
          {recent.map(({ e, w }) => (
            <button key={e._key} onClick={() => onOpenDay(w.day)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, background: "none", border: "none", padding: "6px 0", cursor: "pointer", textAlign: "left" }}>
              <span style={{ color: MUTED, fontSize: 12, width: 34 }}>{DAY_LABEL[w.day].slice(0, 3)}</span>
              <span style={{ color: "#ddd", fontSize: 14, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</span>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{display(w.type, e.value, e.raw)}</span>
            </button>
          ))}
        </div>}
      </div>}

      <div style={box}>
        <div style={h}><Trophy size={13} color={GREEN} /> Record del team</div>
        {teamPR.length === 0 && <div style={{ color: MUTED, fontSize: 14 }}>Nessun nuovo record nell'ultimo mese.</div>}
        {teamPR.map(e => (
          <button key={e.id} onClick={() => onOpenAthlete?.(e.athlete)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, background: "none", border: "none", padding: "6px 0", cursor: "pointer", textAlign: "left" }}>
            <span style={prBadge}>PR</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14 }}>
              <b style={{ color: e.athlete === name ? GREEN : "#fff" }}>{e.athlete === name ? "Tu" : e.athlete}</b> <span style={{ color: "#ccc" }}>· {recTitle(e)}</span>
            </span>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{showVal(e)}</span>
            <span style={{ color: MUTED, fontSize: 11.5, width: 44, textAlign: "right" }}>{ago(e.date)}</span>
          </button>
        ))}
        <button onClick={() => onOpenAthlete?.(name)} style={{ background: "none", border: "none", color: GREEN, fontSize: 13, fontWeight: 600, padding: "8px 0 0", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
          Il mio profilo{myCount ? ` · ${myCount} record` : ""} <ChevronRight size={14} /></button>
      </div>

      <div style={box}>
        <div style={h}><MessageSquare size={13} color={GREEN} /> Bacheca</div>
        {msgs.length === 0 && <div style={{ color: MUTED, fontSize: 14 }}>Nessun messaggio.</div>}
        {msgs.map(m => (
          <div key={m.id} style={{ padding: "5px 0" }}>
            <span style={{ color: GREEN, fontWeight: 700, fontSize: 13 }}>{m.utente} </span>
            <span style={{ color: "#ddd", fontSize: 14 }}>{m.messaggio || (m.allegato_nome ? `📎 ${m.allegato_nome}` : "")}</span>
          </div>
        ))}
        <button onClick={onBacheca} style={{ background: "none", border: "none", color: GREEN, fontSize: 13, fontWeight: 600, padding: "8px 0 0", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>Apri la bacheca <ChevronRight size={14} /></button>
      </div>
      {usage !== null && <div style={{ color: "#5c5c5c", fontSize: 11.5, textAlign: "center", marginTop: 6 }}>
        Spazio foto del team: {usage < 1 ? "<1" : Math.round(usage)} MB su {PHOTO_LIMITS.freeQuotaMB / 1024} GB gratuiti
      </div>}
    </div>
  );
}
