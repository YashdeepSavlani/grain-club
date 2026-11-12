/* Grain Club offline support.
   The app opens straight from the saved copy on the phone, so it works with no connection at all.
   When there is a connection, a newer version is fetched in the background and used the next time the app opens. */
const CACHE = 'grainclub-v2';
const CORE = ['./', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=VT323&display=swap';

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE.map(u => new Request(u, {cache: 'reload'})));
    try { const r = await fetch(FONT_CSS, {mode: 'no-cors'}); await c.put(FONT_CSS, r); } catch (err) {}   // the font is optional
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const save = async (key, res) => {
  if (res && (res.ok || res.type === 'opaque')) { const c = await caches.open(CACHE); await c.put(key, res.clone()); }
  return res;
};

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    // saved copy first, so the app never waits on the network; refresh the copy in the background
    e.respondWith((async () => {
      const hit = await caches.match('./', {ignoreSearch: true});
      const fresh = fetch(req, {cache: 'no-store'}).then(res => save('./', res)).catch(() => null);
      if (hit) { e.waitUntil(fresh); return hit; }
      return (await fresh) || new Response('Grain Club needs one visit with internet before it works offline.', {headers: {'Content-Type': 'text/plain; charset=utf-8'}});
    })());
    return;
  }

  if (url.origin === location.origin || /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req, {ignoreSearch: url.origin === location.origin});
      const fresh = fetch(req).then(res => save(req, res)).catch(() => null);
      if (hit) { e.waitUntil(fresh); return hit; }
      return (await fresh) || Response.error();
    })());
  }
});
