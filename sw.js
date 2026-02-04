/* EchoVerse PWA Service Worker
   - Precaches app shell (no audio)
   - Runtime caching for small assets
*/

const CACHE_VERSION = "2026-02-04";
const CACHE_NAME = `echoverse-vday-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./adventure.html",
  "./offline.html",
  "./styles.css",
  "./adventure.js",
  "./pwa.js",
  "./album.json",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-192-maskable.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

async function cachePutSafe(cache, request, response) {
  try {
    if (!response || !response.ok) return;
    // Avoid caching opaque responses.
    if (response.type === "opaque") return;
    await cache.put(request, response.clone());
  } catch {
    // ignore quota/errors
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    await cachePutSafe(cache, request, response);
    return response;
  } catch {
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match("./offline.html")) ||
      Response.error()
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  const fetchPromise = fetch(request)
    .then((response) => cachePutSafe(cache, request, response))
    .catch(() => null);
  return cached || (await fetchPromise) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Range requests (audio seeking) should bypass SW caching.
  if (request.headers.has("range")) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Don’t cache audio by default (large + range behavior).
  if (request.destination === "audio" || url.pathname.endsWith(".mp3")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  const isSmallStatic =
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    url.pathname.endsWith(".json") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png");

  if (isSmallStatic) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

