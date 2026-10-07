const CACHE_NAME = "finize-v110-personal-income-overview";
const CACHE_PREFIX = "finize-";

const CRITICAL_SHELL = [
  "./",
  "./index.html",
  "./app.js?v=110-personal-income-overview",
  "./app.css?v=110-personal-income-overview",
  "./manifest.json"
];

const OPTIONAL_SHELL = [
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(CRITICAL_SHELL);
      for (const shell of ["./", "./index.html"]) {
        const response = await cache.match(shell);
        if (!response?.ok || !isCurrentShellHtml(await response.text())) {
          await caches.delete(CACHE_NAME);
          throw new Error("Finize offline shell heeft een andere assetversie.");
        }
      }
      await Promise.allSettled(OPTIONAL_SHELL.map(asset => cache.add(asset)));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isCurrentShellHtml(html) {
  const script = html.match(/<script\b[^>]*\bsrc=["']([^"']*app\.js\?v=[^"']+)["']/)?.[1];
  const style = html.match(/<link\b[^>]*\bhref=["']([^"']*app\.css\?v=[^"']+)["']/)?.[1];
  return CRITICAL_SHELL.includes(script) && CRITICAL_SHELL.includes(style);
}

async function cacheNavigationShell(response) {
  if (!response.ok) return;
  const html = await response.clone().text();
  // A failed/incomplete next release must not replace the working offline shell.
  if (!isCurrentShellHtml(html)) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put("./index.html", response.clone());
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(async response => {
          await cacheNavigationShell(response).catch(() => {});
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
