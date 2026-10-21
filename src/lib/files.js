// Allegati della bacheca e download universale (telefono → Condividi/Salva, computer → file).
import { supabase } from "../supabaseClient";
import { compressPhoto } from "./photos";

export const ATTACH_BUCKET = "attachments";
export const MAX_BYTES = 5 * 1024 * 1024;

// Tipi accettati: foto e documenti comuni
export const ACCEPT = "image/*,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.pages,.numbers,.key,.zip";
const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|txt|csv|rtf|pages|numbers|key|zip)$/i;
export const isImageFile = (f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name);

export const fmtBytes = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`;

// Controlla il file prima dell'invio. Le foto vengono compresse, quindi anche una foto da 8 MB va bene.
export function checkFile(f) {
  if (isImageFile(f)) return null;
  if (!DOC_EXT.test(f.name)) return "Tipo di file non supportato. Usa foto, PDF, Word, Excel, PowerPoint, testo o ZIP.";
  if (f.size > MAX_BYTES) return `File troppo grande (${fmtBytes(f.size)}). Massimo 5 MB.`;
  return null;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const cleanName = (n) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);

export const attachmentUrl = (path) => supabase.storage.from(ATTACH_BUCKET).getPublicUrl(path).data.publicUrl;

// Carica un allegato e restituisce i campi da salvare nel messaggio.
export async function uploadAttachment(file) {
  let blob = file, type = file.type || "application/octet-stream", name = file.name;
  if (isImageFile(file)) {
    const { full } = await compressPhoto(file);
    blob = full.blob; type = "image/jpeg"; name = name.replace(/\.[^.]+$/, "") + ".jpg";
  }
  if (blob.size > MAX_BYTES) throw new Error(`File troppo grande (${fmtBytes(blob.size)}). Massimo 5 MB.`);
  const path = `${new Date().toISOString().slice(0, 7)}/${uid()}-${cleanName(name)}`;
  const { error } = await supabase.storage.from(ATTACH_BUCKET).upload(path, blob, { contentType: type, upsert: false });
  if (error) throw new Error("Upload non riuscito: " + error.message);
  return { allegato_path: path, allegato_nome: name, allegato_tipo: type, allegato_bytes: blob.size };
}

// Scarica un file: su iPhone/Android apre Condividi (→ "Salva immagine" / "Salva su File"),
// su Mac/PC lo salva nella cartella Download.
export async function downloadFile(url, filename, type) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download non riuscito");
  const blob = await res.blob();
  const file = new File([blob], filename, { type: type || blob.type });
  if (/iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; } catch (e) { if (e?.name === "AbortError") return; }
  }
  const obj = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = obj; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(obj), 5000);
}
