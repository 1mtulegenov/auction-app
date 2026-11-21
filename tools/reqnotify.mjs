// Пуш администратору о новых заявках покупателей. Запускается по расписанию (.github/workflows/requests.yml).
// Покупатель при заявке пишет в Firestore reqping/{id} только время (без личных данных); подписки администратора
// помечены admin:true. Уже отправленные id хранятся в .req-sent/ids (кэш GitHub Actions).
import fs from 'node:fs';
const PROJECT = 'auction-app-3bf47', API_KEY = 'AIzaSyD1H9pdpsd3EUsJchg7w0bZVoMpFQMa7yg', URL_APP = 'https://1mtulegenov.github.io/auction-app/';
const PUB = process.env.VAPID_PUBLIC, PRIV = process.env.VAPID_PRIVATE;
const val = v => v == null ? null : 'stringValue' in v ? v.stringValue : 'booleanValue' in v ? v.booleanValue : 'timestampValue' in v ? v.timestampValue
  : 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)])) : null;
async function list(col) {
  const out = []; let tok = '';
  do {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${col}?pageSize=300&key=${API_KEY}` + (tok ? '&pageToken=' + tok : ''));
    const j = await r.json(); if (!r.ok) { console.log('::warning::Firestore', col, JSON.stringify(j).slice(0, 200)); break; }
    for (const d of j.documents || []) out.push({ id: d.name.split('/').pop(), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, x]) => [k, val(x)])) });
    tok = j.nextPageToken || '';
  } while (tok);
  return out;
}
const sentF = '.req-sent/ids', sent = new Set(fs.existsSync(sentF) ? fs.readFileSync(sentF, 'utf8').split('\n').filter(Boolean) : []);
const lim = Date.now() - 3 * 864e5;
const fresh = (await list('reqping')).filter(p => !sent.has(p.id) && (!p.at || Date.parse(p.at) > lim));
console.log('Новых заявок:', fresh.length);
if (!fresh.length) process.exit(0);
if (!PRIV) { console.log('::notice::VAPID_PRIVATE не задан'); process.exit(0); }
const webpush = (await import('web-push')).default; webpush.setVapidDetails(URL_APP, PUB, PRIV);
const subs = (await list('push')).filter(s => s.admin === true && s.endpoint && s.keys);
console.log('Подписок администратора:', subs.length);
const msg = { title: fresh.length === 1 ? 'Новая заявка покупателя' : 'Новые заявки покупателей: ' + fresh.length, body: 'Откройте «Ещё → Покупатели», чтобы разрешить вход и назначить дилера.', tag: 'buyer-req', url: URL_APP };
let ok = 0;
await Promise.all(subs.map(s => webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, JSON.stringify(msg), { TTL: 43200 }).then(() => ok++).catch(e => console.log('ошибка', e.statusCode))));
console.log('Отправлено:', ok);
fs.mkdirSync('.req-sent', { recursive: true });
fs.writeFileSync(sentF, [...sent, ...fresh.map(p => p.id)].slice(-2000).join('\n')); fs.writeFileSync('req-changed', '1');
