// Supabase Edge Function: read-screenshots
// Riceve UNO screenshot (eventualmente diviso in più pezzi verticali, in ordine) e
// restituisce i workout in JSON. Usa il "tool use" di Claude: la risposta segue uno
// schema fisso, quindi niente più JSON troncati o testo da ripulire.
// Secrets: ANTHROPIC_API_KEY (obbligatorio), ANTHROPIC_MODEL (facoltativo).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-6";
const MAX_IMAGES = 8;

const PROMPT = `Queste immagini sono screenshot o foto della programmazione di allenamento di un box CrossFit/HYROX (app tipo SugarWOD, lavagna, PDF).
Se ci sono più immagini, sono pezzi CONSECUTIVI dello stesso screenshot lungo, dall'alto in basso, con una piccola sovrapposizione: una card che appare a cavallo di due pezzi va riportata UNA volta sola, unendo il testo.

Estrai ogni card/blocco di allenamento, nell'ordine in cui compare, e chiama save_workouts.

Regole:
- title: il titolo della card così com'è (es. "Strength - Dual KB Box Step Over", "Applied Strength", "Metcon").
- tag: formato breve se presente o deducibile ("For Time", "AMRAP 12", "EMOM 10", "3 sets", "Build to 3RM"), altrimenti "".
- detail: il contenuto COMPLETO e FEDELE, una riga per movimento, mantieni numeri, pesi (24/20", 100/70#), RPE, time cap. Non inventare e non riassumere.
- type:
  - "time"   -> For Time, chipper, test a tempo, row/run/ski su distanza fissa a tempo
  - "reps"   -> max reps, AMRAP con conteggio reps totali, max calorie
  - "rounds" -> AMRAP con punteggio in round + reps
  - "weight" -> build to heavy, xRM, max load, 1RM
  - "note"   -> lavoro tecnico, accessori a RPE, mobilità, warm-up, corsa facile: nessun punteggio confrontabile
- timer: proponi il timer giusto quando il formato lo permette. For Time → fortime (cap in minuti se c'è un time cap); AMRAP N → amrap minutes N; EMOM N / Every X min for N → emom (every in secondi, rounds); Tabata o lavoro/riposo a round → intervals; lavoro a RPE o tecnico senza tempo → ometti timer.
- Il programma deve valere per TUTTO il team: escludi qualunque dato personale di chi ha fatto lo screenshot o di altri atleti/coach.
  Quindi NON riportare: nomi di persone, avatar, punteggi o risultati registrati (tempi, reps, carichi segnati da qualcuno), posizioni in classifica, commenti, like, note personali, "Your score", "PR".
  Riporta solo la prescrizione dell'allenamento (cosa fare), non cosa ha fatto qualcuno.
- Ignora pulsanti e interfaccia dell'app (Leaderboard, Add your score, History, icone, menu).
- In "removed" elenca brevemente ciò che hai escluso perché personale (es. "Giada Bonardi — nome sotto la card", "8:42 — risultato di Giada"), così l'utente può verificarlo.
- day / date: compila SOLO se il giorno o la data sono scritti nello screenshot (barra in alto, intestazione, calendario). Non indovinare.
- Se l'immagine non contiene allenamenti, chiama save_workouts con lista vuota e spiega in "warning".`;

const TOOL = {
  name: "save_workouts",
  description: "Salva i blocchi di allenamento letti dalle immagini.",
  input_schema: {
    type: "object",
    properties: {
      workouts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            tag: { type: "string" },
            type: { type: "string", enum: ["time", "reps", "rounds", "weight", "note"] },
            detail: { type: "string" },
            timer: {
              type: "object",
              description: "Timer adatto al blocco, se il formato lo indica",
              properties: {
                mode: { type: "string", enum: ["fortime", "amrap", "emom", "intervals", "countdown"] },
                minutes: { type: "integer", description: "durata in minuti (amrap, countdown)" },
                cap: { type: "integer", description: "time cap in minuti (fortime), 0 se assente" },
                every: { type: "integer", description: "secondi per intervallo (emom)" },
                rounds: { type: "integer", description: "numero di round (emom, intervals)" },
                work: { type: "integer", description: "secondi di lavoro (intervals)" },
                rest: { type: "integer", description: "secondi di riposo (intervals)" },
              },
              required: ["mode"],
            },
          },
          required: ["title", "type", "detail"],
        },
      },
      date: { type: "string", description: "Data visibile nello screenshot in formato YYYY-MM-DD, se presente" },
      day: { type: "string", enum: ["lun", "mar", "mer", "gio", "ven", "sab", "dom", ""], description: "Giorno della settimana a cui si riferisce lo screenshot, se visibile (intestazione, data, 'Monday', 'Lun 27'…); stringa vuota se non è indicato" },
      removed: { type: "array", items: { type: "string" }, description: "Dati personali esclusi (nomi, risultati, commenti)" },
      warning: { type: "string", description: "Problemi di lettura (immagine sfocata, tagliata, non pertinente)" },
    },
    required: ["workouts"],
  },
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "content-type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "ANTHROPIC_API_KEY non impostata sul server" }, 500);

  try {
    const { images } = await req.json();
    if (!Array.isArray(images) || images.length === 0) return json({ error: "Nessuna immagine ricevuta." }, 400);
    if (images.length > MAX_IMAGES) return json({ error: `Troppi pezzi (${images.length}). Massimo ${MAX_IMAGES}.` }, 400);

    const content: unknown[] = images.map((im: { media_type?: string; data: string }) => ({
      type: "image",
      source: { type: "base64", media_type: im.media_type || "image/jpeg", data: im.data },
    }));
    content.push({ type: "text", text: PROMPT });

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "save_workouts" },
        messages: [{ role: "user", content }],
      }),
    });

    const data = await resp.json();
    if (!resp.ok || data.error) return json({ error: data.error?.message || `Errore API (${resp.status})` }, 502);

    const use = (data.content || []).find((b: { type: string }) => b.type === "tool_use");
    if (!use) return json({ error: "Risposta senza dati strutturati" }, 502);

    const input = use.input || {};
    const workouts = Array.isArray(input.workouts) ? input.workouts : [];
    const truncated = data.stop_reason === "max_tokens";
    return json({
      workouts,
      date: input.date || null,
      day: ["lun", "mar", "mer", "gio", "ven", "sab", "dom"].includes(input.day) ? input.day : null,
      removed: Array.isArray(input.removed) ? input.removed : [],
      warning: truncated ? "Risposta troppo lunga: alcune card potrebbero mancare." : (input.warning || null),
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
