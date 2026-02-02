// EchoVerse minimal SW (optional). Safe to delete if you don't want caching.
self.addEventListener('install', (e)=>{ self.skipWaiting(); });
self.addEventListener('activate', (e)=>{ e.waitUntil(self.clients.claim()); });
