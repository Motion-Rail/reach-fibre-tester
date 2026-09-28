// Minimal offline shell. Bump CACHE to force an update after editing the app.
const CACHE = "reachtester-v15";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest",
                "./icons/icon-192.png", "./icons/icon-512.png", "./logo.png", "./mark.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  // never cache relay/API traffic
  if (u.pathname.includes("/api/") || u.pathname.endsWith("/health")) return;
  if (u.origin !== self.location.origin) return;   // CDN (jsPDF) and relay: always network
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
