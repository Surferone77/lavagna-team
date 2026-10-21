import { useEffect, useRef, useState } from "react";
import { Send, Paperclip, X, FileText, Download, Loader2 } from "lucide-react";
import { supabase } from "../supabaseClient";
import { ACCEPT, checkFile, uploadAttachment, attachmentUrl, downloadFile, fmtBytes, isImageFile } from "../lib/files";
import { GREEN, CARD, LINE, MUTED, RED, BG, inp, btnGreen, btnGhost } from "../lib/theme";

// Bacheca del team: messaggi in tempo reale (tabella "comunicazioni") con allegati fino a 5 MB.
export default function Bacheca({ name }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);
  const fileRef = useRef(null);

  const load = async () => {
    const { data, error } = await supabase.from("comunicazioni").select("*").order("created_at", { ascending: true }).limit(200);
    if (error) setErr("Bacheca non disponibile: esegui la migrazione SQL (vedi README).");
    else { setErr(null); setMessages(data || []); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("bacheca-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "comunicazioni" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  const pick = (f) => {
    if (!f) return;
    const e = checkFile(f);
    if (e) { setErr(e); return; }
    setErr(null); setFile(f);
  };

  const send = async () => {
    const msg = text.trim();
    if (!msg && !file) return;
    setSending(true); setErr(null);
    try {
      const extra = file ? await uploadAttachment(file) : {};
      const { error } = await supabase.from("comunicazioni").insert({ utente: name, messaggio: msg, ...extra });
      if (error) throw new Error("Messaggio non inviato.");
      setText(""); setFile(null); load();
    } catch (e) {
      setErr(e.message || "Messaggio non inviato.");
    } finally { setSending(false); }
  };

  return (
    <div style={{ paddingBottom: `calc(${file ? 140 : 84}px + env(safe-area-inset-bottom))` }}>
      <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "20px 0 14px" }}>Bacheca</h1>
      {loading && <div style={{ color: MUTED }}>Carico…</div>}
      {!loading && !err && messages.length === 0 && <div style={{ color: MUTED }}>Nessun messaggio. Scrivi il primo.</div>}
      {messages.map(m => {
        const mine = m.utente === name;
        return (
          <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div style={{ maxWidth: "82%", background: mine ? "rgba(184,255,44,0.12)" : CARD, border: `1px solid ${mine ? "rgba(184,255,44,0.4)" : LINE}`, borderRadius: 14, padding: "8px 12px" }}>
              {!mine && <div style={{ color: GREEN, fontSize: 12, fontWeight: 700 }}>{m.utente}</div>}
              {m.allegato_path && <Attachment m={m} />}
              {m.messaggio && <div style={{ color: "#eee", fontSize: 14.5, whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: m.allegato_path ? 6 : 0 }}>{m.messaggio}</div>}
              <div style={{ color: MUTED, fontSize: 10.5, marginTop: 3, textAlign: "right" }}>{new Date(m.created_at).toLocaleString("it-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />

      <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(64px + env(safe-area-inset-bottom))", zIndex: 11, background: BG, borderTop: `1px solid ${LINE}`, padding: "10px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          {err && <div style={{ color: RED, fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
          {file && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: "8px 10px", marginBottom: 8 }}>
              {isImageFile(file) ? <img src={URL.createObjectURL(file)} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} /> : <FileText size={22} color={GREEN} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</div>
                <div style={{ color: MUTED, fontSize: 11.5 }}>{isImageFile(file) ? "Foto · verrà ottimizzata" : fmtBytes(file.size)}</div>
              </div>
              <button onClick={() => setFile(null)} aria-label="Togli allegato" style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", padding: 4 }}><X size={16} /></button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            <button onClick={() => fileRef.current?.click()} aria-label="Allega file" style={{ ...btnGhost, padding: "0 12px" }}><Paperclip size={18} /></button>
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && !sending && send()} placeholder="Scrivi al team…" style={{ ...inp, flex: 1, minWidth: 0 }} />
            <button onClick={send} disabled={sending} style={{ ...btnGreen, opacity: sending ? 0.6 : 1 }} aria-label="Invia">
              {sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Attachment({ m }) {
  const [busy, setBusy] = useState(false);
  const url = attachmentUrl(m.allegato_path);
  const isImg = (m.allegato_tipo || "").startsWith("image/");
  const save = async () => {
    setBusy(true);
    try { await downloadFile(url, m.allegato_nome, m.allegato_tipo); } catch { window.open(url, "_blank"); }
    finally { setBusy(false); }
  };
  const dlBtn = (
    <button onClick={save} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: GREEN, color: "#0b0b0b", border: "none", borderRadius: 10, padding: "7px 12px", fontWeight: 800, fontSize: 12.5, cursor: "pointer", flexShrink: 0 }}>
      {busy ? <Loader2 size={14} className="spin" /> : <Download size={14} />} Salva
    </button>
  );
  if (isImg) return (
    <div style={{ marginTop: 4 }}>
      <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={m.allegato_nome} loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 260, borderRadius: 10 }} /></a>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
        <span style={{ color: MUTED, fontSize: 11.5 }}>{fmtBytes(m.allegato_bytes || 0)}</span>{dlBtn}
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "8px 10px", marginTop: 4, minWidth: 200 }}>
      <FileText size={24} color={GREEN} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.allegato_nome}</div>
        <div style={{ color: MUTED, fontSize: 11.5 }}>{fmtBytes(m.allegato_bytes || 0)}</div>
      </div>
      {dlBtn}
    </div>
  );
}
