import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Share2, Copy, Download, Check, Loader2 } from "lucide-react";
import { buildLines, renderShare, toBlob, slug } from "../lib/shareImage";
import { GREEN, LINE, MUTED, RED, FONT, inp, pill, pillOn, btnGreen } from "../lib/theme";

const iconBtn = { background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", width: 38, height: 38, borderRadius: 19, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
const CHECKER = "repeating-conic-gradient(#3a3a3a 0% 25%, #262626 0% 50%) 50% / 22px 22px";

// Condividi un blocco: PNG trasparente (adesivo per storie/foto) o storia 9:16, solo testo
export default function ShareSheet({ w, scoreText, onClose }) {
  const [mode, setMode] = useState("png");
  const [color, setColor] = useState("light");
  const [opt, setOpt] = useState({ title: true, tag: true, score: !!scoreText });
  const [extra, setExtra] = useState("");
  const [url, setUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const lines = useMemo(() => buildLines(w, { ...opt, scoreText, extra }), [w, opt, scoreText, extra]);
  useEffect(() => {
    let alive = true, u = null;
    const t = setTimeout(async () => {
      const b = await toBlob(renderShare(lines, { mode, color }));
      if (!alive || !b) return;
      u = URL.createObjectURL(b); setBlob(b); setUrl(old => { if (old) URL.revokeObjectURL(old); return u; });
    }, 120);
    return () => { alive = false; clearTimeout(t); };
  }, [lines, mode, color]);

  const file = () => new File([blob], `${slug(w.title)}-${mode === "png" ? "trasparente" : "storia"}.png`, { type: "image/png" });
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(m => m === t ? null : m), 2500); };
  const share = async () => {
    if (!blob) return; setBusy("share");
    try {
      const f = file();
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f] });
      else { save(); flash("Condivisione non disponibile qui: immagine salvata"); }
    } catch (e) { if (e?.name !== "AbortError") flash("Condivisione non riuscita"); }
    setBusy(null);
  };
  const copy = async () => {
    if (!blob) return; setBusy("copy");
    try { await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); flash("Copiata! Ora incollala nella storia di Instagram"); }
    catch { flash("Copia non supportata su questo dispositivo: usa Salva"); }
    setBusy(null);
  };
  const save = () => {
    if (!blob) return;
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file().name;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const tog = (k) => setOpt(o => ({ ...o, [k]: !o[k] }));

  return createPortal(
    <div role="dialog" aria-label={`Condividi ${w.title}`} style={{ position: "fixed", inset: 0, zIndex: 66, background: "#0b0b0b", color: "#fff", fontFamily: FONT, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "max(14px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button onClick={onClose} aria-label="Chiudi" style={iconBtn}><X size={20} /></button>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: MUTED, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Condividi</div>
            <div style={{ fontSize: 19, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[["png", "PNG trasparente"], ["story", "Storia 9:16"]].map(([k, l]) => <button key={k} onClick={() => setMode(k)} style={{ ...pill, flex: 1, padding: "9px 10px", fontSize: 14, ...(mode === k ? pillOn : {}) }}>{l}</button>)}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <span style={{ color: MUTED, fontSize: 12.5 }}>{mode === "png" ? "Testo" : "Colori"}</span>
          {[["light", mode === "png" ? "Bianco" : "Bianco su nero"], ["dark", mode === "png" ? "Nero" : "Nero su bianco"]].map(([k, l]) => <button key={k} onClick={() => setColor(k)} style={{ ...pill, padding: "5px 11px", ...(color === k ? pillOn : {}) }}>{l}</button>)}
        </div>

        {/* anteprima: la trasparenza si vede sulla scacchiera */}
        <div style={{ borderRadius: 16, border: `1px solid ${LINE}`, background: mode === "png" ? CHECKER : "#151515", padding: mode === "png" ? 10 : 14, display: "flex", justifyContent: "center", marginBottom: 12, minHeight: 160, alignItems: "center" }}>
          {url ? <img src={url} alt="Anteprima" style={{ display: "block", maxWidth: "100%", maxHeight: mode === "story" ? "58vh" : "52vh", borderRadius: mode === "story" ? 10 : 0, boxShadow: mode === "story" ? "0 6px 24px rgba(0,0,0,.5)" : "none" }} /> : <Loader2 size={22} className="spin" color={MUTED} />}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <button onClick={() => tog("title")} style={{ ...pill, ...(opt.title ? pillOn : {}) }}>Titolo</button>
          {w.tag && <button onClick={() => tog("tag")} style={{ ...pill, ...(opt.tag ? pillOn : {}) }}>Formato</button>}
          {scoreText && <button onClick={() => tog("score")} style={{ ...pill, ...(opt.score ? pillOn : {}) }}>Il mio risultato</button>}
        </div>
        <textarea value={extra} onChange={e => setExtra(e.target.value.slice(0, 160))} rows={2} placeholder="Aggiungi una nota (facoltativa), es. Sled pesante oggi 🔥"
          style={{ ...inp, width: "100%", resize: "none", fontFamily: "inherit", marginBottom: 12 }} />

        {msg && <div role="status" style={{ color: /non /i.test(msg) ? RED : GREEN, fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>{msg}</div>}
        <button onClick={share} disabled={!blob || busy} style={{ ...btnGreen, width: "100%", justifyContent: "center", padding: 15, fontSize: 16, borderRadius: 14 }}>
          {busy === "share" ? <Loader2 size={17} className="spin" /> : <Share2 size={17} />} Condividi
        </button>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {mode === "png" && <button onClick={copy} disabled={!blob || busy} style={{ ...pill, flex: 1, padding: "11px 10px", borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{busy === "copy" ? <Check size={15} /> : <Copy size={15} />} Copia</button>}
          <button onClick={save} disabled={!blob} style={{ ...pill, flex: 1, padding: "11px 10px", borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Download size={15} /> Salva</button>
        </div>
        {mode === "png" && <div style={{ color: MUTED, fontSize: 12.5, lineHeight: 1.5, marginTop: 12 }}>
          Per Instagram: tocca <b style={{ color: "#ddd" }}>Copia</b>, apri la storia con la tua foto o video, tieni premuto sullo schermo e scegli <b style={{ color: "#ddd" }}>Incolla</b>: il testo diventa un adesivo trasparente da spostare e ingrandire.
        </div>}
      </div>
    </div>,
    document.body
  );
}
