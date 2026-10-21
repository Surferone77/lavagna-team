// Salvataggio di un giorno di allenamento (condiviso da app team e pagina coach).
import { supabase } from "../supabaseClient";
import { DAY_ORDER, DAY_LABEL, ingest, assignIds, cleanWorkout } from "./weeks";

// Aggiunge o sostituisce un giorno, mantenendo gli id dei blocchi già esistenti
// (così i punteggi restano attaccati). Restituisce { week } oppure { error }.
export async function persistDay({ weekId, weekLabel, dayKey, date, workouts }) {
  const { data: ex, error } = await supabase.from("weeks").select("data").eq("id", weekId).maybeSingle();
  if (error) return { error: "Errore database: " + error.message };
  const wk = ex?.data?.days ? ingest(ex.data) : { id: weekId, label: weekLabel || weekId, days: [] };
  if (weekLabel) wk.label = weekLabel;
  const prev = wk.days.find(d => d.key === dayKey);
  const withIds = assignIds(weekId, dayKey, workouts.map(cleanWorkout), prev?.workouts);
  wk.days = wk.days.filter(d => d.key !== dayKey);
  wk.days.push({ key: dayKey, label: DAY_LABEL[dayKey] || dayKey, date: date || prev?.date || "", workouts: withIds });
  wk.days.sort((a, b) => DAY_ORDER.indexOf(a.key) - DAY_ORDER.indexOf(b.key));
  const { error: e2 } = await supabase.from("weeks").upsert({ id: wk.id, label: wk.label, data: wk, updated_at: new Date().toISOString() });
  if (e2) return { error: "Salvataggio non riuscito: " + e2.message };
  return { week: wk };
}
