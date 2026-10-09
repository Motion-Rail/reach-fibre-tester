// Offline shell. v33: pages come from the network first, so a new version shows on the next open;
// the cache is only used when there is no signal. Bump CACHE after editing the app.
const CACHE = "reachtester-brunel";
const ASSETS = ["./", "./index.html", "./desktop.html", "./push.js", "./manifest.webmanifest",
                "./icons/icon-192.png", "./icons/icon-512.png", "./logo.png", "./logo-light.png", "./mark.png", "./neos-logo.svg"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(a => new Request(a, {cache: "reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.pathname.includes("/api/") || u.pathname.endsWith("/health")) return;   // never cache relay/API traffic
  if (u.origin !== self.location.origin) return;                                 // CDN and relay: always network
  const page = e.request.mode === "navigate" || u.pathname.endsWith(".html") || u.pathname.endsWith("/") || u.pathname.endsWith("sw.js");
  if (page) {          // network first, fall back to the cached copy offline
    e.respondWith(fetch(e.request, {cache: "no-store"}).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then(cc => cc.put(e.request, c)); }
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match("./index.html"))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

// v35: notifications sent by the relay (my run or Task ended, an RTU is free, FMS down or back)
self.addEventListener("push", e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (x) { m = {body: e.data ? e.data.text() : ""}; }
  e.waitUntil(self.registration.showNotification(m.title || "Reach Fibre Tester", {
    body: m.body || "", tag: m.tag || "rft", renotify: m.kind !== "e2e", icon: "icons/icon-192.png", badge: "icons/icon-192.png",
    vibrate: [200, 100, 200], data: {url: m.url || "./", kind: m.kind || ""}}));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const kind = (e.notification.data || {}).kind || "";
  e.waitUntil(self.clients.matchAll({type: "window", includeUncontrolled: true}).then(cs => {
    const desk = cs.find(c => c.url.includes("desktop.html")), phone = cs.find(c => !c.url.includes("desktop.html"));
    const pick = (kind === "task" || kind === "free") ? (desk || phone) : (phone || desk);
    if (pick) return pick.focus();
    return self.clients.openWindow((kind === "task" || kind === "free") && !/Mobi|Android|iPhone/.test(self.navigator.userAgent) ? "./desktop.html" : "./");
  }));
});
