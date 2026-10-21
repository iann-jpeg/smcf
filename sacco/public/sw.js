const CACHE_NAME = "smcf-shell-v2";
const BASE = new URL("./", self.registration.scope).pathname;
const SHELL = [
  BASE,
  `${BASE}index.html`,
  `${BASE}manifest.webmanifest`,
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL).catch(() => undefined)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).pathname.includes("/api/")) return;
  event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match(`${BASE}index.html`))));
});
