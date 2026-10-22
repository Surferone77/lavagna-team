// Link del giorno per un ospite: salvo una copia del giorno con un token casuale e una scadenza.
import { supabase } from "../supabaseClient";

const token = () => { const b = new Uint8Array(16); crypto.getRandomValues(b); return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
export const dayLink = (t) => `${location.origin}/?giorno=${t}`;
const KEY = "shared:days";
const saved = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* */ } };

// link già creato da questo telefono per quel giorno e ancora valido
export function existingLink(dayId) {
  const s = saved()[dayId];
  return s && new Date(s.expires) > new Date() ? s : null;
}

export async function createDayLink({ weekId, dayKey, date, label, workouts, by, hours = 48 }) {
  const t = token();
  const expires = new Date(Date.now() + hours * 3600e3).toISOString();
  const copy = workouts.map(w => ({ title: w.title, tag: w.tag || "", type: w.type, detail: w.detail || "", ...(w.timer ? { timer: w.timer } : {}) }));
  const { error } = await supabase.from("shared_days").insert({ token: t, week_id: weekId, day_key: dayKey, day_date: date, day_label: label, workouts: copy, created_by: by, expires_at: expires });
  if (error) throw new Error("Link non creato: " + error.message);
  const all = saved(); all[`${weekId}__${dayKey}`] = { token: t, expires }; save(all);
  return { token: t, expires };
}

export async function revokeDayLink(dayId, t) {
  await supabase.rpc("revoke_shared_day", { t });
  const all = saved(); delete all[dayId]; save(all);
}

export async function loadSharedDay(t) {
  const { data, error } = await supabase.rpc("get_shared_day", { t });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data[0] || null : data;
}
