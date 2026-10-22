import { useEffect, useState } from "react";
import { Bell, BellOff, Share, PlusSquare, Loader2, Check } from "lucide-react";
import { pushStatus, enablePush, disablePush, loadPrefs, savePrefs, PUSH_TYPES, DEFAULT_PREFS, isIOS } from "../lib/push";
import { GREEN, CARD, LINE, MUTED, RED, pill, pillOn, btnGreen } from "../lib/theme";

const box = { background: CARD, border: `1px solid ${LINE}`, borderRadius: 18, padding: 14, marginBottom: 14 };

// Riquadro notifiche: attivazione, istruzioni per iPhone, preferenze per tipo
export default function Notifiche({ name, compact = false, onDismiss }) {
  const [status, setStatus] = useState(null);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const refresh = async () => { const s = await pushStatus().catch(() => "unsupported"); setStatus(s); if (s === "on") { const p = await loadPrefs().catch(() => null); if (p) setPrefs(p.prefs); } };
  useEffect(() => { refresh(); }, []);

  const on = async () => {
    setBusy(true); setErr(null);
    try { await enablePush(name, prefs); await refresh(); } catch (e) { setErr(e.message || "Attivazione non riuscita."); await refresh(); }
    setBusy(false);
  };
  const off = async () => { setBusy(true); await disablePush().catch(() => {}); await refresh(); setBusy(false); };
  const toggle = async (k) => { const p = { ...prefs, [k]: !prefs[k] }; setPrefs(p); await savePrefs(p).catch(() => {}); };

  if (status === null) return null;
  if (compact && (status === "on" || status === "unsupported" || status === "denied")) return null;

  const head = <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontWeight: 800, fontSize: 15.5, marginBottom: 8 }}><Bell size={17} color={GREEN} /> Notifiche</div>;

  if (status === "needs-home") return (
    <div style={box}>
      {head}
      <div style={{ color: "#ccc", fontSize: 13.5, lineHeight: 1.55 }}>
        Su iPhone le notifiche funzionano solo dall'app aggiunta alla schermata Home:
        <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
          <li>in Safari tocca <Share size={13} style={{ verticalAlign: -2 }} /> <b>Condividi</b></li>
          <li>scegli <PlusSquare size={13} style={{ verticalAlign: -2 }} /> <b>Aggiungi alla schermata Home</b></li>
          <li>apri The Hybrid One dall'icona e torna qui</li>
        </ol>
      </div>
      {compact && onDismiss && <button onClick={onDismiss} style={{ ...pill, marginTop: 10 }}>Più tardi</button>}
    </div>
  );
  if (status === "unsupported") return <div style={box}>{head}<div style={{ color: MUTED, fontSize: 13.5 }}>Questo browser non supporta le notifiche.{isIOS() ? " Serve iOS 16.4 o successivo." : ""}</div></div>;
  if (status === "denied") return <div style={box}>{head}<div style={{ color: MUTED, fontSize: 13.5, lineHeight: 1.5 }}>Le notifiche sono bloccate per questa app. Riattivale dalle impostazioni del telefono (Impostazioni → Notifiche → Hybrid One), poi riapri l'app.</div></div>;

  if (status === "off") return (
    <div style={{ ...box, borderColor: compact ? "rgba(184,255,44,0.35)" : LINE }}>
      {head}
      <div style={{ color: "#ccc", fontSize: 13.5, lineHeight: 1.5, marginBottom: 10 }}>Ricevi un avviso quando Giada pubblica la settimana, quando arriva un messaggio in bacheca e quando l'app ha novità.</div>
      {err && <div style={{ color: RED, fontSize: 13, marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={on} disabled={busy} style={{ ...btnGreen, flex: 1, justifyContent: "center" }}>{busy ? <Loader2 size={16} className="spin" /> : <Bell size={16} />} Attiva notifiche</button>
        {compact && onDismiss && <button onClick={onDismiss} style={{ ...pill, padding: "0 14px" }}>Più tardi</button>}
      </div>
    </div>
  );

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {head}
        <span style={{ color: GREEN, fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8 }}><Check size={14} /> Attive</span>
      </div>
      {PUSH_TYPES.map(t => (
        <button key={t.key} onClick={() => toggle(t.key)} aria-pressed={prefs[t.key]} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", borderTop: `1px solid ${LINE}`, padding: "10px 0", cursor: "pointer", textAlign: "left" }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", color: "#fff", fontSize: 14.5, fontWeight: 700 }}>{t.label}</span>
            <span style={{ display: "block", color: MUTED, fontSize: 12 }}>{t.sub}</span>
          </span>
          <span style={{ width: 44, height: 26, borderRadius: 13, background: prefs[t.key] ? GREEN : "#333", position: "relative", flexShrink: 0, transition: "background .2s" }}>
            <span style={{ position: "absolute", top: 3, left: prefs[t.key] ? 21 : 3, width: 20, height: 20, borderRadius: 10, background: prefs[t.key] ? "#0b0b0b" : "#888", transition: "left .2s" }} />
          </span>
        </button>
      ))}
      <button onClick={off} disabled={busy} style={{ ...pill, marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6 }}><BellOff size={14} /> Disattiva su questo telefono</button>
    </div>
  );
}
