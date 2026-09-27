// Cache minimal de la coquille : l'appli s'ouvre même sans réseau, les données restent toujours fraîches.
const CACHE = "pages-v54";
const SHELL = ["./", "index.html", "config.js", "manifest.webmanifest", "icon.svg", "icon-180.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname === "cdn.jsdelivr.net") {   // bibliothèque 3D : version figée, cache d'abord
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  // GitHub Pages sert avec max-age=600 : on revalide toujours auprès du serveur (ETag), sinon une mise à jour attend 10 min
  e.respondWith(fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" }).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
// Notifications : iOS 18.4+ affiche lui-même les messages « déclaratifs » ; ailleurs (iOS plus ancien, Mac) elles passent ici.
// Toujours afficher quelque chose : Safari retire l'autorisation après quelques pushs sans notification visible.
self.addEventListener("push", e => {
  let m = {}; try { m = e.data ? e.data.json() : {}; } catch {}
  const n = m.notification || m, url = n.navigate || n.url || "./?lire";
  e.waitUntil(self.registration.showNotification(n.title || "Pages contre minutes", { body: n.body || "", tag: n.tag, lang: "fr", icon: "icon-180.png", data: { url } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close(); const url = new URL((e.notification.data && e.notification.data.url) || "./?lire", self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) { try { await w.focus(); w.postMessage({ type: "open", url }); return; } catch {} }
    await clients.openWindow(url);
  })());
});
