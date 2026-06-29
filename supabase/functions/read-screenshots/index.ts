// Supabase Edge Function: read-screenshots
// Riceve immagini (base64), le legge con Claude e restituisce i workout in JSON.
// La chiave ANTHROPIC_API_KEY è un secret del server: non finisce mai nel browser.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROMPT = `Leggi questi screenshot di allenamenti (CrossFit/HYROX). Per OGNI card di allenamento nelle immagini, estrai un oggetto JSON con:
- "title": titolo della card
- "tag": etichetta breve (es. "For Time", "AMRAP 2", "EMOM 12") oppure ""
- "type": uno tra "time", "reps", "weight", "note"
- "detail": il contenuto, usa \\n per andare a capo, conciso

Regole per "type":
- "For Time", test a tempo, row/run/ski a tempo -> "time"
- "AMRAP", "max reps" -> "reps"
- "build to heavy", "xRM", "heavy single", massimale -> "weight"
- corsa facile, bike facile, recovery, testo descrittivo senza punteggio -> "note"

Mantieni l'ordine delle card. Rispondi SOLO con un array JSON valido. Niente testo, niente backtick.`;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { images } = await req.json();
    if (!Array.isArray(images) || images.length === 0) {
      return json({ error: "Nessuna immagine ricevuta." }, 400);
    }

    const content = images.map((im: { media_type?: string; data: string }) => ({
      type: "image",
      source: { type: "base64", media_type: im.media_type || "image/jpeg", data: im.data },
    }));
    content.push({ type: "text", text: PROMPT });

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content }],
      }),
    });

    const data = await resp.json();
    if (data.error) return json({ error: data.error.message || "Errore API" }, 502);

    const text = (data.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");
    const clean = text.replace(/```json|```/g, "").trim();

    try {
      const workouts = JSON.parse(clean);
      if (!Array.isArray(workouts)) throw new Error("not array");
      return json({ workouts });
    } catch {
      // ritorna il testo grezzo così il client può farti correggere a mano
      return json({ error: "parse", raw: text });
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
