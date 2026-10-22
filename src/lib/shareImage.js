// Immagini da condividere di un blocco: PNG trasparente (da incollare come adesivo) o storia 9:16.
// Solo testo, nessuna grafica: titolo, formato, esercizi, eventuale risultato e una riga libera.
import { FONT } from "./theme.js";

export const SIZES = { png: { w: 1080 }, story: { w: 1080, h: 1920 } };

// Righe da disegnare, nell'ordine
export function buildLines(w, opt = {}) {
  const L = [];
  if (opt.title !== false && w.title) L.push({ k: "title", t: w.title });
  if (opt.tag !== false && w.tag) L.push({ k: "tag", t: w.tag.toUpperCase() });
  if (L.length) L.push({ k: "gap" });
  const body = String(w.detail || "").split("\n").map(s => s.trimEnd());
  while (body.length && !body[body.length - 1]) body.pop();
  for (const t of body) L.push(t ? { k: "body", t } : { k: "gap" });
  if (opt.score && opt.scoreText) { L.push({ k: "gap" }); L.push({ k: "score", t: opt.scoreText }); }
  if (opt.extra && opt.extra.trim()) { L.push({ k: "gap" }); for (const t of opt.extra.trim().split("\n")) L.push({ k: "extra", t }); }
  return L;
}

const STYLE = {
  title: { f: 1.32, weight: 900, lh: 1.15 },
  tag: { f: 0.74, weight: 800, lh: 1.5 },
  body: { f: 1, weight: 600, lh: 1.32 },
  score: { f: 1.12, weight: 900, lh: 1.3 },
  extra: { f: 0.86, weight: 500, lh: 1.32, italic: true },
  gap: { f: 0.55, lh: 1 },
};
const font = (s, px) => `${s.italic ? "italic " : ""}${s.weight || 400} ${Math.round(px)}px ${FONT}`;

// Spezza le righe troppo lunghe; restituisce le righe "fisiche" con posizione verticale
function layout(ctx, lines, S, maxW) {
  const out = []; let y = 0, wraps = 0;
  for (const ln of lines) {
    const st = STYLE[ln.k], px = S * st.f;
    if (ln.k === "gap") { y += px * st.lh; continue; }
    ctx.font = font(st, px);
    const words = ln.t.split(/\s+/); let cur = "";
    const push = (t) => { y += px * st.lh; out.push({ k: ln.k, t, px, y, st, src: ln }); };
    for (const wd of words) {
      const test = cur ? cur + " " + wd : wd;
      if (ctx.measureText(test).width <= maxW || !cur) cur = test; else { push(cur); cur = wd; }
      // parola singola più larga dello spazio: la spezzo a caratteri
      while (ctx.measureText(cur).width > maxW && cur.length > 1) {
        let i = cur.length; while (i > 1 && ctx.measureText(cur.slice(0, i)).width > maxW) i--;
        push(cur.slice(0, i)); cur = cur.slice(i);
      }
    }
    if (cur) push(cur);
    if (ln.k !== "title") wraps += out.filter(o => o.src === ln).length - 1;
  }
  return { out, h: y, wraps };
}

// mode: "png" (trasparente, altezza sul contenuto) | "story" (1080×1920, sfondo pieno)
// color: "light" = testo bianco (su nero per la storia) | "dark" = testo nero (su bianco per la storia)
export function renderShare(lines, { mode = "png", color = "light" } = {}) {
  const W = 1080, pad = mode === "story" ? 96 : 64, maxW = W - pad * 2;
  const c = document.createElement("canvas"); const ctx = c.getContext("2d");
  // spazio utile della storia: lascio libere le zone dove Instagram mette nome e campo risposta
  const areaH = mode === "story" ? 1920 - 300 - 360 : 1800;
  let S = mode === "story" ? 84 : 64, L;
  // il carattere più grande che entra, evitando di andare a capo nelle righe degli esercizi
  for (; S >= 22; S -= 2) { L = layout(ctx, lines, S, maxW); if (L.h <= areaH && (L.wraps === 0 || S <= 46)) break; }
  const H = mode === "story" ? 1920 : Math.ceil(L.h + pad * 2 + S * 0.3);
  c.width = W; c.height = H;
  const fg = color === "light" ? "#ffffff" : "#0b0b0b";
  if (mode === "story") { ctx.fillStyle = color === "light" ? "#000000" : "#ffffff"; ctx.fillRect(0, 0, W, H); }
  const top = mode === "story" ? 300 + Math.max(0, (areaH - L.h) / 2) : pad;
  ctx.textBaseline = "alphabetic"; ctx.fillStyle = fg;
  if (mode === "png") { ctx.shadowColor = color === "light" ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.5)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; }
  for (const r of L.out) {
    ctx.font = font(r.st, r.px);
    ctx.globalAlpha = r.k === "tag" || r.k === "extra" ? 0.82 : 1;
    ctx.fillText(r.t, pad, top + r.y - r.px * (r.st.lh - 1) / 2 - r.px * 0.22);
  }
  ctx.globalAlpha = 1;
  return c;
}

export const toBlob = (canvas) => new Promise((res) => canvas.toBlob(res, "image/png"));
export const slug = (s) => String(s || "wod").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "wod";
