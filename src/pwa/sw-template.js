/* global __IDL_PRECACHE__ */
/* idl service worker.
 * Precaches the full app shell (every built asset) at install time so the app
 * and all games launch with no network. The precache list and version are
 * injected at build time by the `idlServiceWorker` Vite plugin.
 */
const VERSION = '__IDL_VERSION__';
const PRECACHE = __IDL_PRECACHE__;
const CACHE = `idl-shell-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('idl-shell-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations always resolve to the cached app shell (hash routing means
  // every screen is index.html). Fall back to the network only if the cache
  // is somehow missing.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const shell = await cache.match('./index.html');
        if (shell) return shell;
        try {
          return await fetch(request);
        } catch {
          return new Response('<!doctype html><meta charset="utf-8"><title>idl</title><p style="font-family:sans-serif;padding:2rem">idl needs one online visit to finish installing. Reconnect and reload.</p>', { headers: { 'Content-Type': 'text/html' } });
        }
      })(),
    );
    return;
  }

  // Static assets: cache first, then network (and remember what we fetched).
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok && res.type === 'basic') cache.put(request, res.clone());
      return res;
    })(),
  );
});
