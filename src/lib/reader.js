// Lettura AI di uno screenshot: preparazione immagine + chiamata alla Edge Function.
import { prepareImage } from "./images";
import { mergeWorkouts, stripPersonal } from "./weeks";
import { callFunction } from "../supabaseClient";

const MAX_TILES_PER_CALL = 8;

// Una voce per screenshot: stato, anteprima, pezzi, risultato.
let seq = 0;
export const newItem = (file) => ({ key: ++seq, file, status: "pending", preview: null, tiles: null, workouts: null, error: null, warning: null, date: null, day: null, removed: [] });

export async function readOne(item) {
  const prep = item.tiles ? item : await prepareImage(item.file);
  const chunks = [];
  for (let i = 0; i < prep.tiles.length; i += MAX_TILES_PER_CALL) chunks.push(prep.tiles.slice(i, i + MAX_TILES_PER_CALL));
  const results = [];
  for (const c of chunks) results.push(await callFunction("read-screenshots", { images: c.map(({ media_type, data }) => ({ media_type, data })) }));
  const removed = [...new Set(results.flatMap(r => r.removed || []))];
  return {
    preview: prep.preview, tiles: prep.tiles, removed,
    workouts: stripPersonal(mergeWorkouts(results.map(r => r.workouts)), removed),
    warning: results.map(r => r.warning).filter(Boolean).join(" ") || null,
    date: results.map(r => r.date).find(Boolean) || null,
    day: results.map(r => r.day).find(Boolean) || null,
  };
}
