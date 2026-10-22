// Nomi già usati nel team: servono all'ingresso per evitare doppioni ("Chicco" vs "chicco smeraldi").
import { supabase } from "../supabaseClient";

export const normName = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const SOURCES = [["scores", "athlete"], ["comunicazioni", "utente"], ["personal_records", "athlete"], ["workout_done", "athlete"], ["push_subscriptions", "athlete"]];

// Nomi ordinati per quante volte compaiono (chi usa di più l'app viene prima)
export async function fetchTeamNames() {
  const count = {};
  await Promise.all(SOURCES.map(async ([t, c]) => {
    const { data } = await supabase.from(t).select(c).limit(2000);
    for (const r of data || []) { const n = String(r[c] || "").trim(); if (n && !n.startsWith("__")) count[n] = (count[n] || 0) + 1; }
  }));
  return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

// Nome esistente che sembra lo stesso di quello scritto (maiuscole, accenti, spazi, solo il nome di battesimo)
export function similarName(typed, names) {
  const t = normName(typed);
  if (!t) return null;
  if (names.includes(typed.trim())) return null;
  const same = names.find(n => normName(n) === t);
  if (same) return same;
  const byFirst = names.filter(n => normName(n).split(" ")[0] === t);
  return byFirst.length === 1 ? byFirst[0] : null;
}
