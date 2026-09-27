// Fonction Edge « rappel » : envoie les notifications du soir à l'iPhone (Web Push).
// À coller telle quelle dans Supabase › Edge Functions › Deploy a new function › Via Editor, sous le nom « rappel ».
// Secret à définir dans Edge Functions › Secrets : VAPID_PRIVATE_KEY (valeur fournie dans supabase/.vapid.json, jamais commitée).
//
// Appelée toutes les 5 minutes par pg_cron (en-tête x-rappel-secret = le secret des raccourcis, lu dans app_config).
// Toute la décision (heure du rendez-vous, objectif déjà atteint, déjà envoyé aujourd'hui…) est prise en SQL par rappel_due ;
// cette fonction ne fait que chiffrer et envoyer, puis signale à la base ce qui est parti et les abonnements morts.
// Depuis l'app, Réglages › « Tester » l'appelle avec {"test": true} pour un essai immédiat.
import webpush from "npm:web-push@3.6.7";

const APP_URL = "https://natnaat.github.io/lecture-ecran/";            // adresse absolue : iOS ignore une adresse relative
const VAPID_PUBLIC_KEY = "BLCjIZFK2F1RdUmIhEV3uLSp-4GY1pXSov5cEdZRFt86ftMhJ6YQhenJtJyypY72oZjKWqHAO1plp3HyKVPyNNs";   // identique à config.js
const CORS = { "Access-Control-Allow-Origin": "https://natnaat.github.io", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-rappel-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  const secret = req.headers.get("x-rappel-secret") ?? "";
  // Clé publique du projet : la nouvelle (sb_publishable_…) si elle existe, sinon l'ancienne clé anon. Les deux sont publiques.
  const base = Deno.env.get("SUPABASE_URL")!;
  const key: string = (() => { try { return JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}").default; } catch { return undefined; } })() ?? Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth: Record<string, string> = key.startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
  const rpc = async (fn: string, body: Record<string, unknown>) => {
    const r = await fetch(`${base}/rest/v1/rpc/${fn}`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`${fn} : ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  };
  try {
    if (!secret) return json({ error: "secret manquant" }, 401);
    const test = req.method === "POST" ? Boolean((await req.json().catch(() => ({})))?.test) : false;
    const due = await rpc("rappel_due", { p_secret: secret, p_test: test });
    if (!due?.due) return json({ sent: 0, reason: due?.reason ?? "rien à envoyer" });
    if (test) await new Promise((r) => setTimeout(r, 6000));   // le temps de quitter l'app pour voir la notification arriver
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!privateKey) throw new Error("VAPID_PRIVATE_KEY manquant dans les secrets de la fonction");
    // Web Push « déclaratif » (iOS 18.4+) : iOS affiche la notification lui-même et ouvre « navigate » au toucher.
    // Les versions plus anciennes reçoivent le même JSON dans le service worker (sw.js), qui l'affiche.
    const payload = JSON.stringify({ web_push: 8030, notification: { title: due.title, body: due.body, navigate: APP_URL + due.url, lang: "fr", tag: `pcm-${due.kind}`, silent: false } });
    const gone: string[] = [], errors: string[] = []; let sent = 0, permanent = false;
    for (const sub of due.subs) {
      try {   // un abonnement en erreur ne doit pas empêcher les autres de partir
        const d = webpush.generateRequestDetails(sub, payload, { vapidDetails: { subject: APP_URL, publicKey: VAPID_PUBLIC_KEY, privateKey }, TTL: 3600, urgency: "high" });
        const h = new Headers(); for (const [k, v] of Object.entries(d.headers)) if (k.toLowerCase() !== "content-length") h.set(k, String(v));
        const r = await fetch(d.endpoint, { method: "POST", headers: h, body: new Uint8Array(d.body), signal: AbortSignal.timeout(10_000) });
        if (r.status === 404 || r.status === 410) gone.push(sub.endpoint);        // abonnement expiré : on l'oublie
        else if (r.ok) sent++;
        else {                                                                    // 400/403 : problème de clés, on garde l'abonnement
          if (r.status >= 400 && r.status < 500 && r.status !== 429) permanent = true;
          errors.push(`${r.status} ${await r.text()}`);
        }
      } catch (e) { errors.push(String((e as Error)?.message ?? e)); }
    }
    // Une erreur de configuration ne se réessaie pas toutes les 5 minutes jusqu'à minuit : la journée est marquée, l'erreur reste lisible.
    // Journée marquée seulement si quelque chose est parti (ou si l'erreur est définitive) ; sinon on ne fait qu'oublier les abonnements morts.
    if (!test && (sent || gone.length || permanent)) await rpc("rappel_done", { p_secret: secret, p_kind: sent || permanent ? due.kind : "prune", p_gone: gone });
    else if (test && gone.length) await rpc("rappel_done", { p_secret: secret, p_kind: "test", p_gone: gone });
    return json({ kind: due.kind, sent, gone: gone.length, errors }, errors.length && !sent ? 502 : 200);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
