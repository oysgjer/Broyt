// Enkel service worker for Brøyterute v9.11
const CACHE_NAME = 'broyterute-v911';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './del-A.html',
  './del-B.css',
  './del-C.js',
  './del-D.js',
  './del-E.js',
  './del-F.js',
  './del-G.js',
  './del-H.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        FILES_TO_CACHE.map(url =>
          fetch(url).then(resp => {
            if (!resp.ok) throw new Error(`Feil ved lasting av ${url}`);
            return cache.put(url, resp);
          }).catch(err => console.warn('⚠️ Hopper over:', url, err.message))
        )
      ))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});