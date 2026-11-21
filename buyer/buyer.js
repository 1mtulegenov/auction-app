/* Приложение покупателя: машины, которые подобрал дилер, и калькулятор бюджета с комиссией дилера.
   Вход через Google. Покупатель видит только clients/{id}, где email = его почта, и лоты в clients/{id}/lots.
   ?demo=1 — показ без входа на примерах из последнего каталога (для проверки вида). */
const $ = s => document.querySelector(s);
const E = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const M = v => v == null || v === '' || isNaN(v) ? '—' : '$' + Math.round(Number(v)).toLocaleString('en-US');
const N = v => Number(v || 0).toLocaleString('en-US');
const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const dLong = id => { const p = String(id || '').split('-'); return p.length === 3 ? (+p[2]) + ' ' + MON[+p[1] - 1] : ''; };
const LSg = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const LSs = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const B = { tab: 'cars', user: null, clients: [], lots: {}, grid: null, calc: LSg('b-calc', { mode: 'budget', budget: 10000, price: 7000 }), F: null, db: null, auth: null, unsub: [], demo: /[?&]demo=1/.test(location.search) };

function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2600); }
function allLots() { return Object.values(B.lots).flat().sort((a, b) => (b.atMs || 0) - (a.atMs || 0) || String(b.d).localeCompare(String(a.d))); }

/* ---------- экраны ---------- */
function render() {
  $('#bTabs').hidden = !(B.user || B.demo);
  document.querySelectorAll('#bTabs button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === B.tab ? 'page' : 'false'));
  const u = $('#bUser'); u.hidden = !B.user; if (B.user) u.textContent = (B.user.name || '').split(' ')[0] || 'Профиль';
  const v = $('#view');
  if (!B.user && !B.demo) { v.innerHTML = login(); return; }
  v.innerHTML = B.tab === 'calc' ? calcScreen() : carsScreen();
  if (B.tab === 'calc') calcDraw();
}
function login(err) {
  return '<section class="b-hero"><h1>Машины, подобранные для вас</h1><p>Здесь появятся автомобили, которые ваш подборщик нашёл под ваш бюджет и пожелания: фото, описание и примерная цена. А калькулятор покажет, сколько остаётся на саму машину.</p>'
    + '<button class="btn pri b-login" data-act="login">Войти через Google</button>' + (err ? '<p class="b-err">' + E(err) + '</p>' : '') + '<p class="muted">Войдите той почтой, которую вы дали подборщику.</p></section>';
}
function carsScreen() {
  if (!B.demo && !B.clients.length) return '<section class="b-hero"><h1>Подбор пока не открыт</h1><p>Для почты <b>' + E(B.user.email) + '</b> подборщик ещё не добавил вас. Напишите ему, чтобы он открыл доступ, и обновите страницу.</p></section>';
  const L = allLots(), dealers = [...new Set(B.clients.map(c => c.dealerName).filter(Boolean))];
  const head = '<p class="b-sub">' + (dealers.length ? 'Ваш подборщик: <b>' + E(dealers.join(', ')) + '</b>' : '') + (L.length ? ' · ' + L.length + ' ' + plural(L.length, 'машина', 'машины', 'машин') : '') + '</p>';
  if (!L.length) return head + '<section class="b-empty"><p>Пока машин нет. Подборщик ищет варианты накануне торгов и пришлёт их сюда.</p></section>';
  return head + '<div class="b-list">' + L.map(car).join('') + '</div>';
}
function plural(n, a, b, c) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; }
function car(l) {
  const ph = l.photos || [], f = l.price ? feeFor(l.price, B.grid) : null;
  const title = [l.y, l.mk, l.md].filter(Boolean).join(' ');
  return '<article class="b-car" data-id="' + E(l.cid + '/' + l.id) + '">'
    + (ph.length ? '<div class="b-ph"><div class="b-ph-s">' + ph.map((u, i) => '<button data-gal="' + E(l.cid + '/' + l.id) + '" data-gi="' + i + '"><img src="' + E(u) + '" alt="" referrerpolicy="no-referrer"' + (i > 1 ? ' loading="lazy"' : '') + ' onerror="this.parentNode.remove()"></button>').join('') + '</div>' + (ph.length > 1 ? '<span class="b-ph-n">' + ph.length + ' фото</span>' : '') + '</div>' : '')
    + '<div class="b-body"><h2>' + E(title) + '</h2><p class="b-meta">' + [l.st, l.eng, l.o ? N(l.o) + ' mi' : '', l.color].filter(Boolean).map(E).join(' · ') + '</p>'
    + (l.d ? '<p class="b-date">Торги ' + dLong(l.d) + '</p>' : '')
    + (f ? '<div class="b-price"><div><span>Примерная цена машины</span><b>≈ ' + M(f.price) + '</b></div><div><span>Под ключ, всё включено</span><b>≈ ' + M(f.total) + '</b><small>сборы и комиссия ' + M(f.fee) + ' (' + f.pct + '%)</small></div></div>' : '')
    + (l.rt ? '<p class="b-rt">В автосалонах Хьюстона такая стоит около <b>' + M(l.rt) + '</b></p>' : '')
    + (l.note ? '<blockquote class="b-note">' + E(l.note) + (l.by ? '<cite>' + E(l.by) + '</cite>' : '') + '</blockquote>' : '')
    + '<div class="b-act"><button class="btn' + (l.reaction === 'like' ? ' on' : '') + '" data-act="like">' + (l.reaction === 'like' ? '♥ Интересно' : '♡ Интересно') + '</button><button class="btn' + (l.reaction === 'no' ? ' on-no' : '') + '" data-act="no">Не подходит</button><button class="btn" data-act="ask">Вопрос</button></div>'
    + (l.reply ? '<p class="b-reply">Вы написали: ' + E(l.reply) + '</p>' : '')
    + '</div></article>';
}
function calcScreen() {
  const c = B.calc, cf = feeCfg(B.grid);
  return '<section class="b-calc"><div class="seg b-seg"><button data-mode="budget" aria-pressed="' + (c.mode === 'budget') + '">У меня есть бюджет</button><button data-mode="price" aria-pressed="' + (c.mode === 'price') + '">Знаю цену машины</button></div>'
    + '<label class="b-in"><span>' + (c.mode === 'budget' ? 'Сколько всего готовы потратить' : 'Цена машины') + '</span><span class="b-inw">$<input id="calcIn" type="number" inputmode="numeric" value="' + E(c.mode === 'budget' ? c.budget : c.price) + '"></span></label>'
    + '<div class="b-res" id="calcRes"></div>'
    + '<details class="b-grid"><summary>Что входит и как считается</summary><p class="muted" style="margin-top:10px">Один процент от цены машины, в который входит всё: сбор аукциона, оформление и документы, работа подборщика. Чем дороже машина, тем меньше процент. Между точками он меняется плавно, без скачков.</p><table>' + cf.grid.map(r => '<tr><td>Машина ' + M(r.at) + '</td><td>' + r.pct + '%, ' + M(Math.max(cf.min, r.at * r.pct / 100)) + '</td></tr>').join('') + '</table><p class="muted">' + (cf.min ? 'Минимум ' + M(cf.min) + '. ' : '') + 'Налог с продажи, регистрация и доставка считаются отдельно.</p></details></section>';
}
function calcDraw() {
  const c = B.calc, v = +($('#calcIn') || {}).value || 0, el = $('#calcRes'); if (!el) return;
  if (c.mode === 'budget') { c.budget = v; const r = carFromBudget(v, B.grid);
    el.innerHTML = '<div class="b-big"><span>На машину остаётся</span><b>' + M(r.price) + '</b></div><div class="b-rows"><div><span>Сборы и комиссия (' + r.pct + '%)</span><b>' + M(r.fee) + '</b></div><div class="tot"><span>Всего под ключ</span><b>' + M(r.total) + '</b></div></div>'
      + (allLots().length ? '<p class="b-fit">' + fitText(r.price) + '</p>' : '');
  } else { c.price = v; const r = feeFor(v, B.grid);
    el.innerHTML = '<div class="b-big"><span>Всего под ключ</span><b>' + M(r.total) + '</b></div><div class="b-rows"><div><span>Машина</span><b>' + M(r.price) + '</b></div><div><span>Сборы и комиссия (' + r.pct + '%)</span><b>' + M(r.fee) + '</b></div></div>';
  }
  LSs('b-calc', c);
}
function fitText(max) { const L = allLots().filter(l => l.price), ok = L.filter(l => l.price <= max).length; return L.length ? 'Из присланных машин в этот бюджет укладывается ' + ok + ' из ' + L.length + '.' : ''; }

/* ---------- галерея ---------- */
function openGal(key, i) {
  const [cid, id] = key.split('/'), l = (B.lots[cid] || []).find(x => x.id === id); if (!l) return;
  const ph = l.photos || []; const g = document.createElement('div'); g.className = 'gal'; g.id = 'gal';
  g.innerHTML = '<div class="gal-h"><span class="gal-n" id="galN">' + (i + 1) + ' / ' + ph.length + '</span><span class="gal-t">' + E([l.y, l.mk, l.md].join(' ')) + '</span><button data-act="gal-close" aria-label="Закрыть">✕</button></div><div class="gal-s" id="galS">' + ph.map((u, j) => '<figure><img src="' + E(u) + '" alt="" referrerpolicy="no-referrer"' + (Math.abs(j - i) > 1 ? ' loading="lazy"' : '') + '></figure>').join('') + '</div>';
  document.body.appendChild(g); document.body.classList.add('gal-on');
  const s = $('#galS'); s.scrollLeft = i * s.clientWidth;
  s.addEventListener('scroll', () => { $('#galN').textContent = (Math.round(s.scrollLeft / s.clientWidth) + 1) + ' / ' + ph.length; }, { passive: true });
  s.addEventListener('click', e => { const f = e.target.closest('figure'); if (f) f.classList.toggle('z'); });
  try { history.pushState({ gal: 1 }, ''); } catch (e) {}
}
function closeGal(fromPop) { const g = $('#gal'); if (!g) return; g.remove(); document.body.classList.remove('gal-on'); if (!fromPop) try { history.back(); } catch (e) {} }
window.addEventListener('popstate', () => closeGal(true));

/* ---------- действия ---------- */
document.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return; const ds = t.dataset;
  if (ds.tab) { B.tab = ds.tab; render(); window.scrollTo(0, 0); return; }
  if (ds.mode) { B.calc.mode = ds.mode; render(); return; }
  if (ds.gal) { openGal(ds.gal, +ds.gi || 0); return; }
  if (t.id === 'bUser') { if (confirmOut()) { await B.F.au.signOut(B.auth); } return; }
  const card = t.closest('.b-car'), key = card && card.dataset.id;
  switch (ds.act) {
    case 'login': signIn(); break;
    case 'gal-close': closeGal(); break;
    case 'like': case 'no': { const l = find(key); if (!l) break; await react(l, { reaction: l.reaction === ds.act ? '' : ds.act }); break; }
    case 'ask': { const l = find(key); if (!l) break; const box = card.querySelector('.b-ask'); if (box) { box.remove(); break; } card.querySelector('.b-act').insertAdjacentHTML('afterend', '<div class="b-ask"><textarea rows="3" placeholder="Например: можно посмотреть вживую? какой расход?">' + E(l.reply || '') + '</textarea><button class="btn pri" data-act="ask-send">Отправить подборщику</button></div>'); card.querySelector('.b-ask textarea').focus(); break; }
    case 'ask-send': { const l = find(key); const tx = card.querySelector('.b-ask textarea').value.trim(); if (!l || !tx) break; await react(l, { reply: tx, replyAt: new Date().toISOString() }); toast('Отправлено подборщику'); break; }
  }
});
function confirmOut() { const b = $('#bUser'); if (b.dataset.armed) { delete b.dataset.armed; return true; } b.dataset.armed = 1; b.textContent = 'Выйти?'; setTimeout(() => { delete b.dataset.armed; render(); }, 3000); return false; }
document.addEventListener('input', e => { if (e.target.id === 'calcIn') calcDraw(); });
function find(key) { if (!key) return null; const [cid, id] = key.split('/'); return (B.lots[cid] || []).find(x => x.id === id); }
async function react(l, patch) {
  Object.assign(l, patch);
  if (B.demo) { render(); return; }
  try { await B.F.fs.updateDoc(B.F.fs.doc(B.db, 'clients', l.cid, 'lots', l.id), patch); } catch (e) { toast('Не сохранилось: нет связи или доступа'); }
  render();
}

/* ---------- Firebase ---------- */
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
async function init() {
  if (B.demo) { await demo(); render(); return; }
  const cfg = window.FIREBASE_CONFIG;
  try {
    const [app, au, fs] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
    B.F = { au, fs }; const a = app.initializeApp(cfg, 'buyer'); B.auth = au.getAuth(a); B.db = fs.getFirestore(a);
    await au.setPersistence(B.auth, au.browserLocalPersistence).catch(() => {});
    au.getRedirectResult(B.auth).catch(e => { $('#view').innerHTML = login(errText(e)); });
    au.onAuthStateChanged(B.auth, u => { B.user = u ? { uid: u.uid, name: u.displayName || u.email, email: (u.email || '').toLowerCase() } : null; if (u) start(); else { stop(); render(); } });
  } catch (e) { $('#view').innerHTML = login('Нет связи. Для входа нужен интернет.'); }
}
function errText(e) { const c = (e && e.code) || ''; if (/popup-closed|cancelled/.test(c)) return 'Окно входа закрылось. Попробуйте ещё раз.'; if (/network/.test(c)) return 'Нет связи.'; return (e && e.message) || String(e); }
async function signIn() {
  const p = new B.F.au.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  try { if (standalone) await B.F.au.signInWithRedirect(B.auth, p); else await B.F.au.signInWithPopup(B.auth, p); }
  catch (e) { if (/popup-blocked|operation-not-supported/.test(e.code || '')) { try { await B.F.au.signInWithRedirect(B.auth, p); } catch (e2) { $('#view').innerHTML = login(errText(e2)); } } else $('#view').innerHTML = login(errText(e)); }
}
function stop() { B.unsub.forEach(f => { try { f(); } catch (e) {} }); B.unsub = []; B.clients = []; B.lots = {}; }
async function start() {
  stop(); const { collection, query, where, getDocs, onSnapshot, getDoc, doc } = B.F.fs;
  try { const d = await getDoc(doc(B.db, 'config', 'fees')); if (d.exists()) B.grid = d.data(); } catch (e) {}
  try { const s = await getDocs(query(collection(B.db, 'clients'), where('email', '==', B.user.email))); s.forEach(d => B.clients.push(Object.assign({ id: d.id }, d.data()))); }
  catch (e) { console.warn(e); }
  render();
  for (const c of B.clients) B.unsub.push(onSnapshot(collection(B.db, 'clients', c.id, 'lots'), qs => {
    B.lots[c.id] = []; qs.forEach(d => { const x = d.data(); B.lots[c.id].push(Object.assign({}, x, { id: d.id, cid: c.id, atMs: x.at && x.at.toMillis ? x.at.toMillis() : 0 })); });
    const a = document.activeElement; if (a && a.closest && a.closest('.b-ask')) return; if (!$('#gal')) render(); else if (B.tab === 'calc') calcDraw();
  }, e => console.warn(e)));
}
// пример без входа: лучшие машины из последнего каталога
async function demo() {
  B.clients = [{ id: 'demo', dealerName: 'Михаил' }];
  try {
    const idx = await (await fetch('../data/index.json')).json(), d = await (await fetch('../data/' + idx.dates[0].id + '.json?v=' + idx.version)).json();
    const COL = { BLACK: 'чёрный', WHITE: 'белый', GRAY: 'серый', SILVER: 'серебристый', RED: 'красный', BLUE: 'синий' };
    const ph = x => { if (!x.ph) return []; const p = x.ph.split('/'), pre = p[0] + '/' + p[1]; return [p.slice(0, 3).join('/') + '/' + (p[3] || '00')].concat((x.pp || []).map(s => s.split('/').length > 2 ? s : pre + '/' + s)).map(s => { const q = s.split('/'); return 'https://file3.autolookout.net/' + q.slice(0, 3).join('/') + '/O3Jlc29sdXRpb246MTAyNHg3Njg7/' + (q[3] || '00'); }); };
    B.lots.demo = d.lots.filter(x => x.max > 0 && x.ph && (x.C || x.F)).slice(0, 4).map((x, i) => ({ id: 'd' + i, cid: 'demo', d: idx.dates[0].id, y: x.y, mk: x.mk, md: x.md, st: x.st, o: x.o, color: COL[x.c] || String(x.c || '').toLowerCase(), photos: ph(x), price: Math.round(x.max / 100) * 100, rt: x.rt && x.rt.est, note: ['Чистая, по истории без ДТП. Хороший вариант под ваш бюджет.', 'Ухоженная, свежая резина. Посмотрю вживую утром перед торгами.', '', 'Экономичная, недорогая в обслуживании.'][i % 4], by: 'Михаил', atMs: Date.now() - i }));
  } catch (e) { B.lots.demo = []; }
}
init();
