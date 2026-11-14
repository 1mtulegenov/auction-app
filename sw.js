/* Сервис-воркер: приложение открывается без интернета, данные обновляются при каждом запуске со связью. */
const VERSION = 'f97af2af7c';
const SHELL = 'shell-' + VERSION, DATA = 'data-v1';
const FILES = ['./', 'index.html', 'app.css', 'fonts.css', 'i18n.js', 'app.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'vendor/zxing.min.js', 'scan-worker.js', 'vinline.js', 'firebase-config.js', 'sync.js', 'obd.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('/data/index.json')) { e.respondWith(netFirst(e.request)); return; }
  if (u.pathname.includes('/data/')) { e.respondWith(dataFile(e.request)); return; }
  if (e.request.mode === 'navigate') { e.respondWith(shellFirst(new Request('index.html'))); return; }
  if (/\.(js|css|html|webmanifest)$/.test(u.pathname) && !u.pathname.includes('/vendor/') && !u.pathname.endsWith('scan-worker.js') && !u.pathname.endsWith('vinline.js')) { e.respondWith(shellFirst(e.request)); return; }
  if (u.pathname.includes('/vendor/')) { e.respondWith(caches.open('vendor-v1').then(async c => (await c.match(e.request, { ignoreSearch: true })) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }))); return; }
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

// Оболочка: сначала сеть (до 3 с), чтобы новые функции появлялись сразу; без связи — из кэша.
async function shellFirst(req) {
  const c = await caches.open(SHELL);
  try {
    const r = await Promise.race([fetch(req, { cache: 'no-cache' }), new Promise((_, no) => setTimeout(no, 3000))]);
    if (r && r.ok) { c.put(req, r.clone()); return r; }
    throw 0;
  } catch (e) { return (await c.match(req, { ignoreSearch: true })) || fetch(req); }
}

// Пуш-уведомления: новый аукцион, пост-сейл и т. д. Текст приходит от GitHub Actions (tools/notify.mjs).
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Аукционы', { body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || 'auc', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { const c = cs.find(w => w.url.startsWith(self.registration.scope)); if (c) { c.focus(); return c.navigate ? c.navigate(url).catch(() => {}) : null; } return self.clients.openWindow(url); }));
});
