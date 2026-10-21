import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Se mancano le variabili d'ambiente l'app mostra un messaggio invece di una pagina bianca.
export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured ? createClient(url, key) : null;

// Chiama una Edge Function e restituisce sempre { data } oppure lancia un Error leggibile.
export async function callFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context?.json(); if (j?.error) msg = j.error; } catch { /* risposta non JSON */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
