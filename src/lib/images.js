// Preparazione immagini prima dell'invio all'AI.
// Obiettivo: qualunque foto/screenshot (HEIC, 4000px, screenshot lunghissimi) diventa
// uno o più JPEG di dimensione ottimale per la lettura, così il testo resta nitido.

export const LIMITS = {
  maxEdge: 1568,       // lato lungo massimo per foto "normali" (ottimale per la vision)
  tileWidth: 1000,     // larghezza degli screenshot lunghi dopo il resize
  tileHeight: 1400,    // altezza di ogni pezzo
  overlap: 140,        // sovrapposizione tra pezzi, così nessuna riga viene tagliata a metà
  tallRatio: 2.4,      // oltre questo rapporto altezza/larghezza lo tratto come screenshot lungo
  quality: 0.85,
};

const isHeic = (file) => /heic|heif/i.test(file.type || "") || /\.(heic|heif)$/i.test(file.name || "");

async function decodeWithImg(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // revoco dopo il disegno: l'immagine decodificata resta in memoria
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

// Decodifica robusta: createImageBitmap -> <img> -> conversione HEIC (solo se serve).
export async function decode(file) {
  try {
    if (typeof createImageBitmap === "function") return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch { /* provo il metodo successivo */ }
  try {
    return await decodeWithImg(file);
  } catch (e) {
    if (!isHeic(file)) throw new Error("Formato immagine non leggibile");
  }
  // Safari legge l'HEIC da solo; Chrome/Android no: converto con heic2any (caricato solo qui)
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return decodeWithImg(Array.isArray(out) ? out[0] : out);
}

// Calcola i rettangoli da ritagliare (in pixel della sorgente) e la dimensione di output.
export function planTiles(w, h, L = LIMITS) {
  if (h / w <= L.tallRatio) {
    const s = Math.min(1, L.maxEdge / Math.max(w, h));
    return [{ sx: 0, sy: 0, sw: w, sh: h, dw: Math.round(w * s), dh: Math.round(h * s) }];
  }
  const s = Math.min(1, L.tileWidth / w);
  const srcTileH = Math.round(L.tileHeight / s);
  const srcOverlap = Math.round(L.overlap / s);
  const tiles = [];
  for (let y = 0; y < h; y += srcTileH - srcOverlap) {
    const sh = Math.min(srcTileH, h - y);
    // un ultimo pezzo minuscolo è già coperto dalla sovrapposizione
    if (tiles.length && sh <= srcOverlap) break;
    tiles.push({ sx: 0, sy: y, sw: w, sh, dw: Math.round(w * s), dh: Math.round(sh * s) });
    if (y + sh >= h) break;
  }
  return tiles;
}

function toJpeg(canvas, quality) {
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("toBlob fallito")), "image/jpeg", quality));
}

export function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

// File -> { tiles: [{ media_type, data, blob }], preview, width, height }
export async function prepareImage(file, L = LIMITS) {
  const bmp = await decode(file);
  const w = bmp.width, h = bmp.height;
  if (!w || !h) throw new Error("Immagine vuota");
  const plan = planTiles(w, h, L);
  const tiles = [];
  for (const t of plan) {
    const c = document.createElement("canvas");
    c.width = t.dw; c.height = t.dh;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, t.dw, t.dh); // niente trasparenze nel JPEG
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, t.sx, t.sy, t.sw, t.sh, 0, 0, t.dw, t.dh);
    const blob = await toJpeg(c, L.quality);
    tiles.push({ media_type: "image/jpeg", data: await blobToBase64(blob), blob });
  }
  if (bmp.close) bmp.close();
  return { tiles, preview: URL.createObjectURL(tiles[0].blob), width: w, height: h };
}

// Esegue fn su ogni elemento con al massimo `limit` lavori in parallelo.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
