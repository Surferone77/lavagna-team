// Supabase Edge Function: send-push
// Manda una notifica push a tutti i telefoni iscritti (tabella push_subscriptions), rispettando le preferenze.
// Secret richiesto: VAPID_PRIVATE_KEY. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono già disponibili.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC = "BBs1YjvZ4kLaw1vjxOL9Afid5GX-el2Dcyl_0_gFhwyosT_UQaBGFwExAYLgcN_xAYvkPmxdQw65HtY5UwA1X0o";
const TYPES = ["workout", "bacheca", "changelog"];
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  // la chiave è 43 caratteri base64url: la estraggo anche se è stata incollata con spazi o testo attorno
  const raw = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  const priv = (raw.match(/[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/) || [])[0];
  if (!priv) return json({ error: raw ? `VAPID_PRIVATE_KEY non valida (lunghezza ${raw.length}, attesi 43 caratteri)` : "VAPID_PRIVATE_KEY non impostata sul server" }, 500);
  try {
    const { type, title, body, url, exclude } = await req.json();
    if (!TYPES.includes(type) || !title) return json({ error: "type o title non validi" }, 400);
    webpush.setVapidDetails("https://the-hybrid-one.netlify.app", VAPID_PUBLIC, priv);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: subs, error } = await sb.from("push_subscriptions").select("*");
    if (error) return json({ error: error.message }, 500);
    const targets = (subs || []).filter((s) => (s.prefs?.[type] ?? true) !== false && (!exclude || s.athlete !== exclude));
    const payload = JSON.stringify({ title: String(title).slice(0, 80), body: String(body || "").slice(0, 180), url: typeof url === "string" && url.startsWith("/") ? url : "/", tag: type });
    let sent = 0; const gone: string[] = []; const errors: string[] = [];
    await Promise.all(targets.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: type === "workout" ? "high" : "normal" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.id); else errors.push(String(code || e));
      }
    }));
    if (gone.length) await sb.from("push_subscriptions").delete().in("id", gone);
    return json({ sent, targets: targets.length, removed: gone.length, errors: errors.slice(0, 3) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
