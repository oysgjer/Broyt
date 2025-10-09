// sw.js — Brøyterute v9.7
const CACHE_NAME = 'broyterute-v9-7-2025-10-xx';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Installer: pre-cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Aktivér: rydde gamle cacher
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.map((k) => {
            if (k !== CACHE_NAME && k.startsWith('broyterute-')) {
              return caches.delete(k);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Henting: network-first for index.html, ellers cache-first for same-origin GET
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // La eksterne kall (f.eks. JSONBin) gå rett til nett
  if (url.origin !== location.origin) return;

  // Network-first for selve app-skallet (hindrer "hvit side" og gammel cache)
  if (url.pathname === '/' || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return resp;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  // Cache-first for alt annet same-origin (ikon, manifest, osv.)
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return resp;
        })
        .catch(() => {
          // Fallback til index om ønskelig
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 504, statusText: 'Offline' });
        });
    })
  );
});