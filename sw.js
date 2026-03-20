const CACHE_NAME = 'skydeck-static-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/constants.js',
  './js/utils.js',
  './js/api.js',
  './js/ui.js',
  './js/app.js',
  './assets/skydeck-mark.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys
      .filter(key => key !== CACHE_NAME)
      .map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        return cached;
      }
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
