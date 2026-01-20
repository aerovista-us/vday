const CACHE = "ev-player-v1";
const CORE_PATHS = [
  "/",
  "/index.html",
  "/album.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE_PATHS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const pathname = url.pathname;

  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Cache-first for core + images, network-first for audio
  const isAudio = pathname.endsWith(".mp3") || pathname.endsWith(".wav") || pathname.endsWith(".m4a");
  const isImage = pathname.match(/\.(png|jpg|jpeg|webp|svg)$/i);
  const isCore = CORE_PATHS.includes(pathname) || pathname === "/" || pathname === "/index.html";

  if (isAudio) {
    // Network-first for audio (try network, fallback to cache)
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  if (isImage || isCore) {
    // Cache-first for images and core files
    e.respondWith(
      caches.match(e.request).then(hit => {
        if (hit) return hit;
        return fetch(e.request).then(res => {
          // Only cache successful responses
          if (res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // Default: network-first with cache fallback
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
