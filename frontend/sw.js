// Service Worker: macht die Seite installierbar und zeigt sie auch ohne Netz an.
// Strategie "Netzwerk zuerst": Updates kommen sofort an, der Cache ist nur der Fallback.
// API-Aufrufe (/api/...) werden nie gecacht.
const CACHE = 'palast-v1';
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/data.js', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

    event.respondWith(
        fetch(event.request)
            .then(res => {
                if (res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then(cache => cache.put(event.request, copy));
                }
                return res;
            })
            .catch(() => caches.match(event.request, { ignoreSearch: true })
                .then(cached => cached || caches.match('/index.html')))
    );
});
