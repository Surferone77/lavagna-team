import { useEffect, useRef, useState } from "react";
import { Send, Paperclip, X, FileText, Download, Loader2, Reply, Eye, MoreHorizontal, Pencil, Trash2, Check, Ban } from "lucide-react";
import FileViewer from "./FileViewer";
import { notify } from "../lib/push";
import { supabase } from "../supabaseClient";
import { ACCEPT, ATTACH_BUCKET, checkFile, uploadAttachment, attachmentUrl, downloadFile, fmtBytes, isImageFile } from "../lib/files";
import { GREEN, CARD, LINE, MUTED, RED, BG, inp, btnGreen, btnGhost } from "../lib/theme";

// Bacheca del team: messaggi in tempo reale (tabella "comunicazioni") con allegati fino a 5 MB.
export default function Bacheca({ name }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);   // messaggio che sto modificando
  const [menu, setMenu] = useState(null);         // id del messaggio con il menu aperto
  const [confirmDel, setConfirmDel] = useState(null);
  const textRef = useRef(null);
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

  // Modifica: il testo nuovo sostituisce il vecchio, con la scritta "modificato"
  const startEdit = (m) => { setMenu(null); setReplyTo(null); setFile(null); setEditing(m); setText(m.messaggio || ""); setTimeout(() => textRef.current?.focus(), 50); };
  const cancelEdit = () => { setEditing(null); setText(""); };
  const saveEdit = async () => {
    const msg = text.trim();
    if (!msg && !editing.allegato_path) { setErr("Il messaggio non può restare vuoto: per toglierlo usa Elimina."); return; }
    if (msg === (editing.messaggio || "")) { cancelEdit(); return; }
    setSending(true); setErr(null);
    const { error } = await supabase.from("comunicazioni").update({ messaggio: msg, modificato_at: new Date().toISOString() }).eq("id", editing.id).eq("utente", name);
    setSending(false);
    if (error) { setErr("Modifica non salvata."); return; }
    // anche le citazioni nelle risposte mostrano il testo nuovo
    await supabase.from("comunicazioni").update({ reply_testo: msg.slice(0, 200) || previewText(editing) }).eq("reply_to", editing.id);
    cancelEdit(); load();
  };
  // Elimina: resta un segnaposto "Messaggio eliminato", l'allegato viene cancellato
  const remove = async (m) => {
    setConfirmDel(null); setMenu(null);
    const { error } = await supabase.from("comunicazioni").update({ eliminato: true, messaggio: "", allegato_path: null, allegato_nome: null, allegato_tipo: null, allegato_bytes: null, modificato_at: new Date().toISOString() }).eq("id", m.id).eq("utente", name);
    if (error) { setErr("Messaggio non eliminato."); return; }
    if (m.allegato_path) supabase.storage.from(ATTACH_BUCKET).remove([m.allegato_path]).catch(() => {});
    await supabase.from("comunicazioni").update({ reply_testo: "Messaggio eliminato" }).eq("reply_to", m.id);
    if (editing?.id === m.id) cancelEdit();
    load();
  };

  const send = async () => {
    if (editing) return saveEdit();
    const msg = text.trim();
    if (!msg && !file) return;
    setSending(true); setErr(null);
    try {
      const extra = file ? await uploadAttachment(file) : {};
      const reply = replyTo ? { reply_to: replyTo.id, reply_utente: replyTo.utente, reply_testo: previewText(replyTo).slice(0, 200) } : {};
      const { error } = await supabase.from("comunicazioni").insert({ utente: name, messaggio: msg, ...extra, ...reply });
      if (error) throw new Error("Messaggio non inviato.");
      notify("bacheca", `💬 ${name}`, msg ? msg.slice(0, 140) : `📎 ${file?.name || "allegato"}`, "/?tab=bacheca", name);
      setText(""); setFile(null); setReplyTo(null); load();
    } catch (e) {
      setErr(e.message || "Messaggio non inviato.");
    } finally { setSending(false); }
  };

  return (
    <div style={{ paddingBottom: `calc(${84 + (file ? 56 : 0) + (replyTo || editing ? 56 : 0)}px + env(safe-area-inset-bottom))` }}>
      <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "20px 0 14px" }}>Bacheca</h1>
      {loading && <div style={{ color: MUTED }}>Carico…</div>}
      {!loading && !err && messages.length === 0 && <div style={{ color: MUTED }}>Nessun messaggio. Scrivi il primo.</div>}
      {messages.map(m => {
        const mine = m.utente === name;
        const gone = m.eliminato;
        const time = new Date(m.created_at).toLocaleString("it-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        if (gone) return (
          <div key={m.id} id={`msg-${m.id}`} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", margin: "0 0 6px" }}>
            <div style={{ maxWidth: "82%", border: `1px dashed #3a3a3a`, borderRadius: 14, padding: "7px 12px", color: MUTED, fontSize: 13.5, fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
              <Ban size={14} /> {mine ? "Hai eliminato questo messaggio" : `${m.utente} ha eliminato un messaggio`} <span style={{ fontStyle: "normal", fontSize: 10.5, marginLeft: 4 }}>{time}</span>
            </div>
          </div>
        );
        const isEditing = editing?.id === m.id;
        return (
          <SwipeRow key={m.id} id={`msg-${m.id}`} mine={mine} onReply={() => { setReplyTo(m); textRef.current?.focus(); }} onLongPress={mine ? () => { setMenu(m.id); setConfirmDel(null); } : null}>
            <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
            <div style={{ background: mine ? "rgba(184,255,44,0.12)" : CARD, border: `1px solid ${isEditing ? GREEN : mine ? "rgba(184,255,44,0.4)" : LINE}`, borderRadius: 14, padding: "8px 12px", transition: "box-shadow .3s" }}>
              {!mine && <div style={{ color: GREEN, fontSize: 12, fontWeight: 700 }}>{m.utente}</div>}
              {m.reply_to && <Quote author={m.reply_utente} text={m.reply_testo} onClick={() => jumpTo(m.reply_to)} />}
              {m.allegato_path && <Attachment m={m} />}
              {m.messaggio && <div style={{ color: "#eee", fontSize: 14.5, whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: m.allegato_path ? 6 : 0 }}>{m.messaggio}</div>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, marginTop: 3 }}>
                {canHover && <button onClick={() => { setReplyTo(m); textRef.current?.focus(); }} aria-label="Rispondi" style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", padding: 0, display: "inline-flex" }}><Reply size={13} /></button>}
                {m.modificato_at && <span style={{ color: MUTED, fontSize: 10.5, fontStyle: "italic" }}>modificato</span>}
                <span style={{ color: MUTED, fontSize: 10.5 }}>{time}</span>
                {mine && <button onClick={() => { setMenu(menu === m.id ? null : m.id); setConfirmDel(null); }} aria-label="Opzioni messaggio" aria-expanded={menu === m.id}
                  style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", padding: "0 0 0 2px", display: "inline-flex" }}><MoreHorizontal size={16} /></button>}
              </div>
            </div>
            {mine && menu === m.id && (
              <div className="fade" style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {confirmDel === m.id ? <>
                  <span style={{ color: "#ddd", fontSize: 13, alignSelf: "center" }}>Eliminare per tutti?</span>
                  <button onClick={() => remove(m)} style={{ ...menuBtn, background: "#3a1414", color: "#ff8a8a", borderColor: "#5a2222" }}><Trash2 size={14} /> Elimina</button>
                  <button onClick={() => setConfirmDel(null)} style={menuBtn}>Annulla</button>
                </> : <>
                  <button onClick={() => startEdit(m)} style={menuBtn}><Pencil size={14} /> Modifica</button>
                  <button onClick={() => setConfirmDel(m.id)} style={{ ...menuBtn, color: "#ff8a8a" }}><Trash2 size={14} /> Elimina</button>
                  <button onClick={() => setMenu(null)} aria-label="Chiudi menu" style={{ ...menuBtn, padding: "6px 8px" }}><X size={14} /></button>
                </>}
              </div>
            )}
            </div>
          </SwipeRow>
        );
      })}
      <div ref={endRef} />

      <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(64px + env(safe-area-inset-bottom))", zIndex: 11, background: BG, borderTop: `1px solid ${LINE}`, padding: "10px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          {err && <div style={{ color: RED, fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
          {editing && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}><Quote author="" text={previewText(editing)} label="Modifica messaggio" /></div>
              <button onClick={cancelEdit} aria-label="Annulla modifica" style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", padding: 4 }}><X size={16} /></button>
            </div>
          )}
          {replyTo && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}><Quote author={replyTo.utente} text={previewText(replyTo)} label="Rispondi a" /></div>
              <button onClick={() => setReplyTo(null)} aria-label="Annulla risposta" style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", padding: 4 }}><X size={16} /></button>
            </div>
          )}
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
            {!editing && <button onClick={() => fileRef.current?.click()} aria-label="Allega file" style={{ ...btnGhost, padding: "0 12px" }}><Paperclip size={18} /></button>}
            <input ref={textRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && !sending && send()} placeholder={editing ? "Modifica il messaggio…" : "Scrivi al team…"} style={{ ...inp, flex: 1, minWidth: 0 }} />
            <button onClick={send} disabled={sending} style={{ ...btnGreen, opacity: sending ? 0.6 : 1 }} aria-label={editing ? "Salva modifica" : "Invia"}>
              {sending ? <Loader2 size={16} className="spin" /> : editing ? <Check size={16} /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const menuBtn = { display: "inline-flex", alignItems: "center", gap: 5, background: "#1c1c1c", border: `1px solid ${LINE}`, color: "#eee", borderRadius: 10, padding: "6px 11px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const canHover = typeof window !== "undefined" && window.matchMedia?.("(hover: hover)").matches;
const previewText = (m) => m.messaggio || (m.allegato_nome ? `📎 ${m.allegato_nome}` : "");

// Porta alla vista il messaggio citato e lo evidenzia per un attimo
function jumpTo(id) {
  const el = document.getElementById(`msg-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const bubble = el.lastElementChild?.firstElementChild;
  if (!bubble) return;
  bubble.style.boxShadow = "0 0 0 2px #B8FF2C";
  setTimeout(() => { bubble.style.boxShadow = "none"; }, 1200);
}

function Quote({ author, text, onClick, label }) {
  return (
    <div onClick={onClick} style={{ borderLeft: `3px solid ${GREEN}`, background: "rgba(0,0,0,0.28)", borderRadius: 8, padding: "5px 9px", margin: "4px 0 6px", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ color: GREEN, fontSize: 11.5, fontWeight: 800 }}>{label ? `${label} ${author}` : author}</div>
      <div style={{ color: "#bdbdbd", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</div>
    </div>
  );
}

// Scorri il messaggio verso destra per rispondere (come su WhatsApp)
function SwipeRow({ id, mine, onReply, onLongPress, children }) {
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  const press = useRef(null);
  const TRIGGER = 60;
  const clearPress = () => { clearTimeout(press.current); press.current = null; };
  const onStart = (e) => {
    const t = e.touches[0]; start.current = { x: t.clientX, y: t.clientY, lock: null, dx: 0 };
    // tieni premuto mezzo secondo sul tuo messaggio per modificarlo o eliminarlo
    if (onLongPress && !e.target.closest("button,a,img")) press.current = setTimeout(() => { navigator.vibrate?.(15); onLongPress(); press.current = null; if (start.current) start.current.lock = "press"; }, 500);
  };
  const onMove = (e) => {
    const s = start.current; if (!s) return;
    const t = e.touches[0]; const mx = t.clientX - s.x, my = t.clientY - s.y;
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) clearPress();
    if (s.lock === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) s.lock = Math.abs(mx) > Math.abs(my) ? "x" : "y";
    if (s.lock !== "x") return;
    const v = Math.max(0, Math.min(mx, 90));
    if (v >= TRIGGER && s.dx < TRIGGER) navigator.vibrate?.(10);
    s.dx = v; setDx(v);
  };
  // uso il valore nel ref: lo stato potrebbe non essere ancora aggiornato
  const onEnd = () => { clearPress(); if ((start.current?.dx || 0) >= TRIGGER) onReply(); setDx(0); start.current = null; };
  return (
    <div id={id} onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}
      style={{ position: "relative", display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8, touchAction: "pan-y", overflow: "hidden", padding: 2, margin: "0 -2px 6px" }}>
      <div style={{ position: "absolute", left: 4, top: "50%", transform: `translateY(-50%) scale(${Math.min(1, dx / TRIGGER)})`, opacity: Math.min(1, dx / TRIGGER), color: GREEN, width: 30, height: 30, borderRadius: 15, background: "rgba(184,255,44,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Reply size={16} />
      </div>
      <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", width: "100%", transform: `translateX(${dx}px)`, transition: dx === 0 ? "transform .2s" : "none" }}>
        {children}
      </div>
    </div>
  );
}

function Attachment({ m }) {
  const [busy, setBusy] = useState(false);
  const url = attachmentUrl(m.allegato_path);
  const isImg = (m.allegato_tipo || "").startsWith("image/");
  const isPdf = /pdf/i.test(m.allegato_tipo || "") || /\.pdf$/i.test(m.allegato_nome || "");
  const [view, setView] = useState(false);
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
      <button onClick={() => setView(true)} aria-label={`Apri ${m.allegato_nome}`} style={{ display: "block", padding: 0, border: "none", background: "none", cursor: "zoom-in" }}>
        <img src={url} alt={m.allegato_nome} loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 260, borderRadius: 10 }} />
      </button>
      {view && <FileViewer url={url} name={m.allegato_nome} type={m.allegato_tipo} onClose={() => setView(false)} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
        <span style={{ color: MUTED, fontSize: 11.5 }}>{fmtBytes(m.allegato_bytes || 0)}</span>{dlBtn}
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(0,0,0,0.25)", borderRadius: 10, padding: "8px 10px", marginTop: 4, minWidth: 200 }}>
      <FileText size={24} color={GREEN} style={{ flexShrink: 0 }} />
      <div onClick={isPdf ? () => setView(true) : undefined} style={{ flex: 1, minWidth: 0, cursor: isPdf ? "pointer" : "default" }}>
        <div style={{ color: "#fff", fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.allegato_nome}</div>
        <div style={{ color: MUTED, fontSize: 11.5 }}>{fmtBytes(m.allegato_bytes || 0)}</div>
      </div>
      {isPdf && <button onClick={() => setView(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: 10, padding: "7px 12px", fontWeight: 800, fontSize: 12.5, cursor: "pointer", flexShrink: 0 }}><Eye size={14} /> Apri</button>}
      {dlBtn}
      {view && <FileViewer url={url} name={m.allegato_nome} type={m.allegato_tipo} onClose={() => setView(false)} />}
    </div>
  );
}
