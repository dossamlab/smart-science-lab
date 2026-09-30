// Offline support for lab tablets: the app, SOS contacts and safety guides open without Wi-Fi,
// and MSDS cards already viewed stay readable. AI, admin and reservations always need the network.
// ponytail: one cache, old hashed assets are never pruned; bump CACHE to clear it if it ever grows too large.
const CACHE = 'lab-on-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/favicon.png', '/manifest.webmanifest'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

const store = (key, response) => {
  if (response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(key, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Apps Script, KOSHA links: network only
  if (url.pathname.startsWith('/api/admin')) return;

  if (request.mode === 'navigate') {
    // Every route is the same SPA page: fresh when online, the saved copy when offline.
    event.respondWith(fetch(request).then(res => store('/', res)).catch(() => caches.match('/')));
    return;
  }
  if (url.pathname.startsWith('/assets/')) {
    // Hashed file names never change content.
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(res => store(request, res))));
    return;
  }
  // /api/msds and other same-origin files: network first, last good copy when offline.
  event.respondWith(fetch(request).then(res => store(request, res)).catch(() => caches.match(request)));
});
