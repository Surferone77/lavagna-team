import { useEffect, useState } from "react";
import { Timer as TimerIcon, Clock } from "lucide-react";
import { loadSharedDay } from "../lib/shareDay";
import { estimateDay, fmtBlock, isOptional } from "../lib/duration";
import { suggestTimer } from "../lib/timer";
import { TimerSheet, TimerScreen } from "./Timer";
import { AppIcon, Wordmark } from "./Logo";
import { GREEN, CARD, LINE, MUTED } from "../lib/theme";

const fmt = (iso) => new Date(iso).toLocaleString("it-CH", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

// Pagina per l'ospite: solo gli esercizi del giorno condiviso, con durata e timer. Nient'altro dell'app.
export default function GuestDay({ token }) {
  const [day, setDay] = useState(undefined);
  const [sheet, setSheet] = useState(null);
  const [timer, setTimer] = useState(null);
  useEffect(() => { loadSharedDay(token).then(setDay).catch(() => setDay(null)); }, [token]);

  if (day === undefined) return <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}><AppIcon size={70} /></div>;
  if (!day) return (
    <div style={{ minHeight: "70vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 12 }}>
      <AppIcon size={64} />
      <div style={{ color: "#fff", fontSize: 19, fontWeight: 800 }}>Link scaduto o non valido</div>
      <div style={{ color: MUTED, fontSize: 14 }}>Chiedi a chi te l'ha mandato un link nuovo.</div>
    </div>
  );
  const ws = day.workouts || [];
  const dur = estimateDay(ws);
  return (
    <div className="fade">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}><AppIcon size={36} /><Wordmark size={15} /></div>
      <div style={{ margin: "20px 0 14px" }}>
        <div style={{ color: MUTED, fontSize: 13, fontWeight: 600 }}>Allenamento condiviso{day.created_by ? ` da ${day.created_by.split(" ")[0]}` : ""}</div>
        <div style={{ color: "#fff", fontSize: 26, fontWeight: 900, letterSpacing: -0.5, textTransform: "capitalize" }}>{day.day_label}</div>
        {dur.label && <div style={{ color: "#ddd", fontSize: 14, fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}><Clock size={15} color={GREEN} /> {dur.label}{dur.alt ? ` · oppure recupero attivo ${dur.alt}` : ""}</div>}
      </div>
      {ws.map((w, i) => {
        const e = dur.blocks[i]?.est;
        return (
          <div key={i} style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 18, padding: 16, marginBottom: 12, opacity: isOptional(w) ? 0.85 : 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontSize: 17, fontWeight: 800, lineHeight: 1.25 }}>{w.title}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {fmtBlock(e) && <span style={chip}>⏱ {fmtBlock(e)}</span>}
                  {w.tag && <span style={{ ...chip, color: GREEN }}>{w.tag}</span>}
                </div>
              </div>
              {!e?.info && <button onClick={() => setSheet(w)} aria-label={`Timer per ${w.title}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(184,255,44,0.12)", color: GREEN, border: "1px solid rgba(184,255,44,0.3)", borderRadius: 999, padding: "5px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}><TimerIcon size={14} /> Timer</button>}
            </div>
            <pre style={{ color: "#dcdcdc", fontSize: 15, lineHeight: 1.55, whiteSpace: "pre-wrap", fontFamily: "inherit", margin: "12px 0 0" }}>{w.detail}</pre>
          </div>
        );
      })}
      <div style={{ color: "#5c5c5c", fontSize: 12, textAlign: "center", margin: "10px 0 20px" }}>Link valido fino a {fmt(day.expires_at)}</div>
      {sheet && <TimerSheet w={sheet} suggestion={suggestTimer(sheet)} onStart={(cfg) => { setTimer({ cfg, title: sheet.title }); setSheet(null); }} onClose={() => setSheet(null)} />}
      {timer && <TimerScreen config={timer.cfg} title={timer.title} onClose={() => setTimer(null)} />}
    </div>
  );
}
const chip = { display: "inline-flex", alignItems: "center", background: "#222", color: "#cfcfcf", fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999 };
