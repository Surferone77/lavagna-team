import { useEffect, useState } from "react";
import { StickyNote, Send, Trash2, Loader2, Lock, Users } from "lucide-react";
import { supabase } from "../supabaseClient";
import { GREEN, LINE, MUTED, RED, inp, btnGreen } from "../lib/theme";

// Note del team su un blocco di allenamento (carichi usati, scaling, sensazioni…).
export default function NotesSection({ w, name }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [priv, setPriv] = useState(false);
  const [err, setErr] = useState(null);

  const load = async () => {
    const { data, error } = await supabase.from("workout_notes").select("*").eq("workout_id", w.id).order("created_at", { ascending: true });
    if (error) setErr("Note non disponibili: esegui il setup SQL.");
    // le note private si vedono solo da chi le ha scritte
    else { setErr(null); setNotes((data || []).filter(n => !n.privata || n.athlete === name)); }
  };
  useEffect(() => { load(); }, [w.id]);

  const add = async () => {
    const t = text.trim(); if (!t) return;
    setBusy(true);
    const { error } = await supabase.from("workout_notes").insert({ workout_id: w.id, athlete: name, testo: t.slice(0, 1000), privata: priv });
    setBusy(false);
    if (error) { setErr("Nota non salvata."); return; }
    setText(""); load();
  };
  const remove = async (n) => {
    const { error } = await supabase.from("workout_notes").delete().eq("id", n.id);
    if (!error) setNotes(l => l.filter(x => x.id !== n.id));
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
        <StickyNote size={13} color={GREEN} /> Note {notes.length > 0 && `(${notes.length})`}
      </div>
      {notes.map(n => {
        const mine = n.athlete === name;
        return (
          <div key={n.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: mine ? "rgba(184,255,44,0.07)" : "#1c1c1c", border: `1px solid ${mine ? "rgba(184,255,44,0.25)" : LINE}`, borderRadius: 10, padding: "7px 10px", marginBottom: 6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12 }}>
                <b style={{ color: mine ? GREEN : "#fff" }}>{n.athlete}</b>
                {n.privata && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#f0b84a", fontSize: 10.5, fontWeight: 800, marginLeft: 6 }}><Lock size={10} /> SOLO PER TE</span>}
                <span style={{ color: MUTED }}> · {new Date(n.created_at).toLocaleString("it-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div style={{ color: "#e4e4e4", fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 2 }}>{n.testo}</div>
            </div>
            {mine && <button onClick={() => remove(n)} aria-label="Elimina nota" style={{ background: "none", border: "none", color: "#777", cursor: "pointer", padding: 2 }}><Trash2 size={14} /></button>}
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => setPriv(p => !p)} aria-label={priv ? "Nota privata: tocca per renderla del team" : "Nota del team: tocca per renderla privata"} title={priv ? "Solo per me" : "Visibile al team"}
          style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, background: priv ? "rgba(240,184,74,0.12)" : "#1c1c1c", color: priv ? "#f0b84a" : MUTED, border: `1px solid ${priv ? "rgba(240,184,74,0.45)" : LINE}`, borderRadius: 12, padding: "0 10px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
          {priv ? <><Lock size={14} /> Solo io</> : <><Users size={14} /> Team</>}
        </button>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && !busy && add()}
          placeholder={priv ? "Nota privata…" : "Nota per il team…"} maxLength={1000}
          style={{ ...inp, flex: 1, minWidth: 0, padding: "9px 12px", fontSize: 15 }} />
        <button onClick={add} disabled={busy || !text.trim()} aria-label="Salva nota" style={{ ...btnGreen, padding: "0 12px", opacity: busy || !text.trim() ? 0.5 : 1 }}>
          {busy ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
        </button>
      </div>
      {err && <div style={{ color: RED, fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
