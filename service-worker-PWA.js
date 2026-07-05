const CACHE_NAME = "finize-PWA-v1";

const APP_SHELL = [
  "./",
  "./index-PWA.html",
  "./manifest-PWA.json",
  "./icons-PWA/finize-PWA-icon-192.png",
  "./icons-PWA/finize-PWA-icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).catch(() => caches.match("./index-PWA.html"));
    })
  );
});
