import { useEffect, useState } from "react";
import { StickyNote, Send, Trash2, Loader2 } from "lucide-react";
import { supabase } from "../supabaseClient";
import { GREEN, LINE, MUTED, RED, inp, btnGreen } from "../lib/theme";

// Note del team su un blocco di allenamento (carichi usati, scaling, sensazioni…).
export default function NotesSection({ w, name }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const load = async () => {
    const { data, error } = await supabase.from("workout_notes").select("*").eq("workout_id", w.id).order("created_at", { ascending: true });
    if (error) setErr("Note non disponibili: esegui il setup SQL.");
    else { setErr(null); setNotes(data || []); }
  };
  useEffect(() => { load(); }, [w.id]);

  const add = async () => {
    const t = text.trim(); if (!t) return;
    setBusy(true);
    const { error } = await supabase.from("workout_notes").insert({ workout_id: w.id, athlete: name, testo: t.slice(0, 1000) });
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
                <span style={{ color: MUTED }}> · {new Date(n.created_at).toLocaleString("it-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div style={{ color: "#e4e4e4", fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 2 }}>{n.testo}</div>
            </div>
            {mine && <button onClick={() => remove(n)} aria-label="Elimina nota" style={{ background: "none", border: "none", color: "#777", cursor: "pointer", padding: 2 }}><Trash2 size={14} /></button>}
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 6 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && !busy && add()}
          placeholder="Aggiungi una nota…" maxLength={1000}
          style={{ ...inp, flex: 1, minWidth: 0, padding: "9px 12px", fontSize: 15 }} />
        <button onClick={add} disabled={busy || !text.trim()} aria-label="Salva nota" style={{ ...btnGreen, padding: "0 12px", opacity: busy || !text.trim() ? 0.5 : 1 }}>
          {busy ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
        </button>
      </div>
      {err && <div style={{ color: RED, fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}
