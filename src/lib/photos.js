// Foto dei workout: compressione nel browser, upload su Supabase Storage, download.
// Ogni foto viene salvata in due versioni: "full" (lato lungo 2048 px, ~300-600 KB)
// e una miniatura (400 px, ~30 KB) per le griglie. L'originale del telefono non viene mai caricato.
import { decode } from "./images";
import { supabase } from "../supabaseClient";

export const BUCKET = "photos";
export const PHOTO_LIMITS = { full: 2048, thumb: 400, qFull: 0.82, qThumb: 0.7, maxPerUpload: 10, freeQuotaMB: 1024 };

function render(bmp, maxEdge, quality) {
  const s = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  return new Promise((res, rej) => c.toBlob(b => b ? res({ blob: b, w, h }) : rej(new Error("Compressione fallita")), "image/jpeg", quality));
}

export async function compressPhoto(file) {
  const bmp = await decode(file);
  const full = await render(bmp, PHOTO_LIMITS.full, PHOTO_LIMITS.qFull);
  const thumb = await render(bmp, PHOTO_LIMITS.thumb, PHOTO_LIMITS.qThumb);
  if (bmp.close) bmp.close();
  return { full, thumb };
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
export const publicUrl = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

export async function listPhotos(workoutId) {
  const { data, error } = await supabase.from("photos").select("*").eq("workout_id", workoutId).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function uploadPhoto({ file, workoutId, weekId, dayKey, athlete }) {
  const { full, thumb } = await compressPhoto(file);
  const id = uid();
  const base = `${weekId}/${workoutId}/${id}`;
  const path = `${base}.jpg`, thumb_path = `${base}_t.jpg`;
  const up = async (p, b) => {
    const { error } = await supabase.storage.from(BUCKET).upload(p, b, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error("Upload non riuscito: " + error.message);
  };
  await up(path, full.blob);
  await up(thumb_path, thumb.blob);
  const row = { workout_id: workoutId, week_id: weekId, day_key: dayKey, athlete, path, thumb_path, width: full.w, height: full.h, bytes: full.blob.size + thumb.blob.size };
  const { data, error } = await supabase.from("photos").insert(row).select().single();
  if (error) throw new Error("Salvataggio non riuscito: " + error.message);
  return data;
}

export async function deletePhoto(photo) {
  await supabase.storage.from(BUCKET).remove([photo.path, photo.thumb_path]);
  const { error } = await supabase.from("photos").delete().eq("id", photo.id);
  if (error) throw error;
}

// Scarica: sul telefono apre il pannello Condividi (→ "Salva immagine" nel rullino),
// sul computer scarica il file.
export async function downloadPhoto(photo, filename) {
  const res = await fetch(publicUrl(photo.path));
  const blob = await res.blob();
  const file = new File([blob], filename, { type: "image/jpeg" });
  if (navigator.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: filename }); return; } catch (e) { if (e?.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function storageUsageMB() {
  const { data, error } = await supabase.from("photos").select("bytes");
  if (error) return null;
  return (data || []).reduce((s, r) => s + (r.bytes || 0), 0) / (1024 * 1024);
}

export const safeName = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
