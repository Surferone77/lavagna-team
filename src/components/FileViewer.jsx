import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Download, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { downloadFile } from "../lib/files";
import { GREEN, MUTED, RED, FONT } from "../lib/theme";

// pdf.js viene scaricato solo la prima volta che si apre un PDF (build "legacy": funziona anche su iPhone meno recenti)
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist/legacy/build/pdf"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.js?url"),
    ]).then(([lib, worker]) => { lib.GlobalWorkerOptions.workerSrc = worker.default; return lib; });
  }
  return pdfjsPromise;
}

// Visore a schermo intero per PDF e immagini, dentro l'app.
export default function FileViewer({ url, name, type, onClose }) {
  const isPdf = /pdf/i.test(type || "") || /\.pdf$/i.test(name || "");
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, []);

  const round = { background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", width: 40, height: 40, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
  const save = async () => { setSaving(true); try { await downloadFile(url, name, type); } catch { window.open(url, "_blank"); } finally { setSaving(false); } };

  return createPortal(
    <div role="dialog" aria-label={name} style={{ position: "fixed", inset: 0, zIndex: 60, background: "#0b0b0b", display: "flex", flexDirection: "column", fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "max(10px, env(safe-area-inset-top)) 12px 10px", borderBottom: "1px solid #222" }}>
        <button onClick={onClose} style={round} aria-label="Chiudi"><X size={20} /></button>
        <div style={{ flex: 1, minWidth: 0, color: "#fff", fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        {isPdf && <>
          <button onClick={() => setZoom(z => Math.max(1, +(z - 0.5).toFixed(1)))} disabled={zoom <= 1} style={{ ...round, opacity: zoom <= 1 ? 0.4 : 1 }} aria-label="Riduci"><ZoomOut size={18} /></button>
          <button onClick={() => setZoom(z => Math.min(3, +(z + 0.5).toFixed(1)))} disabled={zoom >= 3} style={{ ...round, opacity: zoom >= 3 ? 0.4 : 1 }} aria-label="Ingrandisci"><ZoomIn size={18} /></button>
        </>}
        <button onClick={save} style={{ ...round, background: GREEN, color: "#0b0b0b" }} aria-label="Salva">
          {saving ? <Loader2 size={18} className="spin" /> : <Download size={18} />}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", WebkitOverflowScrolling: "touch", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {isPdf ? <PdfPages url={url} zoom={zoom} /> : (
          <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 8, boxSizing: "border-box" }}>
            <img src={url} alt={name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function PdfPages({ url, zoom }) {
  const boxRef = useRef(null);
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false, task;
    loadPdfjs()
      .then(lib => { task = lib.getDocument({ url, isEvalSupported: false }); return task.promise; })
      .then(d => { if (!cancelled) setDoc(d); })
      .catch(() => !cancelled && setErr("Non riesco ad aprire questo PDF. Prova con Salva."));
    return () => { cancelled = true; task?.destroy?.(); };
  }, [url]);

  useEffect(() => {
    const measure = () => boxRef.current && setWidth(boxRef.current.clientWidth);
    measure(); window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div ref={boxRef} style={{ padding: "12px 0" }}>
      {!doc && !err && <div style={{ color: MUTED, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 40 }}><Loader2 size={18} className="spin" /> Apro il PDF…</div>}
      {err && <div style={{ color: RED, textAlign: "center", padding: 40 }}>{err}</div>}
      {doc && width > 0 && <>
        <div style={{ color: MUTED, fontSize: 12, textAlign: "center", marginBottom: 8 }}>{doc.numPages} {doc.numPages === 1 ? "pagina" : "pagine"}</div>
        {Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={`${i}-${zoom}`} doc={doc} n={i + 1} width={Math.round((width - 16) * zoom)} />)}
      </>}
    </div>
  );
}

// Una pagina disegnata su canvas, solo quando sta per entrare nello schermo
function PdfPage({ doc, n, width }) {
  const ref = useRef(null);
  const [h, setH] = useState(Math.round(width * 1.414));
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let done = false;
    const draw = async () => {
      if (done) return; done = true;
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = page.getViewport({ scale: (width / base.width) * dpr });
      el.width = vp.width; el.height = vp.height;
      el.style.width = `${width}px`; el.style.height = `${Math.round(vp.height / dpr)}px`;
      setH(Math.round(vp.height / dpr));
      await page.render({ canvasContext: el.getContext("2d"), viewport: vp }).promise;
      setDrawn(true);
    };
    const io = new IntersectionObserver(es => es.some(e => e.isIntersecting) && draw(), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [doc, n, width]);
  return (
    <div style={{ display: "flex", justifyContent: width > 0 ? "flex-start" : "center", padding: "0 8px", marginBottom: 10 }}>
      <canvas ref={ref} style={{ width, height: h, background: drawn ? "#fff" : "#1a1a1a", borderRadius: 4, boxShadow: "0 4px 18px rgba(0,0,0,.5)", margin: "0 auto" }} />
    </div>
  );
}
