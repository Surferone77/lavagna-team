import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ImagePlus, Images, Download, Trash2, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { listPhotos, uploadPhoto, deletePhoto, downloadPhoto, publicUrl, safeName, PHOTO_LIMITS } from "../lib/photos";
import { mapLimit } from "../lib/images";
import { GREEN, LINE, MUTED, RED, FONT, btnGhost } from "../lib/theme";

// Foto di un workout: miniature, aggiunta, visore a schermo intero con Scarica.
export default function PhotoStrip({ w, name, date }) {
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(null); // "3/5" durante l'upload
  const [err, setErr] = useState(null);
  const [open, setOpen] = useState(null); // indice foto aperta
  const fileRef = useRef(null);
  const [weekId, dayKey] = w.id.split("__");

  const load = () => listPhotos(w.id).then(setPhotos).catch(() => setErr("Foto non disponibili: esegui il setup SQL."));
  useEffect(() => { load(); }, [w.id]);

  const add = async (files) => {
    const list = Array.from(files || []).filter(f => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)).slice(0, PHOTO_LIMITS.maxPerUpload);
    if (!list.length) return;
    setErr(null);
    let done = 0;
    setBusy(`0/${list.length}`);
    const res = await mapLimit(list, 2, async (f) => {
      try { const p = await uploadPhoto({ file: f, workoutId: w.id, weekId, dayKey, athlete: name }); return p; }
      catch (e) { return { error: e.message }; }
      finally { done++; setBusy(`${done}/${list.length}`); }
    });
    const failed = res.filter(r => r.error);
    if (failed.length) setErr(`${failed.length} foto non caricate: ${failed[0].error}`);
    setBusy(null);
    load();
  };

  const fileName = (i) => `TheHybridOne_${date || weekId}_${safeName(w.title)}_${i + 1}.jpg`;

  return (
    <div style={{ marginTop: 14 }}>
      <input ref={fileRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={e => { add(e.target.files); e.target.value = ""; }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: photos.length ? 8 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
          <Images size={13} color={GREEN} /> Foto {photos.length > 0 && `(${photos.length})`}
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={!!busy} style={{ ...btnGhost, padding: "6px 10px", fontSize: 12.5, opacity: busy ? 0.6 : 1 }}>
          {busy ? <><Loader2 size={13} className="spin" /> {busy}</> : <><ImagePlus size={14} /> Aggiungi</>}
        </button>
      </div>
      {photos.length > 0 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {photos.map((p, i) => (
            <button key={p.id} onClick={() => setOpen(i)} aria-label={`Apri foto ${i + 1}`} style={{ flexShrink: 0, width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: `1px solid ${LINE}`, padding: 0, background: "#111", cursor: "pointer" }}>
              <img src={publicUrl(p.thumb_path)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </button>
          ))}
        </div>
      )}
      {err && <div style={{ color: RED, fontSize: 12, marginTop: 6 }}>{err}</div>}
      {/* portale su <body>: le card animate creerebbero un contenitore per position:fixed */}
      {open !== null && photos[open] && createPortal(
        <Viewer photos={photos} index={open} setIndex={setOpen} name={name} fileName={fileName}
          onDelete={async (p) => { await deletePhoto(p).catch(() => {}); setOpen(null); load(); }} />, document.body)}
    </div>
  );
}

function Viewer({ photos, index, setIndex, name, fileName, onDelete }) {
  const p = photos[index];
  const [dl, setDl] = useState(false);
  const go = (d) => setIndex((index + d + photos.length) % photos.length);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") setIndex(null); if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });
  const round = { background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", width: 42, height: 42, borderRadius: 21, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
  return (
    <div role="dialog" aria-label="Foto" style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.97)", display: "flex", flexDirection: "column", fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "max(12px, env(safe-area-inset-top)) 14px 10px" }}>
        <div style={{ flex: 1, minWidth: 0, color: "#fff", fontSize: 14 }}>
          <b>{p.athlete}</b> <span style={{ color: MUTED }}>· {new Date(p.created_at).toLocaleDateString("it-CH")} · {index + 1}/{photos.length}</span>
        </div>
        <button onClick={() => setIndex(null)} style={round} aria-label="Chiudi"><X size={20} /></button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <img src={publicUrl(p.path)} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        {photos.length > 1 && <>
          <button onClick={() => go(-1)} style={{ ...round, position: "absolute", left: 10 }} aria-label="Precedente"><ChevronLeft size={22} /></button>
          <button onClick={() => go(1)} style={{ ...round, position: "absolute", right: 10 }} aria-label="Successiva"><ChevronRight size={22} /></button>
        </>}
      </div>
      <div style={{ display: "flex", gap: 10, padding: "12px 14px max(14px, env(safe-area-inset-bottom))", justifyContent: "center" }}>
        <button onClick={async () => { setDl(true); try { await downloadPhoto(p, fileName(index)); } finally { setDl(false); } }}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: GREEN, color: "#0b0b0b", border: "none", borderRadius: 14, padding: "13px 22px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
          {dl ? <Loader2 size={18} className="spin" /> : <Download size={18} />} Scarica
        </button>
        {p.athlete === name && (
          <button onClick={() => { if (confirm("Eliminare questa foto per tutti?")) onDelete(p); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,107,107,0.12)", color: RED, border: `1px solid rgba(255,107,107,0.35)`, borderRadius: 14, padding: "13px 18px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            <Trash2 size={17} /> Elimina
          </button>
        )}
      </div>
    </div>
  );
}
