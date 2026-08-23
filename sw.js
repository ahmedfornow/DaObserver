/* DaObserver service worker — offline shell only.
 *
 * Rule that matters most: anything going to Supabase is never inspected,
 * never cached, never served from cache. It carries the auth token and every
 * private row in the app. It goes straight to the network or it fails.
 *
 * Bump VERSION whenever index.html changes so old caches are dropped.
 */
const VERSION = 'v3.7.0';
const SHELL = 'daobserver-shell-' + VERSION;
const RUNTIME = 'daobserver-runtime-' + VERSION;

const PRECACHE = [
  './',
  './index.html',
  './hero.jpg',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

// Third-party libraries the app loads. Cached so a cold offline start still
// boots; only ever stored when the response is a real, readable 200.
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    // allSettled: one missing asset must not abort the whole install
    await Promise.allSettled(PRECACHE.map(u => c.add(new Request(u, { cache: 'reload' }))));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // --- never touch the database traffic ---
  if (url.hostname.endsWith('.supabase.co')) return;

  // --- the app document: network-first, so a redeploy lands immediately ---
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const c = await caches.open(SHELL);
          c.put('./index.html', fresh.clone());
        }
        return fresh;
      } catch (err) {
        const hit = await caches.match('./index.html') || await caches.match('./');
        return hit || new Response('غير متصل', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // --- our own static assets: cache-first ---
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok) { const c = await caches.open(SHELL); c.put(req, res.clone()); }
        return res;
      } catch (err) {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  // --- CDN libraries: stale-while-revalidate ---
  if (CDN.test(req.url)) {
    e.respondWith((async () => {
      const c = await caches.open(RUNTIME);
      const hit = await c.match(req);
      const net = fetch(req).then(res => {
        if (res && res.ok) c.put(req, res.clone());
        return res;
      }).catch(() => null);
      return hit || (await net) || new Response('', { status: 504 });
    })());
  }
});
