/* Сервис-воркер: приложение открывается без интернета, данные обновляются при каждом запуске со связью. */
const VERSION = 'ce74eaf09a';
const SHELL = 'shell-' + VERSION, DATA = 'data-v1';
const FILES = ['./', 'index.html', 'app.css', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'vendor/zxing.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); });
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('/data/index.json')) { e.respondWith(netFirst(e.request)); return; }
  if (u.pathname.includes('/data/')) { e.respondWith(dataFile(e.request)); return; }
  if (e.request.mode === 'navigate') { e.respondWith(caches.match('index.html').then(r => r || fetch(e.request))); return; }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
async function netFirst(req) {
  const c = await caches.open(DATA);
  try { const r = await fetch(req, { cache: 'no-cache' }); if (r.ok) c.put('data/index.json', r.clone()); return r; }
  catch (e) { return (await c.match('data/index.json')) || Response.error(); }
}
async function dataFile(req) {
  const c = await caches.open(DATA), u = new URL(req.url);
  const name = u.pathname.split('/').pop(), v = u.searchParams.get('v');
  const hit = await c.match(req);
  if (hit) return hit;
  try {
    const r = await fetch(req);
    if (r.ok) { const old = await c.keys(); old.forEach(k => { const ku = new URL(k.url); if (ku.pathname.endsWith('/' + name) && ku.searchParams.get('v') !== v) c.delete(k); }); c.put(req, r.clone()); }
    return r;
  } catch (e) { const any = (await c.keys()).find(k => new URL(k.url).pathname.endsWith('/' + name)); return any ? c.match(any) : Response.error(); }
}
