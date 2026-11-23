// Пуш-уведомления всем установившим приложение. Запускается GitHub Actions (.github/workflows/notify.yml)
// после пуша с изменённым data/index.json: новый день аукциона, новые машины в дне, пост-сейл (первый и обновления),
// сохранённые поиски по новым машинам. Или вручную (TITLE/BODY).
// Подписки: Firestore push/{id} (endpoint + ключи). Отправка подписана ключом VAPID из секрета VAPID_PRIVATE.
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const PROJECT = 'auction-app-3bf47', API_KEY = 'AIzaSyD1H9pdpsd3EUsJchg7w0bZVoMpFQMa7yg';
const URL_APP = 'https://1mtulegenov.github.io/auction-app/';
const PUB = process.env.VAPID_PUBLIC, PRIV = process.env.VAPID_PRIVATE;

// «Скоро начнётся»: недельное расписание (Хьюстон). wd: 0=вс … 6=сб.
const SCHED = [
  { wd: 2, t: '08:00', name: 'CarMax Conroe' },
  { wd: 2, t: '12:15', name: 'AAA North Houston (Conroe)' },
  { wd: 3, t: '11:45', name: 'AAA Central Houston' },
  { wd: 3, t: '16:30', name: "Houston's 1st Choice" },
  { wd: 4, t: '13:00', name: 'AAA Houston' },
  { wd: 5, t: '09:15', name: 'AutoNation AA Houston' },
];
const LEAD = 45; // минут до начала: окно, в котором шлём «скоро начнётся»
function chicagoNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), min: (+p.hour % 24) * 60 + +p.minute, day: `${p.year}-${p.month}-${p.day}` };
}
function upcoming() {
  const n = chicagoNow();
  for (const a of SCHED) {
    if (a.wd !== n.wd) continue;
    const [h, m] = a.t.split(':').map(Number), left = h * 60 + m - n.min;
    if (left > 0 && left <= LEAD) return { ...a, left, key: n.day + '-' + a.t.replace(':', '') };
  }
  return null;
}
if (process.argv[2] === 'which') { const u = upcoming(); console.log(u ? u.key : ''); process.exit(0); }


const read = rev => { try { return JSON.parse(execSync(`git show ${rev}:data/index.json`, { encoding: 'utf8' })); } catch { return { dates: [] }; } };
const msgs = [], scan = new Map(); // scan: дата -> машины, по которым прогнать сохранённые поиски
const readData = (rev, id) => { try { return JSON.parse(execSync(`git show ${rev}:data/${id}.json`, { encoding: 'utf8', maxBuffer: 1 << 28 })); } catch { return null; } };
if (process.env.MODE === 'soon') {
  const u = upcoming();
  if (u) {
    const ix = read('HEAD'), d = ix.dates.find(x => x.id === chicagoNow().day);
    msgs.push({ title: 'Скоро аукцион: ' + u.name, body: 'Начало в ' + u.t + ', через ' + u.left + ' мин.' + (d ? ' В каталоге ' + d.n + ' машин' + (d.core ? ', в подборке ' + d.core : '') + '.' : ''), tag: 'soon-' + u.key });
  }
} else if (process.env.TITLE) msgs.push({ title: process.env.TITLE, body: process.env.BODY || '', tag: 'manual' });
else {
  const now = read('HEAD'), old = read('HEAD~1');
  const om = new Map(old.dates.map(d => [d.id, d]));
  const lk = x => (x.auc || '') + '|' + (x.run || x.vin || '');
  for (const d of now.dates) {
    const o = om.get(d.id);
    if (!o) {
      msgs.push({ title: 'Новый аукцион: ' + d.label, body: d.title + '. Машин: ' + d.n + (d.core ? ', в подборке ' + d.core : '') + '.', tag: 'new-' + d.id });
      const D = readData('HEAD', d.id); if (D) scan.set(d.id, D.lots);
      continue;
    }
    if (d.results && !o.results) {
      let st = (readData('HEAD', d.id) || {}).stats || {};
      const parts = [];
      if (st.n != null) parts.push('продано ' + st.n);
      if (st.off) parts.push('на оффере ' + st.off);
      if (st.u != null) parts.push('не продано ' + st.u);
      msgs.push({ title: 'Пост-сейл: ' + d.label, body: d.title + (parts.length ? '. Итоги: ' + parts.join(', ') + '.' : '. Итоги загружены.'), tag: 'res-' + d.id });
      continue;
    }
    // та же дата обновилась: добавились машины (новый аукцион в тот же день) или поменялся пост-сейл
    const A = readData('HEAD~1', d.id), B = readData('HEAD', d.id);
    if (!A || !B) continue;
    const am = new Map(A.lots.map(x => [lk(x), x]));
    const added = B.lots.filter(x => !am.has(lk(x)));
    if (added.length) {
      const extra = d.title !== o.title ? d.title + '. ' : '';
      msgs.push({ title: 'Обновлён аукцион: ' + d.label, body: extra + 'Добавлено машин: ' + added.length + ', всего ' + d.n + (d.core ? ', в подборке ' + d.core : '') + '.', tag: 'upd-' + d.id });
      scan.set(d.id, added);
    }
    if (d.results) {
      let sold = 0, none = 0, ch = 0;
      for (const x of B.lots) {
        const y = am.get(lk(x)); if (!y) continue;
        if ((x.ss || '') === (y.ss || '') && (x.fact || null) === (y.fact || null)) continue;
        ch++; if (x.ss === 'sold') sold++; else if (x.ss === 'none') none++;
      }
      if (ch) {
        const parts = [];
        if (sold) parts.push('продано ' + sold);
        if (none) parts.push('отказ ' + none);
        msgs.push({ title: 'Пост-сейл обновлён: ' + d.label, body: d.title + '. Изменилось машин: ' + ch + (parts.length ? ' (' + parts.join(', ') + ')' : '') + '.', tag: 'res-' + d.id });
      }
    }
  }
}
if (!msgs.length && !scan.size) { console.log('Новых аукционов, машин и пост-сейлов нет'); process.exit(0); }

if (process.env.DRY) { console.log(JSON.stringify(msgs, null, 1)); console.log('поиск по:', [...scan].map(([k, v]) => k + ' ' + v.length).join(', ')); process.exit(0); }
if (!PRIV) { console.log('::notice::VAPID_PRIVATE не задан в секретах репозитория, уведомления не отправлены'); process.exit(0); }
const webpush = (await import('web-push')).default;
webpush.setVapidDetails(URL_APP, PUB, PRIV);

let subs = [], searches = [], tok = '';
// Firestore REST -> обычные значения
const val = v => v == null ? null : 'stringValue' in v ? v.stringValue : 'integerValue' in v ? +v.integerValue : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue
  : 'arrayValue' in v ? (v.arrayValue.values || []).map(val) : 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)])) : null;
do {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/push?pageSize=300&key=${API_KEY}` + (tok ? '&pageToken=' + tok : ''));
  const j = await r.json();
  if (!r.ok) { console.log('::warning::Firestore:', JSON.stringify(j).slice(0, 300)); break; }
  for (const d of j.documents || []) {
    const f = Object.fromEntries(Object.entries(d.fields || {}).map(([k, x]) => [k, val(x)]));
    if (f.type === 'searches') { searches.push(f); continue; }
    if (f.endpoint && f.keys && f.keys.p256dh && f.keys.auth) subs.push({ endpoint: f.endpoint, keys: { p256dh: f.keys.p256dh, auth: f.keys.auth }, uid: f.uid || '' });
  }
  tok = j.nextPageToken || '';
} while (tok);
console.log('Подписок:', subs.length, 'поисков:', searches.reduce((a, d) => a + (d.list || []).length, 0), 'сообщений:', msgs.length);

let ok = 0, gone = 0, err = 0;
const send = (list, msg) => Promise.all(list.map(s => webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(msg), { TTL: 43200 }).then(() => ok++)
  .catch(e => { if (e.statusCode === 404 || e.statusCode === 410) gone++; else { err++; console.log('ошибка', e.statusCode, (e.body || '').slice(0, 200)); } })));

// несколько событий за раз — одно уведомление, чтобы не засыпать телефон
if (msgs.length) {
  const m = msgs.length === 1 ? msgs[0] : { title: msgs.map(x => x.title).join(' · '), body: msgs.map(x => x.body).join(' '), tag: 'multi' };
  await send(subs, { ...m, url: URL_APP });
}

// сохранённые поиски: на новом аукционе есть совпадения — пуш владельцу поиска, по нажатию список карточек
if (scan.size && searches.length) {
  const { createRequire } = await import('node:module');
  const SM = createRequire(import.meta.url)('../search-match.js');
  const ix = read('HEAD');
  for (const [id, lots] of scan) {
    const dd = ix.dates.find(x => x.id === id) || { label: id, title: '' };
    for (const doc of searches) {
      const mine = subs.filter(s => s.uid && s.uid === doc.uid);
      if (!mine.length) { console.log('Поиски без подписки на этом устройстве:', (doc.list || []).length); continue; }
      for (const sr of doc.list || []) {
        if (!sr || sr.on === false || !sr.q) continue;
        const hit = lots.filter(x => SM.match(x, sr.q));
        console.log('Поиск', sr.name, id, '->', hit.length);
        if (!hit.length) continue;
        const names = hit.slice(0, 3).map(x => [x.y, x.mk, x.md].filter(Boolean).join(' ')).join(', ');
        await send(mine, { title: 'По вашему поиску «' + (sr.name || 'Поиск') + '»: ' + hit.length, body: dd.label + ', ' + String(dd.title).split(',')[0] + '. ' + names + (hit.length > 3 ? ' и ещё ' + (hit.length - 3) : '') + '.', tag: 'srch-' + sr.id + '-' + id, url: URL_APP + '?s=' + encodeURIComponent(sr.id) + '&d=' + id });
      }
    }
  }
}
console.log(`Отправлено: ${ok}, устаревших подписок: ${gone}, ошибок: ${err}`);
