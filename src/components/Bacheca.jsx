import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "../supabaseClient";
import { GREEN, CARD, LINE, MUTED, RED, BG, inp, btnGreen } from "../lib/theme";

// Bacheca del team: messaggi in tempo reale (tabella "comunicazioni").
export default function Bacheca({ name }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);

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

  const send = async () => {
    const msg = text.trim(); if (!msg) return;
    setText("");
    const { error } = await supabase.from("comunicazioni").insert({ utente: name, messaggio: msg });
    if (error) { setErr("Messaggio non inviato."); setText(msg); } else load();
  };

  return (
    <div style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}>
      <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "20px 0 14px" }}>Bacheca</h1>
      {loading && <div style={{ color: MUTED }}>Carico…</div>}
      {err && <div style={{ color: RED, fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {!loading && !err && messages.length === 0 && <div style={{ color: MUTED }}>Nessun messaggio. Scrivi il primo.</div>}
      {messages.map(m => {
        const mine = m.utente === name;
        return (
          <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div style={{ maxWidth: "82%", background: mine ? "rgba(184,255,44,0.12)" : CARD, border: `1px solid ${mine ? "rgba(184,255,44,0.4)" : LINE}`, borderRadius: 14, padding: "8px 12px" }}>
              {!mine && <div style={{ color: GREEN, fontSize: 12, fontWeight: 700 }}>{m.utente}</div>}
              <div style={{ color: "#eee", fontSize: 14.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.messaggio}</div>
              <div style={{ color: MUTED, fontSize: 10.5, marginTop: 3, textAlign: "right" }}>{new Date(m.created_at).toLocaleString("it-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
      <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(64px + env(safe-area-inset-bottom))", zIndex: 11, background: BG, borderTop: `1px solid ${LINE}`, padding: "10px 16px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", gap: 8 }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Scrivi al team…" style={{ ...inp, flex: 1, minWidth: 0 }} />
          <button onClick={send} style={btnGreen} aria-label="Invia"><Send size={16} /></button>
        </div>
      </div>
    </div>
  );
}
