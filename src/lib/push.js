// Notifiche push: iscrizione del telefono, preferenze per tipo e invio tramite la Edge Function send-push.
import { supabase, callFunction } from "../supabaseClient";

export const VAPID_PUBLIC = "BBs1YjvZ4kLaw1vjxOL9Afid5GX-el2Dcyl_0_gFhwyosT_UQaBGFwExAYLgcN_xAYvkPmxdQw65HtY5UwA1X0o";
export const PUSH_TYPES = [
  { key: "workout", label: "Allenamenti", sub: "Quando Giada pubblica o modifica la programmazione" },
  { key: "bacheca", label: "Bacheca", sub: "Nuovi messaggi del team" },
  { key: "changelog", label: "Novità dell'app", sub: "Quando arrivano nuove funzioni" },
];
export const DEFAULT_PREFS = { workout: true, bacheca: true, changelog: true };

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// Stato per l'interfaccia: unsupported | needs-home (iPhone da Safari) | denied | off | on
export async function pushStatus() {
  if (!pushSupported()) return isIOS() && !isStandalone() ? "needs-home" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

const b64ToBytes = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); };
const keyOf = (sub, k) => { const j = sub.toJSON(); return j.keys?.[k]; };

export async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("/sw.js"); } catch { return null; }
}

// Chiede il permesso, iscrive il telefono e salva l'iscrizione nel database
export async function enablePush(athlete, prefs = DEFAULT_PREFS) {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error(perm === "denied" ? "Permesso negato: riattivalo nelle impostazioni del telefono." : "Permesso non concesso.");
  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerSW());
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
  const { error } = await supabase.from("push_subscriptions").upsert({
    endpoint: sub.endpoint, p256dh: keyOf(sub, "p256dh"), auth: keyOf(sub, "auth"), athlete, prefs,
    user_agent: navigator.userAgent.slice(0, 200), updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) throw new Error("Iscrizione non salvata: " + error.message);
  return sub;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe().catch(() => {});
}

export async function loadPrefs() {
  const reg = await navigator.serviceWorker?.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  const { data } = await supabase.from("push_subscriptions").select("prefs, athlete").eq("endpoint", sub.endpoint).maybeSingle();
  return { endpoint: sub.endpoint, prefs: { ...DEFAULT_PREFS, ...(data?.prefs || {}) }, athlete: data?.athlete };
}

export async function savePrefs(prefs) {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await supabase.from("push_subscriptions").update({ prefs, updated_at: new Date().toISOString() }).eq("endpoint", sub.endpoint);
}

// Se cambio nome, l'iscrizione segue il nome nuovo (serve per non ricevere le proprie notifiche)
export async function syncPushName(athlete) {
  if (!pushSupported() || !athlete) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await supabase.from("push_subscriptions").update({ athlete }).eq("endpoint", sub.endpoint);
}

// Invia una notifica a tutti (tranne chi la manda). Non blocca mai l'app se fallisce.
export function notify(type, title, body, url = "/", exclude = null) {
  callFunction("send-push", { type, title, body, url, exclude }).catch(() => {});
}
