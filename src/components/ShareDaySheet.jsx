import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Link2, Copy, Share2, Send, Loader2, Ban, Check } from "lucide-react";
import { createDayLink, revokeDayLink, existingLink, dayLink } from "../lib/shareDay";
import { GREEN, LINE, MUTED, RED, FONT, pill, pillOn, btnGreen } from "../lib/theme";

const iconBtn = { background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", width: 38, height: 38, borderRadius: 19, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
const fmt = (iso) => new Date(iso).toLocaleString("it-CH", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Crea il link del giorno per un ospite (copia del giorno, con scadenza) e lo condivide
export default function ShareDaySheet({ weekId, day, date, label, by, onClose }) {
  const dayId = `${weekId}__${day.key}`;
  const [link, setLink] = useState(() => existingLink(dayId));
  const [hours, setHours] = useState(48);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [copied, setCopied] = useState(false);
  const url = link ? dayLink(link.token) : null;
  const text = `💪 Allenamento di ${label}: ${url}`;

  const create = async () => {
    setBusy(true); setErr(null);
    try { setLink(await createDayLink({ weekId, dayKey: day.key, date, label, workouts: day.workouts, by, hours })); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setErr("Copia non riuscita: tieni premuto sul link"); } };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: "Allenamento", text: `💪 Allenamento di ${label}`, url }); else copy(); } catch { /* annullato */ } };
  const revoke = async () => { setBusy(true); await revokeDayLink(dayId, link.token).catch(() => {}); setLink(null); setBusy(false); };

  return createPortal(
    <div role="dialog" aria-label="Condividi giorno" style={{ position: "fixed", inset: 0, zIndex: 66, background: "#0b0b0b", color: "#fff", fontFamily: FONT, overflowY: "auto" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "max(14px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={onClose} aria-label="Chiudi" style={iconBtn}><X size={20} /></button>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: MUTED, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Condividi giorno</div>
            <div style={{ fontSize: 19, fontWeight: 900, textTransform: "capitalize" }}>{label}</div>
          </div>
        </div>
        <div style={{ color: "#ccc", fontSize: 14, lineHeight: 1.55, marginBottom: 16 }}>
          Chi riceve il link vede <b style={{ color: "#fff" }}>solo gli esercizi di questo giorno</b>, con durata e timer. Niente classifica, bacheca, nomi o altri giorni, e non può entrare nell'app.
        </div>
        {!link ? <>
          <div style={{ color: MUTED, fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Il link scade dopo</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {[[24, "24 ore"], [48, "48 ore"], [168, "7 giorni"]].map(([h, l]) => <button key={h} onClick={() => setHours(h)} style={{ ...pill, flex: 1, padding: "9px 8px", ...(hours === h ? pillOn : {}) }}>{l}</button>)}
          </div>
          {err && <div style={{ color: RED, fontSize: 13, marginBottom: 10 }}>{err}</div>}
          <button onClick={create} disabled={busy} style={{ ...btnGreen, width: "100%", justifyContent: "center", padding: 15, fontSize: 16, borderRadius: 14 }}>{busy ? <Loader2 size={17} className="spin" /> : <Link2 size={17} />} Crea il link</button>
        </> : <>
          <div style={{ background: "#141414", border: `1px solid rgba(184,255,44,0.4)`, borderRadius: 14, padding: 12, marginBottom: 6, wordBreak: "break-all", fontSize: 13.5, color: GREEN, userSelect: "all" }}>{url}</div>
          <div style={{ color: MUTED, fontSize: 12.5, marginBottom: 14 }}>Valido fino a {fmt(link.expires)}</div>
          <button onClick={share} style={{ ...btnGreen, width: "100%", justifyContent: "center", padding: 15, fontSize: 16, borderRadius: 14 }}><Share2 size={17} /> Condividi</button>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" style={{ ...pill, flex: 1, padding: "11px 8px", borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "none" }}><Send size={15} /> WhatsApp</a>
            <button onClick={copy} style={{ ...pill, flex: 1, padding: "11px 8px", borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copiato" : "Copia"}</button>
          </div>
          {err && <div style={{ color: RED, fontSize: 13, marginTop: 10 }}>{err}</div>}
          <button onClick={revoke} disabled={busy} style={{ background: "none", border: "none", color: "#ff8a8a", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 18, display: "inline-flex", alignItems: "center", gap: 6 }}><Ban size={14} /> Disattiva il link</button>
        </>}
      </div>
    </div>,
    document.body
  );
}
