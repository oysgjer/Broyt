/* Brøyterute – v9.10 Service Worker */
const CACHE_NAME = 'broyterute-v9.10';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // legg til ikonbanene du faktisk har:
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
      await self.clients.claim();
    })()
  );
});

/* Strategier:
   - Navigasjon: returner index (SPA) – funker offline.
   - Egen-origin statiske filer: stale-while-revalidate.
   - Kryss-origin (jsonbin, open-meteo, maps): gå rett til nett, ikke cache. */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Bare GET caches
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigasjoner -> index.html (SPA-fallback)
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req);
          return net;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match('./index.html')) || Response.error();
        }
      })()
    );
    return;
  }

  // Kryss-origin: ikke cache (jsonbin, vær, maps osv.)
  if (!sameOrigin) {
    return; // fall-through til nett
  }

  // Same-origin statiske assets: stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then((netRes) => {
          if (netRes && netRes.status === 200) cache.put(req, netRes.clone());
          return netRes;
        })
        .catch(() => null);

      // Returner cache hvis vi har, ellers vent på nett
      return cached || (await fetchPromise) || new Response('', { status: 504 });
    })()
  );
});

/* Håndter meldinger (for hard reset/oppdatering) */
self.addEventListener('message', async (event) => {
  const { type } = event.data || {};
  if (type === 'SKIP_WAITING') {
    await self.skipWaiting();
    return;
  }
  if (type === 'CLEAR_CACHES') {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    event.source && event.source.postMessage({ type: 'CACHES_CLEARED' });
  }
});
