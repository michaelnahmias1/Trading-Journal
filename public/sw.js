// Minimal, loop-proof service worker. It exists to make the app installable and
// to cache only IMMUTABLE assets (content-hashed build files + icons). It must
// NEVER serve app HTML or RSC/data from cache.
//
// Why: a cached (stale) app shell can reference build chunks that a newer deploy
// has removed. Next.js then throws a ChunkLoadError and reloads the page — which
// loads the same stale shell again, looping forever ("the page won't stop
// refreshing"). Keeping app code/data network-only guarantees users always run
// the latest build and removes that failure mode entirely.
//
// Bump CACHE on any change here so `activate` purges previous caches (including
// the old v3 shell cache that pinned dynamic HTML).
const CACHE = "tj-static-v4";
const PRECACHE = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // third-party: leave untouched

  // App code & data are ALWAYS live (network handles them, never the cache):
  //   - navigations (full document loads)
  //   - RSC / App Router data fetches
  //   - API & auth routes
  const isRsc = request.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  const isData =
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/_next/data/");
  if (request.mode === "navigate" || isRsc || isData) return;

  // Cache-first ONLY for things whose bytes never change for a given URL:
  // content-hashed build output and our static icons/fonts. A new deploy uses
  // new URLs, so this can never serve a stale-but-referenced chunk.
  const isImmutable =
    url.pathname.startsWith("/_next/static/") ||
    PRECACHE.includes(url.pathname) ||
    /\.(?:png|jpe?g|gif|webp|svg|ico|woff2?)$/.test(url.pathname);
  if (!isImmutable) return; // everything else: plain network

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
