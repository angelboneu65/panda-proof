// Panda Proof — Service Worker
const CACHE = "panda-proof-v2";

const SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
];

// Install: cache the app shell
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network first for API, cache first for assets
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Always network for API calls
  if (url.pathname.startsWith("/api")) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Cache successful GET responses
        if (e.request.method === "GET" && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
