'use strict';
/* Аукционы Хьюстона — мобильное приложение (PWA). Данные: data/index.json и data/<дата>.json */
const FEES = { auc: 700, dealer: 0, ...LS0('fees-v1', {}) };
function LS0(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
const feeTotal = () => (+FEES.auc || 0) + (+FEES.dealer || 0);
let FEE = feeTotal();
// пересчёт прибыли и макс. ставки под расходы пользователя (в данных они посчитаны со сбором $700)
function applyFees(d) {
  d.lots.forEach(x => {
    if (x.prof0 === undefined) { x.prof0 = x.prof; x.max0 = x.max; }
    if (x.prof0 != null && x.sale != null && x.w != null) x.prof = x.sale - x.w - FEE;
    if (x.max0 != null && x.sale != null && x.margin) { const budget = x.margin >= 1500 ? 13500 : 5000; x.max = Math.max(0, Math.min(x.sale - FEE - x.margin, budget - FEE)); }
    // неходячие: прибыль и ставку не считаем, показываем только MMR
    if (isInop(x)) { x.prof = null; x.max = null; x.stat = null; }
  });
  // неходячие не попадают в подборку: она отбирается по прибыли
  if (d.map) ['core', 'flip'].forEach(g => { if (d[g]) d[g] = d[g].filter(k => d.map[k] && !isInop(d.map[k])); });
}
const AUC = { AAH: 'AAA Houston', AAA: 'AAA Central', H1C: 'H1C', ANA: 'AutoNation', CMX: 'CarMax Conroe' };
const SEVEN = /^(Toyota|Honda|Hyundai|BMW|Volkswagen|Kia|Mercedes)/i;
const COLOR = { BLACK: T('чёрный'), WHITE: T('белый'), GRAY: T('серый'), GREY: T('серый'), SILVER: T('серебристый'), RED: T('красный'), BLUE: T('синий'), BROWN: T('коричневый'), TAN: T('бежевый'), BEIGE: T('бежевый'), GOLD: T('золотистый'), GREEN: T('зелёный'), PURPLE: T('фиолетовый'), BURGUNDY: T('бордовый'), MAROON: T('бордовый'), ORANGE: T('оранжевый'), YELLOW: T('жёлтый'), TEAL: T('бирюзовый') };
const CLS = { salvage: ['bad', T('Salvage, rebuilt или без тайтла')], noinop: ['bad', T('Не на ходу или нет ключа')], hist: ['warn', T('Пометка на чистом тайтле')], clean: ['good', T('Без пометок')] };
const STAT = { 'Основная': 's-main', 'Флип': 's-flip', 'Дорого': 's-exp' };
const SS = { sold: T('Продана'), offer: T('Buy Now / оффер'), none: T('Не продана'), gone: T('Снята'), rerun: T('Снова на торгах') };
const HOT_R0 = /двигател|коробк|раздатк|дифференциал|не на ходу|engine|transmission|motor|trans\b|drivetrain/i, HOT_OK = /зелёный свет|гаранти|guarant|gty|green light|engine runs|eng starts|вернуть при проблеме/i;
const HOT_R = { test: t => HOT_R0.test(t) && !HOT_OK.test(t) };
const HOT_Y = /град|рам|кузов|structural|frame|hail|крыш|подушк|airbag|утоплен|flood|salvage|rebuilt|тотал|odometer|tmu/i;

const $ = s => document.querySelector(s);
const E = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const M = v => v == null || v === '' || isNaN(v) ? '—' : (v < 0 ? '−$' : '$') + Math.abs(Math.round(Number(v))).toLocaleString('en-US');
const N = v => Number(v || 0).toLocaleString('en-US');
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

const S = {
  index: null, date: null, d: null, cache: {},
  tab: 'home', picks: 'core',
  favs: LS.get('fav-v1', {}), notes: LS.get('auction-notes-v1', {}),
  f: { q: '', mk: [], md: [], au: '', cl: '', st: '', y: '', o: '', p: '', quick: '' , sort: 'stat' },
  rf: { q: '', st: '', sort: 'run' },
  shown: 24, deferredInstall: null
};

/* ---------- данные ---------- */
async function getJSON(url, fresh) {
  const r = await fetch(url, { cache: fresh ? 'no-cache' : 'default' });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
async function loadIndex(fresh) {
  const idx = await getJSON('data/index.json', fresh);
  const old = LS.get('data-ver', null);
  S.index = idx;
  if (old && old !== idx.version) { S.cache = {}; toast(T('Данные обновлены: ') + fmtUpdated(idx.updated)); }
  LS.set('data-ver', idx.version);
  return idx;
}
async function loadDate(id) {
  if (!S.cache[id]) {
    const d = await getJSON('data/' + id + '.json?v=' + S.index.version);
    d.map = {}; d.lots.forEach(x => { x.k = x.auc + '|' + x.run; d.map[x.k] = x; });
    applyFees(d); S.cache[id] = d;
  }
  S.date = id; S.d = S.cache[id]; LS.set('cur-date', id);
}
const KK_M = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'], KK_W = ['жексенбі', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі'];
function kkDate(id, long) { const t = new Date(id + 'T12:00:00'); return t.getDate() + ' ' + (long ? KK_M[t.getMonth()] : KK_M[t.getMonth()].slice(0, 3)) + (long ? ', ' + KK_W[t.getDay()] : ''); }
function weeks(s) { return LANG === 'ru' ? s : String(s || '').replace(/нед\.?/, { en: 'wk', uk: 'тиж.', es: 'sem.', kk: 'апта' }[LANG]); }
function dLabel(d) { if (LANG === 'ru') return d.label; if (LANG === 'kk') return kkDate(d.id, false); try { return new Date(d.id + 'T12:00:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }); } catch (e) { return d.label; } }
function dTitle(d) {
  if (LANG === 'ru') return d.title;
  const aucs = d.lots ? [...new Set(d.lots.map(x => AUC[x.auc] || x.auc))].join(', ') : shortAuc(d.title);
  let dt = ''; if (LANG === 'kk') return aucs + ', ' + kkDate(d.id, true); try { dt = new Date(d.id + 'T12:00:00').toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) {}
  return aucs + ', ' + dt;
}
function fmtUpdated(iso) {
  try { const t = new Date(iso); return t.toLocaleString(LOCALE, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
}

/* ---------- помощники ---------- */
function slot(x) { if (x.auc === 'CMX') return '8:00'; if (x.auc === 'ANA') return x.cls === 'noinop' ? '9:30' : '10:00'; if (x.auc === 'AAH') return '13:00'; if (x.auc === 'H1C') return '16:30'; return String(x.run)[0] === '7' ? '13:00' : '11:45'; }
function carName(x) { return [x.y, x.mk, x.md, x.st].filter(Boolean).join(' '); }
function fmtDate(id) { const p = String(id || '').split('-'); return p.length === 3 ? p[2] + '.' + p[1] : ''; }
function lotUrl(x) { return x.u ? x.u : x.s ? 'https://www.edgepipeline.com/components/vehicle/detail/' + x.s : ''; }
function favKey(x) { return S.date + '|' + x.k; }
function isFav(x) { return !!S.favs[favKey(x)]; }
function noteOf(x) { const n = x.vin && S.notes[x.vin]; return n && n.text ? n : null; }
// номер лота = линия + номер: «D-0054» → ['D', 0, 54], «11-0078» → ['', 11, 78]
function runKey(r) { const m = String(r || '').replace(/\s/g, '').match(/^([A-Za-z]*)(\d*)[-\/]?(\d*)$/); return m ? [m[1].toUpperCase(), +m[2] || 0, +m[3] || 0] : [String(r || ''), 0, 0]; }
function annText(x) { return (LANG === 'en' || LANG === 'es') ? (x.a || x.ar || '') : (x.ar || x.a || ''); }
function hl(x) { const a = annText(x); return a.split(/;\s*/).filter(Boolean).map(t => HOT_R.test(t) ? '<span class="hot-r">' + E(t) + '</span>' : HOT_Y.test(t) ? '<span class="hot-y">' + E(t) + '</span>' : E(t)).join('; '); }
function hasAnn(x) { const a = x.a || x.ar || ''; return a && !/^\s*(GREEN LIGHT|AS[- ]IS,?)\s*$/i.test(a); }
function profCls(x) { return x.prof == null ? '' : x.prof >= (x.margin || 1000) ? 'pos' : x.prof > 0 ? 'mid' : 'neg'; }
function chance(x) { if (x.max == null || !x.w) return null; const r = x.max / x.w; return r >= 1 ? ['good', T('высокий')] : r >= .85 ? ['warn', T('средний')] : ['bad', T('низкий')]; }
function lightChip(x) {
  if (x.auc === 'CMX') return (x.mech ? '<span class="chip bad">' + T('Дефект двигателя/КПП') + '</span>' : '') + (x.sel ? '<span class="chip good">CarMax Select</span>' : '') + (x.arbx ? '<span class="chip good">ARBX Plus</span>' : '');
  if (x.l === 'Green') return '<span class="chip good">' + T('Зелёный свет') + '</span>';
  if (String(x.l || '').includes('Red')) return '<span class="chip bad">' + T('Красный свет') + '</span>';
  if (x.l === 'Yellow') return '<span class="chip warn">' + T('Жёлтый свет') + '</span>';
  return '';
}
function titleChip(x) {
  if (x.ttl) return '<span class="chip ' + (x.ttlbad ? 'bad' : 'good') + '">' + E(x.ttl) + '</span>';
  if (x.cls === 'salvage') return '<span class="chip bad">' + T('Salvage / без тайтла') + '</span>';
  return '';
}
function factText(x) {
  if (!S.d.results) return '';
  if (x.fact) { const pr = x.sale != null && !isInop(x) ? x.sale - x.fact - FEE : null; return '<p class="fact"><b>' + T('Продана за ') + M(x.fact) + '</b>' + (x.w ? ', ' + Math.round(100 * x.fact / x.w) + T('% от MMR') : '') + (pr != null ? T('. Прибыль была бы ') + M(pr) : '') + (x.max != null ? (x.max >= x.fact ? T('. Наша ставка брала.') : T('. Наша ставка не брала.')) : '') + '</p>'; }
  if (x.ss) return '<p class="fact">' + E(SS[x.ss] || x.ss) + (x.ss === 'offer' && x.bnf ? ', ' + M(x.bnf) : '') + (x.ss === 'rerun' && x.rr ? T(', лот ') + E(x.rr) : '') + '</p>';
  return '';
}

/* ---------- неходячие: линии, где аукцион продаёт машины не на ходу ---------- */
// AAA - Central Houston: линия 7 (правило Максата). Другие аукционы добавить сюда, когда станут известны их линии.
const INOP_LANES = { AAA: ['7'] };
function lane(x) { return String(x.run || '').split('-')[0].trim(); }
function inopLane(x) { return (INOP_LANES[x.auc] || []).includes(lane(x)); }
function isInop(x) { return x.cls === 'noinop' || inopLane(x); }
/* ---------- карточка лота ---------- */
const VERDICT = { 'Основная': ['v-buy', T('Брать')], 'Флип': ['v-flip', T('Флип')], 'Дорого': ['v-exp', T('Дорого')] };
function statusLine(x) {
  const it = [];
  const add = (c, t) => it.push('<span class="st ' + c + '"><i></i>' + t + '</span>');
  if (x.ttl) add(x.ttlbad ? 'bad' : 'ok', E(x.ttl));
  else if (x.cls === 'salvage') add('bad', T('Salvage / без тайтла'));
  if (x.t && x.auc !== 'H1C' && x.t !== 'At Auction') add('warn', T('Тайтла нет на площадке'));
  if (inopLane(x)) add('bad', T('Неходячая, линия') + ' ' + E(lane(x)));
  else if (x.cls === 'noinop') add('bad', T('Не на ходу / нет ключа'));
  if (x.hist) { const why = annText(x).split(/;\s*/).filter(t => HOT_Y.test(t) || HOT_R.test(t) || /угон|пробег|доработ|тотал|flood/i.test(t)); add('bad', why.length ? T('История: ') + E(why.slice(0, 2).join(', ')) : /серьёзн/.test(x.hx || '') ? T('Серьёзное ДТП в истории') : T('Пометка в истории')); }
  if (x.auc === 'CMX' && x.mech) add('bad', T('Дефект двигателя/КПП'));
  if (x.l === 'Green') add('ok', T('Зелёный свет')); else if (String(x.l || '').includes('Red')) add('bad', T('Красный свет')); else if (x.l === 'Yellow') add('warn', T('Жёлтый свет'));
  if (x.g) { const g = parseFloat(x.g); add(g >= 4 ? 'ok' : g < 3 ? 'bad' : 'warn', T('Оценка ') + E(x.g)); }
  return it.join('');
}
/* прошлые появления машины на торгах: продана / ушла на оффер / не продана */
function pastRes(p) {
  if (p.s === 'offer') return '<b class="offer">' + (p.p ? T('ушла на оффер за') + ' ' + M(p.p) : T('ушла на оффер')) + '. ' + T('Не отдали') + '</b>' + (p.p ? '' : ' · ' + T('сумма неизвестна'));
  if (p.s === 'nosale') return T('не продана');
  if (p.s === 'gone') return T('снята');
  if (p.p) return T('продана за') + ' ' + M(p.p);
  return T('итога нет в базе');
}
function pastHead(x) {
  const P = x.past, c = s => P.filter(p => p.s === s && (s !== 'sold' || p.p)).length;
  const sold = c('sold'), off = c('offer'), no = c('nosale');
  const parts = [];
  if (sold) parts.push(T('продана') + ' ' + sold + '×');
  if (off) parts.push(T('на оффер') + ' ' + off + '×');
  if (no) parts.push(T('не продана') + ' ' + no + '×');
  return T('Уже была на торгах') + ' ' + P.length + '×' + (parts.length ? ' · ' + parts.join(', ') : '');
}
function pastLine(p) { return fmtDate(p.d) + ' · ' + E(p.a) + (p.run ? ', ' + T('лот') + ' ' + E(p.run) : '') + ' — ' + pastRes(p) + (p.q ? ' · ' + T('вероятно та же машина') : ''); }
function seenLv(x) { const n = x.past ? x.past.length : 0; return n >= 3 ? 'sv3' : n === 2 ? 'sv2' : 'sv1'; }
function pastCard(x) {
  if (!x.past || !x.past.length) return '';
  return '<div class="seen-pv"><b>' + pastHead(x) + '</b>' + x.past.slice(-3).map(p => '<span>' + pastLine(p) + '</span>').join('') + '</div>';
}
function hotLine(x) {
  if (x.hist) return '';
  const a = (hasAnn(x) ? annText(x) : '') || '';
  const hot = a.split(/;\s*/).filter(t => HOT_R.test(t) || HOT_Y.test(t));
  if (!hot.length && x.whyn && (HOT_R.test(x.whyn) || HOT_Y.test(x.whyn))) hot.push(x.whyn);
  return hot.length ? '<p class="warnline">' + hot.map(t => '<span class="' + (HOT_R.test(t) ? 'hot-r' : 'hot-y') + '">' + E(t) + '</span>').join(' ') + '</p>' : '';
}
/* главное фото лота с EDGE (CDN autolookout, превью 400×300) */
// номер фото на CDN EDGE растёт со временем загрузки: чем больше, тем позже машину выставили
function phId(x) { if (!x.ph) return -1; const p = x.ph.split('/'); return +(p[1] + p[2]) || -1; }
function photoUrl(x) { if (!x.ph) return ''; const p = x.ph.split('/'); const sf = p.length > 3 ? p.pop() : '00'; return 'https://file3.autolookout.net/' + p.join('/') + '/O3Jlc29sdXRpb246NDAweDMwMDs=/' + sf; }
function photo(x, cls, lazy) { const u = photoUrl(x); return u ? '<img class="' + cls + '" src="' + u + '" alt="" referrerpolicy="no-referrer" decoding="async"' + (lazy ? ' loading="lazy"' : '') + ' onerror="this.remove()">' : ''; }
function lotCard(x) {
  const n = noteOf(x), v = VERDICT[x.stat], fav = isFav(x);
  return '<article class="lot' + (x.past && x.past.length ? ' seen ' + seenLv(x) : '') + '" role="button" tabindex="0" data-lot="' + E(x.k) + '">'
    + '<div class="lot-top"><span class="run">' + E(x.run) + '</span><span class="where">' + E(AUC[x.auc] || x.auc) + ' · ' + slot(x) + '</span>' + (v ? '<span class="verdict ' + v[0] + '">' + v[1] + '</span>' : '') + '</div>'
    + '<button class="star' + (fav ? ' on' : '') + '" data-fav="' + E(x.k) + '" aria-label="' + T('В избранное') + '" aria-pressed="' + fav + '">' + (fav ? '★' : '☆') + '</button>'
    + '<div class="lot-id">' + photo(x, 'thumb', true) + '<div><h3>' + E(carName(x)) + '</h3>'
    + '<p class="sub">' + [x.o > 500 ? N(x.o) + ' mi' : '', COLOR[x.c] || String(x.c || '').toLowerCase()].filter(Boolean).map(E).join(' · ') + '</p></div></div>'
    + (isInop(x) ? '<div class="money inop"><div class="m-main"><span>MMR</span><b>' + M(x.w) + '</b></div><div class="m-note">' + T('Неходячая: прибыль не считаем') + '</div></div>' : '<div class="money two"><div class="m-main"><span>MMR</span><b>' + M(x.w) + '</b></div><div class="m-main"><span>' + T('Ретейл') + '</span><b>' + M(x.r) + '</b></div></div>')
    + '<div class="status">' + statusLine(x) + '</div>'
    + pastCard(x)
    + hotLine(x)
    + factText(x)
    + (n ? '<p class="note-pv">' + E(n.text.slice(0, 120)) + '</p>' : '')
    + '</article>';
}

/* ---------- фильтры ---------- */
const QUICK = [['', T('Все')], ['fav', T('★ Избранное')], ['pick', T('Подборка')], ['seven', T('7 марок')], ['inop', T('Неходячие')], ['clean', T('Без пометок')], ['title', T('Тайтл на месте')], ['profit', T('Прибыль ') + '> 0'], ['past', T('Были на торгах')], ['notes', T('С заметкой')]];
const SORTS = [['stat', T('Сначала подборка')], ['prof', T('Прибыль больше')], ['w', T('MMR меньше')], ['wd', T('MMR больше')], ['diff', T('Ретейл − MMR больше')], ['time', T('Аукцион и время')], ['mk', T('Марка, модель, год')], ['ymm', T('Год, марка, модель')], ['run', T('Run номер')], ['o', T('Пробег меньше')], ['new', T('Недавно выставленные')], ['y', T('Год новее')]];
function applyFilters(list) {
  const f = S.f, q = f.q.toLowerCase().trim(), y = +f.y || 0, o = +f.o || 0, p = +f.p || 0;
  const lotQ = q.replace(/\s/g, '').toUpperCase();
  let a = list.filter(x => {
    if (q) { const hay = (x.run + ' ' + carName(x) + ' ' + (x.vin || '')).toLowerCase(); if (!hay.includes(q) && String(x.run).replace(/[\s-]/g, '').toUpperCase() !== lotQ.replace(/-/g, '')) return false; }
    if (f.mk.length && !f.mk.includes(x.mk)) return false;
    if (f.md.length && f.md.some(k => k.startsWith(x.mk + '|')) && !f.md.includes(x.mk + '|' + x.md)) return false;
    if (f.au && x.auc !== f.au) return false;
    if (f.cl && x.cls !== f.cl) return false;
    if (f.st && x.stat !== f.st) return false;
    if (y && !(x.y >= y)) return false;
    if (o && !(x.o <= o)) return false;
    if (p && !(x.w != null && x.w <= p)) return false;
    switch (f.quick) {
      case 'fav': return isFav(x);
      case 'pick': return x.C || x.F;
      case 'seven': return x.S || SEVEN.test(x.mk || '');
      case 'clean': return x.cls === 'clean' && !x.hist && !x.ttlbad;
      case 'title': return x.t === 'At Auction';
      case 'profit': return x.prof > 0;
      case 'notes': return !!noteOf(x);
      case 'past': return !!(x.past && x.past.length);
      case 'inop': return isInop(x);
    }
    return true;
  });
  const order = { 'Основная': 0, 'Флип': 1, 'Дорого': 2, 'Вне критериев': 3, 'Нет': 4 };
  const nn = (v, d) => v == null ? d : v;
  const by = {
    stat: (u, v) => (nn(order[u.stat], 9) - nn(order[v.stat], 9)) || (nn(v.prof, -1e9) - nn(u.prof, -1e9)),
    prof: (u, v) => nn(v.prof, -1e9) - nn(u.prof, -1e9),
    w: (u, v) => nn(u.w, 1e9) - nn(v.w, 1e9),
    wd: (u, v) => nn(v.w, -1e9) - nn(u.w, -1e9),
    run: (u, v) => { const a1 = runKey(u.run), b1 = runKey(v.run); return String(u.auc).localeCompare(String(v.auc)) || a1[0].localeCompare(b1[0]) || a1[1] - b1[1] || a1[2] - b1[2]; },
    ymm: (u, v) => (v.y || 0) - (u.y || 0) || String(u.mk || '').localeCompare(String(v.mk || '')) || String(u.md || '').localeCompare(String(v.md || '')),
    time: (u, v) => slot(u).localeCompare(slot(v)) || by.run(u, v),
    new: (u, v) => phId(v) - phId(u) || by.run(u, v),
    mk: (u, v) => String(u.mk || '').localeCompare(String(v.mk || '')) || String(u.md || '').localeCompare(String(v.md || '')) || (v.y || 0) - (u.y || 0),
    y: (u, v) => (v.y || 0) - (u.y || 0),
    o: (u, v) => nn(u.o, 1e9) - nn(v.o, 1e9),
    diff: (u, v) => (v.w == null ? -1e9 : v.r - v.w) - (u.w == null ? -1e9 : u.r - u.w)
  };
  a.sort(by[f.sort] || by.stat);
  return a;
}
function activeFilterCount() { const f = S.f; return ['au', 'cl', 'st', 'y', 'o', 'p'].filter(k => f[k]).length + (f.mk.length ? 1 : 0) + (f.md.length ? 1 : 0); }

/* ---------- экраны ---------- */
const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  picks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>',
  lots: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>',
  results: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
};
function tabs() {
  const t = [['home', T('Главное')], ['picks', T('Подборка')], ['lots', T('Все лоты')]];
  if (S.d && S.d.results) t.push(['results', T('Итоги')]);
  t.push(['more', T('Ещё')]);
  if (S.tab === 'results' && !(S.d && S.d.results)) S.tab = 'home';
  $('#tabbar').innerHTML = t.map(([k, l]) => '<button data-tab="' + k + '"' + (S.tab === k ? ' aria-current="page"' : '') + '>' + ICONS[k] + '<span>' + l + '</span></button>').join('');
}
function datesBar() {
  $('#dates').innerHTML = S.index.dates.map(d => '<button data-date="' + d.id + '" aria-pressed="' + (d.id === S.date) + '">' + E(dLabel(d)) + '<small>' + E(shortAuc(d.title)) + '</small></button>').join('');
  const on = $('#dates [aria-pressed="true"]'); if (on) on.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}
function shortAuc(t) { t = String(t || '').split(',')[0]; const m = t.match(/CarMax|AutoNation|AAA Houston|AAA|H1C|1st Choice|Manheim|Copart|IAA|ADESA/gi); return m ? [...new Set(m)].join(' + ') : t.slice(0, 18); }

function render() {
  tabs(); datesBar();
  const v = $('#view');
  if (S.tab === 'home') v.innerHTML = home();
  else if (S.tab === 'picks') v.innerHTML = picks();
  else if (S.tab === 'lots') { v.innerHTML = lotsScreen(); drawLots(S.keepShown ? true : undefined); }
  else if (S.tab === 'results') { v.innerHTML = resultsScreen(); drawResults(); }
  else v.innerHTML = more();
}
function installTitle() { return platform() === 'desktop' ? T('Установить на компьютер') : T('Установить на телефон'); }
function installBanner() {
  if (isStandalone() || LS.get('hide-install', false)) return '';
  const dk = platform() === 'desktop';
  return '<div class="banner"><button class="banner-go" data-act="install"><b>' + installTitle() + '</b><span>' + (dk ? T('отдельное окно и иконка на рабочем столе') : T('иконка на экране, работает без интернета')) + '</span></button><button class="x" data-act="hide-install" aria-label="' + T('Скрыть') + '">×</button></div>';
}
function home() {
  const d = S.d;
  const favN = d.lots.filter(isFav).length, notesN = d.lots.filter(noteOf).length;
  const best = bestLots();
  const aucs = {}; d.lots.forEach(x => { aucs[x.auc] = aucs[x.auc] || { n: 0, t: slot(x) }; aucs[x.auc].n++; });
  return installBanner()
    + '<div class="hd"><h1>' + E(dTitle(d)) + '</h1>' + (LANG === 'ru' ? '<p>' + E(d.lead) + '</p>' : '') + '</div>' + feesCard()
    + '<div class="tiles">'
    + '<button class="tile" data-go="lots" data-quick=""><b>' + d.lots.length + '</b><span>' + T('лотов в каталоге') + '</span></button>'
    + '<button class="tile" data-go="picks" data-pick="core"><b>' + d.core.length + '</b><span>' + T('дороже $5 000 в подборке') + '</span></button>'
    + '<button class="tile" data-go="picks" data-pick="flip"><b>' + d.flip.length + '</b><span>' + T('для флипа до $5 000') + '</span></button>'
    + '<button class="tile" data-go="picks" data-pick="fav"><b>' + favN + '</b><span>' + T('в избранном') + (notesN ? T(', заметок ') + notesN : '') + '</span></button>'
    + '</div>'
    + (Object.keys(aucs).length > 1 ? '<h2>' + T('Площадки') + '</h2><div class="rows">' + Object.entries(aucs).map(([a, o]) => '<button class="r" data-go="lots" data-au="' + a + '"><div class="l"><b>' + E(AUC[a] || a) + '</b><br><small>' + T('старт около ') + o.t + '</small></div><div class="rt"><b>' + o.n + '</b><small>' + T('лотов') + '</small></div></button>').join('') + '</div>' : '')
    + (best.length ? '<h2>' + T('Лучшие по прибыли') + '</h2><div class="list" id="bestList">' + best.map(lotCard).join('') + '</div><button class="more" data-go="picks">' + T('Вся подборка') + '</button>' : '')
    + '<p class="foot">' + T('Данные обновлены ') + E(fmtUpdated(S.index.updated)) + T('. Комиссия ') + M(FEE) + T(' на машину.') + '</p>';
}
function bestLots() { const d = S.d; return d.core.concat(d.flip).map(k => d.map[k]).filter(Boolean).sort((a, b) => (b.prof || 0) - (a.prof || 0)).slice(0, 6); }
function picks() {
  const d = S.d;
  const seg = [['core', '$5 000+', d.core.length], ['flip', T('Флип'), d.flip.length], ['fav', T('★ Мои'), d.lots.filter(isFav).length]];
  let list = S.picks === 'fav' ? d.lots.filter(isFav) : (d[S.picks] || []).map(k => d.map[k]).filter(Boolean);
  const aucs = [...new Set(list.map(x => x.auc))];
  const pa = S.pickAuc && aucs.includes(S.pickAuc) ? S.pickAuc : '';
  if (pa) list = list.filter(x => x.auc === pa);
  return '<div class="seg" role="group">' + seg.map(([k, l, n]) => '<button data-pick="' + k + '" aria-pressed="' + (S.picks === k) + '">' + l + ' <span class="muted">' + n + '</span></button>').join('') + '</div>'
    + (aucs.length > 1 ? '<div class="qf">' + [''].concat(aucs).map(a => '<button data-pauc="' + a + '" aria-pressed="' + (pa === a) + '">' + (a ? E(AUC[a] || a) : T('Все площадки')) + '</button>').join('') + '</div>' : '')
    + (list.length ? '<div class="list">' + list.map(lotCard).join('') + '</div>'
      : '<p class="empty">' + (S.picks === 'fav' ? T('Пока пусто. Нажмите ☆ на карточке машины, чтобы собрать свой список на торги.') : T('В подборке на эту дату машин нет.')) + '</p>');
}
function lotsScreen() {
  const fc = activeFilterCount();
  return '<div class="searchbar"><input type="search" id="q" placeholder="' + T('Модель, лот или VIN') + '" value="' + E(S.f.q) + '" autocomplete="off" enterkeyhint="search" aria-label="' + T('Поиск') + '"><button id="btnFilters" class="' + (fc ? 'on' : '') + '">' + T('Фильтры') + (fc ? ' · ' + fc : '') + '</button></div>'
    + '<div class="qf">' + QUICK.map(([k, l]) => '<button data-quick="' + k + '" aria-pressed="' + (S.f.quick === k) + '">' + l + '</button>').join('') + '</div>'
    + '<div class="count"><span id="cnt"></span><select id="sort" aria-label="' + T('Сортировка') + '">' + SORTS.map(([k, l]) => '<option value="' + k + '"' + (S.f.sort === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>'
    + '<div class="list" id="lotlist"></div><div id="lotmore"></div>';
}
let LOTS_CUR = [];
function drawLots(keep) {
  const append = keep === 'append';
  const a = append ? LOTS_CUR : applyFilters(S.d.lots); LOTS_CUR = a;
  const from = append ? S.shown - 24 : 0;
  if (!keep) S.shown = 24;
  $('#cnt').textContent = T('Найдено ') + a.length + (a.length !== S.d.lots.length ? T(' из ') + S.d.lots.length : '');
  if (append) $('#lotlist').insertAdjacentHTML('beforeend', a.slice(from, S.shown).map(lotCard).join(''));
  else $('#lotlist').innerHTML = a.length ? a.slice(0, S.shown).map(lotCard).join('') : '<p class="empty">' + T('Ничего не нашлось. Попробуйте убрать фильтры.') + '</p>';
  $('#lotmore').innerHTML = a.length > S.shown ? '<button class="more" data-act="more">' + T('Показать ещё') + '</button>' : '';
  const mb = $('#lotmore .more'); if (mb && 'IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); S.shown += 24; drawLots('append'); } }, { rootMargin: '800px' }); io.observe(mb); }
}
function filterSheet() {
  const d = S.d, f = S.f;
  const opt = (arr, v) => arr.map(([k, l]) => '<option value="' + E(k) + '"' + (String(v) === String(k) ? ' selected' : '') + '>' + E(l) + '</option>').join('');
  const mk = [...new Set(d.lots.map(x => x.mk).filter(Boolean))].sort();
  const cnt = {}, mods = {};
  d.lots.forEach(x => { if (!x.mk) return; cnt[x.mk] = (cnt[x.mk] || 0) + 1; const g = mods[x.mk] = mods[x.mk] || {}; const md = x.md || '—'; g[md] = (g[md] || 0) + 1; });
  const aucs = [...new Set(d.lots.map(x => x.auc))];
  const st = [...new Set(d.lots.map(x => x.stat).filter(Boolean))];
  openSheet(T('Фильтры'), '<div class="fl">'
    + '<label>' + T('Марка') + ' <small class="f-hint">' + T('можно несколько') + '</small></label><div class="pick-chips" id="f_mk">' + mk.map(m => '<label class="pc"><input type="checkbox" value="' + E(m) + '"' + (f.mk.includes(m) ? ' checked' : '') + '><span>' + E(m) + ' <i>' + cnt[m] + '</i></span></label>').join('') + '</div>'
    + '<label>' + T('Модель') + ' <small class="f-hint">' + T('сначала выберите марку') + '</small></label><div id="f_md">' + mk.map(m => '<div class="md-g" data-mk="' + E(m) + '"' + (f.mk.includes(m) ? '' : ' hidden') + '><b>' + E(m) + '</b><div class="pick-chips">' + Object.keys(mods[m]).sort().map(md => '<label class="pc"><input type="checkbox" value="' + E(m + '|' + md) + '"' + (f.md.includes(m + '|' + md) ? ' checked' : '') + '><span>' + E(md) + ' <i>' + mods[m][md] + '</i></span></label>').join('') + '</div></div>').join('') + '</div>'
    + (aucs.length > 1 ? '<label for="f_au">' + T('Площадка') + '</label><select id="f_au">' + opt([['', T('Все площадки')]].concat(aucs.map(a => [a, AUC[a] || a])), f.au) + '</select>' : '')
    + '<label for="f_cl">' + T('История и тайтл') + '</label><select id="f_cl">' + opt([['', T('Любая')], ['clean', T('Без пометок')], ['hist', T('Пометки на чистом тайтле')], ['noinop', T('Не на ходу, нет ключа')], ['salvage', T('Salvage, rebuilt, без тайтла')]], f.cl) + '</select>'
    + '<label for="f_st">' + T('Решение') + '</label><select id="f_st">' + opt([['', T('Любое')]].concat(st.map(s => [s, T(s)])), f.st) + '</select>'
    + '<div class="row"><div><label for="f_y">' + T('Год от') + '</label><input id="f_y" type="number" inputmode="numeric" value="' + E(f.y) + '"></div><div><label for="f_o">' + T('Пробег до') + '</label><input id="f_o" type="number" inputmode="numeric" value="' + E(f.o) + '"></div><div><label for="f_p">' + T('MMR до') + '</label><input id="f_p" type="number" inputmode="numeric" value="' + E(f.p) + '"></div></div>'
    + '<div class="btns"><button class="btn" data-act="freset">' + T('Сбросить') + '</button><button class="btn pri" data-act="fapply">' + T('Показать') + '</button></div></div>', false);
}
function resultsScreen() {
  const s = S.d.stats || {}, g = o => o && o.r != null ? o.r + '% <small>(' + o.n + ')</small>' : '—';
  return '<div class="hd"><h1>' + T('Итоги торгов') + '</h1><p>' + T('Сколько машины реально стоили относительно MMR.') + '</p></div>'
    + '<div class="tiles"><div class="tile"><b>' + (s.n ?? '—') + '</b><span>' + T('продано') + (s.u != null ? T(', не продано ') + s.u : '') + '</span></div>'
    + '<div class="tile"><b>' + (s.w ?? '—') + '%</b><span>' + T('медиана: цена к MMR') + (s.wn ? ', ' + s.wn + T(' лотов') : '') + '</span></div>'
    + '<div class="tile"><b>' + (s.ps ?? '—') + T(' из ') + (s.pn ?? '—') + '</b><span>' + T('машин подборки продано') + '</span></div>'
    + '<div class="tile"><b>' + (s.pw ?? '—') + '</b><span>' + T('ушли не дороже нашей ставки') + '</span></div></div>'
    + '<h2>' + T('По оценке') + '</h2><div class="rows">' + [[T('Оценка 4+'), s.g4], [T('Оценка 3–3,9'), s.g3], [T('Ниже 3'), s.g2], [T('Без оценки'), s.gn]].map(([l, o]) => '<div class="r"><div class="l">' + l + '</div><div class="rt">' + g(o) + '</div></div>').join('') + '</div>'
    + '<h2>' + T('Все результаты') + '</h2><div class="searchbar"><input type="search" id="rq" placeholder="' + T('Модель или лот') + '" value="' + E(S.rf.q) + '" aria-label="' + T('Поиск') + '"></div>'
    + '<div class="qf">' + [['', T('Все')], ['sold', T('Продана')], ['none', T('Не продана')], ['offer', T('Оффер')], ['rerun', T('Снова на торгах')]].map(([k, l]) => '<button data-rst="' + k + '" aria-pressed="' + (S.rf.st === k) + '">' + l + '</button>').join('') + '</div>'
    + '<div class="count"><span id="rcnt"></span><select id="rsort" aria-label="' + T('Сортировка') + '">' + [['run', T('По лоту')], ['up', T('Дороже MMR')], ['down', T('Дешевле MMR')], ['f', T('Цена меньше')]].map(([k, l]) => '<option value="' + k + '"' + (S.rf.sort === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>'
    + '<div class="rows" id="rlist"></div><div id="rmore"></div>';
}
function drawResults(keep) {
  const R = S.d.results || [], q = S.rf.q.toLowerCase().trim(), st = S.rf.st, s = S.rf.sort;
  const m = x => x.w || x.mmr, df = x => m(x) && x.fact ? x.fact - m(x) : null;
  let a = R.filter(x => (!st || x.ss === st || (st === 'sold' && !x.ss && x.fact)) && (!q || (x.run + ' ' + x.d).toLowerCase().includes(q)));
  a.sort((u, v) => s === 'up' ? (df(v) ?? -1e9) - (df(u) ?? -1e9) : s === 'down' ? (df(u) ?? 1e9) - (df(v) ?? 1e9) : s === 'f' ? (u.fact || 1e9) - (v.fact || 1e9) : (() => { const a1 = runKey(u.run), b1 = runKey(v.run); return String(u.auc).localeCompare(String(v.auc)) || a1[0].localeCompare(b1[0]) || a1[1] - b1[1] || a1[2] - b1[2]; })());
  if (!keep) S.rshown = 80;
  $('#rcnt').textContent = T('Показано ') + Math.min(a.length, S.rshown) + T(' из ') + a.length;
  $('#rlist').innerHTML = a.slice(0, S.rshown).map(x => { const k = x.auc + '|' + x.run, has = S.d.map[k], d1 = df(x);
    return '<' + (has ? 'button data-lot="' + E(k) + '"' : 'div') + ' class="r"><div class="l"><b>' + E(x.run) + '</b> <small>' + E(AUC[x.auc] || x.auc) + '</small><br>' + E(x.d) + '<br><small>' + (x.o ? N(x.o) + ' mi · ' : '') + (x.g ? T('оценка ') + E(x.g) + ' · ' : '') + 'MMR ' + M(m(x)) + '</small></div><div class="rt"><b>' + (x.fact ? M(x.fact) : E(SS[x.ss] || '—')) + '</b>' + (d1 != null ? '<small class="' + (d1 > 0 ? 'pos' : d1 < 0 ? 'neg' : '') + '">' + (d1 > 0 ? '+' : '') + M(d1) + ' · ' + Math.round(100 * x.fact / m(x)) + '%</small>' : '') + '</div></' + (has ? 'button' : 'div') + '>'; }).join('') || '<p class="empty">' + T('Ничего не нашлось.') + '</p>';
  $('#rmore').innerHTML = a.length > S.rshown ? '<button class="more" data-act="rmore">' + T('Показать ещё') + '</button>' : '';
}
function more() {
  const notes = Object.entries(S.notes).filter(([, n]) => n && n.text);
  const cur = LANGS.find(l => l[0] === LANG);
  return '<div class="menu">' + '<button data-act="lang"><span class="ic flag">' + cur[1] + '</span><span>' + T('Язык') + '<small>' + cur[2] + '</small></span></button>'
    + '<button data-act="notes"><span class="ic">📝</span><span>' + T('Мои заметки') + '<small>' + (notes.length ? notes.length + T(' шт., привязаны к VIN') : T('Пока нет. Пишутся в карточке машины.')) + '</small></span></button>'
    + '<button data-act="how"><span class="ic">🧮</span><span>' + T('Как считается прибыль') + '<small>' + T('MMR, сбор, цена продажи, максимальная ставка') + '</small></span></button>'
    + '<button data-act="install"><span class="ic">📲</span><span>' + installTitle() + '<small>' + (isStandalone() ? T('Уже установлено') : platform() === 'desktop' ? T('Windows и Mac, без магазина приложений') : T('iPhone и Android, без App Store')) + '</small></span></button>'
    + '<button data-act="share-app"><span class="ic">🔗</span><span>' + T('Поделиться приложением') + '<small>' + T('Отправить ссылку другу') + '</small></span></button>'
    + '<button data-act="refresh"><span class="ic">🔄</span><span>' + T('Проверить обновления') + '<small>' + T('Данные от ') + E(fmtUpdated(S.index.updated)) + '</small></span></button>'
    + '<button data-act="font"><span class="ic">Aa</span><span>' + T('Шрифт') + '<small>' + fontLabel() + '</small></span></button>'
    + '<button data-act="theme"><span class="ic">◐</span><span>' + T('Тема оформления') + '<small>' + ({ light: T('Светлая'), dark: T('Тёмная') }[LS.get('theme', '')] || T('Как в системе')) + '</small></span></button>'
    + '</div><p class="foot">' + T('Аукционы Хьюстона · версия данных ') + E(S.index.version) + '<br>' + T('Цены ориентировочные: MMR и ретейл Manheim, без осмотра машины.') + '</p>';
}

/* ---------- шторка ---------- */
let sheetOpen = false;
function openSheet(title, html, full, actions) {
  const sh = $('#sheet');
  sh.className = 'sheet' + (full ? ' full' : '');
  sh.innerHTML = (full ? '' : '<div class="grip"></div>') + '<div class="sheet-h"><h2 id="sheetTitle">' + title + '</h2>' + (actions || '') + '<button data-act="close">' + (full ? T('Назад') : T('Готово')) + '</button></div>' + html;
  sh.hidden = false; $('#sheetBg').hidden = false; document.body.style.overflow = 'hidden';
  sh.scrollTop = 0;
  if (!sheetOpen) { try { if (S.replaceNext) history.replaceState({ sheet: 1 }, ''); else history.pushState({ sheet: 1 }, ''); } catch (e) {} }
  S.replaceNext = false;
  sheetOpen = true; S.openLot = S.pendingLot || null; S.pendingLot = null;
}
function closeSheet(fromPop) {
  if (!sheetOpen) return;
  const ta = $('#sheet textarea.note'); if (ta) saveNote(ta);
  $('#sheet').hidden = true; $('#sheetBg').hidden = true; document.body.style.overflow = '';
  sheetOpen = false; S.openLot = null;
  if (!fromPop) { try { history.back(); } catch (e) {} }
  if (S.tab === 'lots') drawLots(true); else if (S.tab !== 'results') keepScroll(render);
  saveView();
}
window.addEventListener('popstate', () => { if (sheetOpen) closeSheet(true); });

function detail(k) {
  const x = S.d.map[k]; if (!x) return;
  S.pendingLot = k; setTimeout(saveView, 0);
  const n = noteOf(x), link = lotUrl(x), ch = chance(x);
  const bid = x.max != null && x.max > 0 ? x.max : x.w || '';
  let chips = titleChip(x) + lightChip(x);
  if (x.g) chips += '<span class="chip">' + T('Оценка ') + E(x.g) + '</span>';
  if (x.t) chips += x.t === 'At Auction' ? '<span class="chip good">' + T('Тайтл на месте') + '</span>' : '<span class="chip warn">' + E(x.t) + '</span>';
  if (x.cls) chips += '<span class="chip ' + (CLS[x.cls] || CLS.clean)[0] + '">' + (CLS[x.cls] || CLS.clean)[1] + '</span>';
  if (ch) chips += '<span class="chip ' + ch[0] + '">' + T('Шанс купить: ') + ch[1] + '</span>';
  if (x.bn) chips += '<span class="chip">Buy Now ' + M(x.bn) + '</span>';
  let info = '';
  if (x.cr) info += '<p class="p acc">' + E(x.cr) + '</p>';
  if (hasAnn(x)) info += '<p class="p">' + T('Пометка аукциона: ') + hl(x) + '</p>';
  if (x.whyn) info += '<p class="p">' + T('Почему не в подборке: ') + (HOT_R.test(x.whyn) ? '<span class="hot-r">' + E(x.whyn) + '</span>' : HOT_Y.test(x.whyn) ? '<span class="hot-y">' + E(x.whyn) + '</span>' : E(x.whyn)) + '</p>';
  if (x.past && x.past.length) { const lp = x.past.filter(p => p.p).slice(-1)[0]; info += '<div class="p seen ' + seenLv(x) + '"><b>' + pastHead(x) + '</b><ul>' + x.past.map(p => '<li>' + pastLine(p) + '</li>').join('') + '</ul>' + (lp && x.w && lp.p < .7 * x.w ? '<span class="wrn-t">' + T(' Последний итог намного ниже MMR: возможен скрытый дефект.') + '</span>' : '') + '</div>'; }
  else if (x.prior) info += '<p class="p wrn">' + T('Уже была на торгах ') + fmtDate(x.prior.date) + T(' за ') + M(x.prior.price) + '.' + (x.w && x.prior.price < .7 * x.w ? T(' Это намного ниже MMR: возможен скрытый дефект.') : '') + '</p>';
  if (x.seen) info += '<p class="p wrn">' + T('Была в каталоге ') + E(x.seen) + T(': выставляется повторно.') + '</p>';
  if (x.hx) info += '<p class="p ' + (x.hxbad ? 'wrn' : '') + '"><b>' + T('История (AutoCheck):') + '</b> ' + E(x.hx) + '</p>';
  if (x.risk) info += '<p class="p"><b>' + T('Слабые места модели') + '</b>' + T(' (в прибыль не входят): ') + E(x.risk) + '</p>';
  if (x.cons) info += '<p class="p muted">' + T('Продавец: ') + E(x.cons) + (x.drv && x.drv !== 'N/A' ? ' · ' + E(x.drv) : '') + (x.eng ? ' · ' + E(x.eng) : '') + '</p>';
  const html = '<div class="d-card">' + photo(x, 'd-photo', false) + '<div class="lot-top"><span class="run">' + E(x.run) + '</span><span class="where">' + E(AUC[x.auc] || x.auc) + ' · ' + dLabel(S.d) + ', ' + slot(x) + '</span></div>'
    + '<h3 class="d-name">' + E(carName(x)) + '</h3><p class="sub">' + (x.o > 500 ? N(x.o) + ' mi · ' : '') + E(COLOR[x.c] || String(x.c || '').toLowerCase()) + (x.tr ? ' · Manheim: ' + E(x.tr) : '') + '</p>'
    + (chips ? '<div class="chips">' + chips + '</div>' : '') + factText(x) + '</div>'
    + (isInop(x) ? '<div class="d-card"><div class="grid6"><div class="hl"><b>' + M(x.w) + '</b><span>Adjusted MMR</span></div></div><p class="muted" style="margin-top:6px">' + T('Неходячая машина: прибыль, цену продажи и макс. ставку не считаем, только MMR.') + '</p></div>' : '')
    + (isInop(x) ? '' : '<div class="d-card"><div class="grid6"><div class="hl"><b>' + M(x.w) + '</b><span>Adjusted MMR</span></div><div><b>' + M(x.w != null ? x.w + FEE : null) + '</b><span>' + T('MMR + сбор ') + M(FEE) + '</span></div><div><b>' + M(x.r) + '</b><span>' + T('ретейл Manheim') + '</span></div><div><b>' + M(x.sale) + '</b><span>' + T('цена продажи') + '</span></div><div><b class="' + profCls(x) + '">' + M(x.prof) + '</b><span>' + T('прибыль по MMR') + '</span></div><div><b>' + M(x.max) + '</b><span>' + T('макс. ставка') + (x.margin ? T(' (прибыль ') + M(x.margin) + ')' : '') + '</span></div></div>'
    + (x.demand ? '<p class="p"><b>' + T('Спрос ') + x.demand + '/10</b>' + (x.sell ? T(', продаётся за ') + E(weeks(x.sell)) : '') + '</p>' : '') + '</div>')
    + (x.sale != null && !isInop(x) ? '<div class="d-card"><h3>' + T('Калькулятор ставки') + '</h3><div class="calc"><input id="bid" type="number" inputmode="numeric" value="' + E(bid) + '" aria-label="' + T('Ваша ставка, $') + '"><div class="calc-out" id="calcOut"></div></div></div>' : '')
    + (info ? '<div class="d-card">' + info + '</div>' : '')
    + '<div class="d-card"><h3><label for="note">' + T('Заметка после осмотра') + (n && n.date && n.date !== S.date ? T(' (от ') + fmtDate(n.date) + T(', лот ') + E(n.run) + ')' : '') + '</label></h3><textarea class="note' + (n ? ' has' : '') + '" id="note" data-k="' + E(k) + '" placeholder="' + T('Что увидели: кузов, мотор, салон, запах, ошибки') + '">' + E(n ? n.text : '') + '</textarea><p class="muted" id="nstat" style="font-size:12.5px;margin-top:4px">' + T('Хранится на этом телефоне и привязана к VIN.') + '</p></div>'
    + '<div class="d-card"><p class="vin">VIN ' + E(x.vin || T('нет')) + '</p><div class="btns">'
    + '<button class="btn" data-fav="' + E(k) + '">' + (isFav(x) ? T('★ В избранном') : T('☆ В избранное')) + '</button>'
    + (x.vin ? '<button class="btn" data-act="copy" data-v="' + E(x.vin) + '">' + T('Скопировать VIN') + '</button>' : '')
    + (link ? '<a class="btn pri" href="' + E(link) + '" target="_blank" rel="noopener">' + T('Открыть лот') + '</a>' : '')
    + '<button class="btn" data-act="share-lot" data-k="' + E(k) + '">' + T('Поделиться') + '</button>'
    + '</div></div>';
  openSheet(T('Лот ') + E(x.run), html, true);
  calc(x);
}
function calc(x) {
  const i = $('#bid'), o = $('#calcOut'); if (!i || !o) return;
  const b = +i.value || 0, tot = b + FEE, pr = x.sale - tot;
  o.innerHTML = T('С учётом сбора: ') + '<b>' + M(tot) + '</b><br>' + T('Прибыль: ') + '<b class="' + (pr >= (x.margin || 1000) ? 'pos' : pr > 0 ? 'mid' : 'neg') + '">' + M(pr) + '</b>' + (x.w ? ' · ' + Math.round(100 * b / x.w) + T('% от MMR') : '');
}
function saveNote(ta) {
  const x = S.d.map[ta.dataset.k]; if (!x || !x.vin) return;
  const text = ta.value.trim(), prev = S.notes[x.vin];
  if ((prev ? prev.text : '') === text) return;
  if (text) S.notes[x.vin] = { text, date: S.date, run: x.run, car: carName(x), updatedAt: new Date().toISOString() };
  else delete S.notes[x.vin];
  LS.set('auction-notes-v1', S.notes);
  const st = $('#nstat'); if (st) st.textContent = T('Сохранено');
  ta.classList.toggle('has', !!text);
}
function notesSheet() {
  const list = Object.entries(S.notes).filter(([, n]) => n && n.text).sort((a, b) => String(b[1].updatedAt || '').localeCompare(String(a[1].updatedAt || '')));
  openSheet(T('Мои заметки'), list.length ? '<div class="rows">' + list.map(([v, n]) => '<div class="r"><div class="l"><b>' + E(n.car || '') + '</b><br><small>' + fmtDate(n.date) + T(' · лот ') + E(n.run) + ' · <span class="vin">' + E(v) + '</span></small><p style="margin-top:4px">' + E(n.text) + '</p></div></div>').join('') + '</div><div class="btns"><button class="btn pri" data-act="share-notes">' + T('Отправить все заметки') + '</button><button class="btn" data-act="copy-notes">' + T('Скопировать') + '</button></div><p class="muted" style="font-size:13px;margin-top:10px">' + T('Отправьте заметки в чат с Claude, и он учтёт их в следующем анализе.') + '</p>' : '<p class="empty">' + T('Заметок пока нет. Откройте машину и напишите, что увидели на осмотре.') + '</p>', true);
}
function notesText() { return Object.entries(S.notes).filter(([, n]) => n && n.text).map(([v, n]) => fmtDate(n.date) + ' ' + (n.run || '') + ' ' + (n.car || '') + ' VIN ' + v + ': ' + n.text).join('\n'); }
function howSheet() {
  const gen = '<ul><li>' + T('Прибыль = цена продажи − MMR − расходы.') + '</li><li>' + T('Макс. ставка = цена продажи − расходы − желаемая прибыль ($1 500 для машин дороже $5 000, $1 000 для флипа).') + '</li><li>' + T('Цена продажи = ретейл Manheim с поправкой на быструю продажу и историю машины.') + '</li><li>' + T('Итого') + ': ' + M(FEE) + ' (' + T('Комиссия аукциона') + ' ' + M(FEES.auc) + ' + ' + T('Дилер фи') + ' ' + M(FEES.dealer) + ')</li></ul>';
  openSheet(T('Как считается'), '<div class="txt">' + gen + (LANG === 'ru' ? (S.d.how || '') : '<p class="muted">' + T('Подробное описание расчёта доступно на русском языке.') + ' ' + T('Риски и история машины пока только на русском.') + '</p>') + '</div>', true);
}
function feesCard() {
  return '<div class="fees"><div class="fees-h"><b>' + T('Мои расходы на машину') + '</b><span>' + T('Итого') + ' <b id="feeTot">' + M(FEE) + '</b></span></div>'
    + '<div class="fees-row"><label>' + T('Комиссия аукциона') + '<span class="money-in">$<input id="fee_auc" type="number" inputmode="numeric" min="0" step="50" value="' + E(FEES.auc) + '"></span></label>'
    + '<label>' + T('Дилер фи') + '<span class="money-in">$<input id="fee_dealer" type="number" inputmode="numeric" min="0" step="50" value="' + E(FEES.dealer) + '"></span></label></div>'
    + '<p class="fees-note">' + T('Прибыль и макс. ставка пересчитываются сразу.') + '</p></div>';
}
function setFees() {
  FEES.auc = Math.max(0, +($('#fee_auc') || {}).value || 0); FEES.dealer = Math.max(0, +($('#fee_dealer') || {}).value || 0);
  LS.set('fees-v1', { auc: FEES.auc, dealer: FEES.dealer }); FEE = feeTotal();
  Object.values(S.cache).forEach(applyFees);
  const t = $('#feeTot'); if (t) t.textContent = M(FEE);
  const best = $('#bestList'); if (best) best.innerHTML = bestLots().map(lotCard).join('');
}
/* ---------- шрифт и размер текста ---------- */
const FONTS = [['sys', 'Системный'], ['nunito', 'Nunito, округлый'], ['serif', 'PT Serif, с засечками'], ['mono', 'IBM Plex Mono, моноширинный']];
const SIZES = [[0.9, 'Мелкий'], [1, 'Обычный'], [1.1, 'Крупный'], [1.25, 'Очень крупный']];
function fontPref() { const p = LS.get('font-v1', {}) || {}; return { f: FONTS.some(x => x[0] === p.f) ? p.f : 'sys', z: SIZES.some(x => x[0] === p.z) ? p.z : 1 }; }
function applyFont() { const p = fontPref(); document.documentElement.dataset.font = p.f; document.body.style.zoom = p.z === 1 ? '' : p.z; }
function fontLabel() { const p = fontPref(); return T(FONTS.find(x => x[0] === p.f)[1]) + ' · ' + T(SIZES.find(x => x[0] === p.z)[1]).toLowerCase(); }
function fontSheet() {
  const p = fontPref();
  openSheet(T('Шрифт'), '<p class="sec-t">' + T('Размер текста') + '</p><div class="seg fsize">' + SIZES.map(([z, n]) => '<button data-fz="' + z + '" aria-pressed="' + (z === p.z) + '" style="font-size:' + Math.round(13 * z) + 'px">' + T(n) + '</button>').join('') + '</div>'
    + '<p class="sec-t">' + T('Шрифт') + '</p><div class="menu">' + FONTS.map(([k, n]) => '<button data-ff="' + k + '"' + (k === p.f ? ' aria-current="true"' : '') + '><span class="ic ff-' + k + '">Aa</span><span class="ff-' + k + '">' + T(n) + '<small>2019 Toyota Camry SE · $4,350</small></span>' + (k === p.f ? '<span class="chk">✓</span>' : '') + '</button>').join('') + '</div>', false);
}
function setFont(k, v) { const p = fontPref(); p[k] = v; LS.set('font-v1', p); applyFont(); fontSheet(); if (!['home','picks','lots','results'].includes(S.tab)) render(); }
function langSheet() {
  openSheet(T('Язык'), '<div class="menu">' + LANGS.map(([k, f, n]) => '<button data-lang="' + k + '"' + (k === LANG ? ' aria-current="true"' : '') + '><span class="ic flag">' + f + '</span><span>' + n + '</span>' + (k === LANG ? '<span class="chk">✓</span>' : '') + '</button>').join('') + '</div>', false);
}

/* ---------- установка ---------- */
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
function installSheet() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let h = '';
  if (isStandalone()) h = '<p class="txt">' + T('Приложение уже установлено. Обновления приходят сами, когда вы открываете его с интернетом.') + '</p>';
  else if (S.deferredInstall) h = '<p class="txt">' + (platform() === 'desktop' ? T('Нажмите кнопку, и «Аукционы» откроются в отдельном окне, а иконка появится на рабочем столе и в меню «Пуск» или в Dock.') : T('Нажмите кнопку, и иконка «Аукционы» появится на экране телефона.')) + '</p><div class="btns" style="grid-template-columns:1fr"><button class="btn pri" data-act="do-install">' + T('Установить приложение') + '</button></div>';
  const desk = '<h2>' + T('Компьютер: Chrome или Edge') + '</h2><ol class="steps"><li>' + T('Откройте ссылку в ') + '<b>Chrome</b>' + T(' или ') + '<b>Edge</b>.</li><li>' + T('Нажмите значок установки ⊕ справа в адресной строке.') + '</li><li>' + T('Если значка нет: меню ⋮ → «Трансляция, сохранение и отправка» → «Установить страницу как приложение». В Edge: ⋯ → «Приложения» → «Установить этот сайт как приложение».') + '</li></ol>'
    + '<h2>Mac: Safari</h2><ol class="steps"><li>' + T('Откройте ссылку в ') + '<b>Safari</b>.</li><li>' + T('Меню «Файл» → «Добавить в Dock».') + '</li></ol>';
  if (platform() === 'desktop') h += desk;
  h += '<h2>iPhone</h2><ol class="steps"><li>' + T('Откройте эту ссылку в ') + '<b>Safari</b>.</li><li>' + T('Нажмите «Поделиться» ') + '<span aria-hidden="true">' + T('(квадрат со стрелкой ↑)') + '</span>' + T(' внизу экрана.') + '</li><li>' + T('Выберите «На экран “Домой”» и нажмите «Добавить».') + '</li></ol>'
    + '<h2>Android</h2><ol class="steps"><li>' + T('Откройте ссылку в ') + '<b>Chrome</b>.</li><li>' + T('Нажмите ⋮ в правом верхнем углу.') + '</li><li>' + T('Выберите «Установить приложение» или «Добавить на главный экран».') + '</li></ol>'
    + (platform() === 'desktop' ? '' : desk)
    + '<p class="txt muted" style="margin-top:12px">' + T('После установки приложение открывается без браузера, помнит избранное и заметки и работает на аукционе даже без связи. Новые лоты приходят сами.') + '</p>';
  if (ios && !isStandalone()) h = '<p class="banner" style="display:block">' + T('Вы на iPhone: шаги ниже.') + '</p>' + h;
  openSheet(installTitle(), h, true);
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.deferredInstall = e; if ($('#welcome')) welcome(); });
function platform() {
  const ua = navigator.userAgent, ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|Telegram|WhatsApp|Instagram|FBAN|FBAV|Line\/|GSA\//i.test(ua) || !/Safari/i.test(ua) ? 'ios-other' : 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}
function welcome() {
  const pf = platform();
  let el = $('#welcome'); if (!el) { el = document.createElement('div'); el.id = 'welcome'; el.className = 'welcome'; document.body.appendChild(el); document.body.style.overflow = 'hidden'; }
  let how = '';
  if (pf === 'android' && S.deferredInstall) how = '<button class="w-btn" data-act="w-install">' + T('Установить приложение') + '</button><p class="w-small">' + T('Иконка появится в списке приложений, как у обычного приложения.') + '</p>';
  else if (pf === 'android') how = '<ol class="w-steps"><li>' + T('Нажмите ') + '<b>⋮</b>' + T(' справа вверху в Chrome') + '</li><li>' + T('Выберите ') + '<b>' + T('«Установить приложение»') + '</b></li><li>' + T('Нажмите ') + '<b>' + T('«Установить»') + '</b></li></ol>';
  else if (pf === 'ios') how = '<ol class="w-steps"><li>' + T('Нажмите ') + '<b>' + T('«Поделиться»') + '</b> <span class="w-share">' + SHARE_ICON + '</span>' + T(' внизу экрана') + '</li><li>' + T('Прокрутите и выберите ') + '<b>' + T('«На экран „Домой“»') + '</b></li><li>' + T('Нажмите ') + '<b>' + T('«Добавить»') + '</b></li></ol><div class="w-arrow" aria-hidden="true">↓</div>';
  else if (pf === 'ios-other') how = '<p class="w-warn">' + T('На iPhone приложение ставится только из ') + '<b>Safari</b>' + T('. Скопируйте ссылку и откройте её в Safari.') + '</p><button class="w-btn" data-act="w-copy">' + T('Скопировать ссылку') + '</button>';
  el.innerHTML = '<div class="w-in"><img src="icons/icon-512.png" alt="" width="104" height="104" class="w-icon"><h1>' + T('Аукционы Хьюстона') + '</h1><p class="w-sub">' + T('Лоты автоаукционов с MMR, максимальной ставкой и прибылью') + '</p>'
    + '<ul class="w-feat"><li>' + T('Подборка машин на каждые торги') + '</li><li>' + T('Сканер VIN: наведите камеру, и машина откроется') + '</li><li>' + T('Работает на площадке без интернета') + '</li><li>' + T('Новые лоты приходят сами') + '</li></ul>'
    + '<div class="w-how">' + how + '</div><button class="w-skip" data-act="w-skip">' + T('Открыть без установки') + '</button></div>';
}
const SHARE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
function closeWelcome(remember) { const el = $('#welcome'); if (el) el.remove(); document.body.style.overflow = ''; if (remember) LS.set('w-skip', Date.now()); }
document.addEventListener('click', async e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.act === 'w-skip') closeWelcome(true);
  else if (t.dataset.act === 'w-copy') copy(location.href.split('#')[0]);
  else if (t.dataset.act === 'w-install' && S.deferredInstall) { S.deferredInstall.prompt(); const r = await S.deferredInstall.userChoice; S.deferredInstall = null; if (r.outcome === 'accepted') closeWelcome(false); else welcome(); }
});
window.addEventListener('appinstalled', () => { S.deferredInstall = null; closeWelcome(false); toast(T('Приложение установлено')); });

/* ---------- общее ---------- */
let toastT;
function toast(msg, btn, fn) {
  const t = $('#toast'); t.innerHTML = '<span>' + E(msg) + '</span>' + (btn ? '<button id="toastBtn">' + E(btn) + '</button>' : '');
  t.hidden = false; clearTimeout(toastT);
  if (btn) $('#toastBtn').onclick = () => { t.hidden = true; fn(); }; else toastT = setTimeout(() => t.hidden = true, 3500);
}
async function share(text, title) {
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  copy(text);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast(T('Скопировано')); }
  catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast(T('Скопировано')); } catch (x) {} t.remove(); }
}
function applyTheme() { const t = LS.get('theme', ''); if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); }
function cycleTheme() { const t = LS.get('theme', ''); LS.set('theme', t === '' ? 'dark' : t === 'dark' ? 'light' : ''); applyTheme(); toast({ dark: T('Тёмная тема'), light: T('Светлая тема'), '': T('Тема как в системе') }[LS.get('theme', '')]); if (!['home','picks','lots','results'].includes(S.tab)) render(); }
function go(tab) { S.tab = tab; LS.set('tab', tab); render(); window.scrollTo(0, 0); topBtn(); saveView(); }
function toggleFav(k) {
  const x = S.d.map[k]; if (!x) return;
  const fk = favKey(x); if (S.favs[fk]) delete S.favs[fk]; else S.favs[fk] = 1;
  LS.set('fav-v1', S.favs);
  document.querySelectorAll('[data-fav="' + CSS.escape(k) + '"]').forEach(b => { const on = !!S.favs[fk]; if (b.classList.contains('star')) { b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', on); } else b.textContent = on ? T('★ В избранном') : T('☆ В избранное'); });
  if (S.tab === 'picks' && S.picks === 'fav' && !sheetOpen) render();
}

document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-lot],a'); if (!t) return;
  if (e.target === $('#sheetBg')) return;
  const ds = t.dataset;
  if (ds.fav) { e.stopPropagation(); toggleFav(ds.fav); return; }
  if (ds.lang) { LS.set('lang', ds.lang); location.reload(); return; }
  if (ds.ff) { setFont('f', ds.ff); return; }
  if (ds.fz) { setFont('z', +ds.fz); return; }
  if (ds.tab) { if (sheetOpen) closeSheet(); go(ds.tab); return; }
  if (ds.date) { await loadDate(ds.date); S.f.quick = S.f.quick === 'fav' ? 'fav' : S.f.quick; render(); window.scrollTo(0, 0); return; }
  if (ds.go) { if (ds.pick) S.picks = ds.pick; if (ds.au != null) { S.f.au = ds.au; } if (ds.quick != null) S.f.quick = ds.quick; go(ds.go); return; }
  if (ds.pick) { S.picks = ds.pick; render(); return; }
  if (ds.pauc != null) { S.pickAuc = ds.pauc; render(); return; }
  if (ds.quick != null) { S.f.quick = ds.quick; document.querySelectorAll('[data-quick]').forEach(b => b.setAttribute('aria-pressed', b.dataset.quick === ds.quick)); drawLots(); return; }
  if (ds.rst != null) { S.rf.st = ds.rst; document.querySelectorAll('[data-rst]').forEach(b => b.setAttribute('aria-pressed', b.dataset.rst === ds.rst)); drawResults(); return; }
  if (ds.lot) { detail(ds.lot); return; }
  if (t.id === 'btnFilters') { filterSheet(); return; }
  if (t.id === 'btnTheme') { cycleTheme(); return; }
  switch (ds.act) {
    case 'close': closeSheet(); break;
    case 'more': S.shown += 24; drawLots('append'); break;
    case 'rmore': S.rshown += 80; drawResults(true); break;
    case 'fapply': {
      const v = id => { const el = $('#' + id); return el ? el.value : ''; };
      const chk = id => [...document.querySelectorAll('#' + id + ' input:checked')].map(i => i.value);
      const mks = chk('f_mk');
      Object.assign(S.f, { mk: mks, md: chk('f_md').filter(k => mks.includes(k.split('|')[0])), au: v('f_au'), cl: v('f_cl'), st: v('f_st'), y: v('f_y'), o: v('f_o'), p: v('f_p') });
      closeSheet(); if (S.tab !== 'lots') go('lots'); else render(); break;
    }
    case 'freset': Object.assign(S.f, { mk: [], md: [], au: '', cl: '', st: '', y: '', o: '', p: '' }); closeSheet(); render(); break;
    case 'notes': notesSheet(); break;
    case 'how': howSheet(); break;
    case 'install': installSheet(); break;
    case 'do-install': if (S.deferredInstall) { S.deferredInstall.prompt(); const r = await S.deferredInstall.userChoice; if (r.outcome === 'accepted') closeSheet(); S.deferredInstall = null; } break;
    case 'hide-install': LS.set('hide-install', true); render(); break;
    case 'share-app': share(T('Аукционы Хьюстона: лоты, MMR, прибыль и тайтл. Откройте и установите на телефон: ') + location.href.split('#')[0], T('Аукционы Хьюстона')); break;
    case 'share-lot': { const x = S.d.map[ds.k]; share(dLabel(S.d) + ', ' + (AUC[x.auc] || x.auc) + T(', лот ') + x.run + ': ' + carName(x) + (x.o ? ', ' + N(x.o) + ' mi' : '') + '. MMR ' + M(x.w) + T(', макс. ставка ') + M(x.max) + T(', прибыль ') + M(x.prof) + (x.ttl ? '. ' + x.ttl : '') + '. VIN ' + (x.vin || '') + (lotUrl(x) ? '\n' + lotUrl(x) : ''), carName(x)); break; }
    case 'share-notes': share(T('Мои заметки с осмотра:\n') + notesText(), T('Заметки')); break;
    case 'copy-notes': copy(notesText()); break;
    case 'copy': copy(ds.v); break;
    case 'refresh': await refresh(true); break;
    case 'theme': cycleTheme(); break;
    case 'lang': langSheet(); break;
    case 'font': fontSheet(); break;
  }
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.lot[data-lot]')) { e.preventDefault(); detail(e.target.dataset.lot); } if (e.key === 'Escape' && sheetOpen) closeSheet(); if (e.key === '/' && !sheetOpen && !e.target.matches('input,textarea,select') && $('#q')) { e.preventDefault(); $('#q').focus(); } });
$('#sheetBg').addEventListener('click', () => closeSheet());
let qT;
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'q') { clearTimeout(qT); qT = setTimeout(() => { S.f.q = e.target.value; drawLots(); }, 150); }
  else if (id === 'rq') { clearTimeout(qT); qT = setTimeout(() => { S.rf.q = e.target.value; drawResults(); }, 150); }
  else if (id === 'fee_auc' || id === 'fee_dealer') { clearTimeout(qT); qT = setTimeout(setFees, 250); }
  else if (id === 'bid') { const x = S.d.map[$('#note').dataset.k]; calc(x); }
  else if (id === 'note') { const st = $('#nstat'); if (st) st.textContent = T('Сохранится, когда закончите'); clearTimeout(qT); qT = setTimeout(() => saveNote(e.target), 800); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'sort') { S.f.sort = e.target.value; drawLots(); }
  else if (e.target.id === 'rsort') { S.rf.sort = e.target.value; drawResults(); }
  else if (e.target.id === 'note') saveNote(e.target);
  else if (e.target.closest('#f_mk')) { const g = document.querySelector('#f_md .md-g[data-mk="' + CSS.escape(e.target.value) + '"]'); if (g) g.hidden = !e.target.checked; }
});

/* ---------- запоминаем экран: вкладка, фильтры, прокрутка, открытый лот ---------- */
function saveView() {
  if (!S.d) return;
  const x = sheetOpen && S.openLot ? S.openLot : null;
  LS.set('view-v1', { tab: S.tab, date: S.date, f: S.f, picks: S.picks, shown: S.shown, y: Math.round(window.scrollY), lot: x, ts: Date.now() });
}
let saveT;
window.addEventListener('scroll', () => { clearTimeout(saveT); saveT = setTimeout(saveView, 250); topBtn(); }, { passive: true });
window.addEventListener('pagehide', saveView);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveView(); });
function keepScroll(fn) { const y = window.scrollY; S.keepShown = true; try { fn(); } finally { S.keepShown = false; } window.scrollTo(0, y); }
/* кнопка «наверх» */
function topBtn() {
  let b = $('#toTop');
  if (!b) { b = document.createElement('button'); b.id = 'toTop'; b.className = 'to-top'; b.setAttribute('aria-label', T('Наверх')); b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'; b.hidden = true; b.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' })); document.body.appendChild(b); }
  b.hidden = window.scrollY < 600;
}

async function refresh(manual) {
  try {
    const old = S.index && S.index.version;
    await loadIndex(true);
    if (S.index.version !== old) {
      const keep = S.index.dates.some(d => d.id === S.date) ? S.date : S.index.dates[0].id;
      await loadDate(keep); if (!sheetOpen) keepScroll(render);
    } else if (manual) toast(T('У вас последняя версия'));
    if (navigator.serviceWorker && navigator.serviceWorker.controller) { const r = await navigator.serviceWorker.getRegistration(); if (r) r.update(); }
  } catch (e) { if (manual) toast(T('Нет связи, показываю сохранённые данные')); }
}

async function start() {
  applyTheme();
  const bt = document.querySelector('.brand span'); if (bt) bt.textContent = { ru: 'Аукционы', en: 'Auctions', uk: 'Аукціони', es: 'Subastas', kk: 'Аукциондар' }[LANG];
  try {
    await loadIndex(false);
    const h = (location.hash || '').replace('#d-', '');
    const want = S.index.dates.some(d => d.id === h) ? h : LS.get('cur-date', null);
    const first = S.index.dates.some(d => d.id === want) && want !== null ? want : S.index.dates[0].id;
    // новая дата аукциона в данных: открываем её
    const newest = S.index.dates[0].id, seenNewest = LS.get('seen-newest', null);
    const jump = seenNewest && seenNewest !== newest;
    await loadDate(jump ? newest : first);
    LS.set('seen-newest', newest);
    const tb = LS.get('tab', 'home'); S.tab = ['home', 'picks', 'lots', 'results', 'more'].includes(tb) ? tb : 'home';
    // возвращаемся туда, где были: фильтры, прокрутка, открытый лот
    const sv = LS.get('view-v1', null);
    const same = sv && !jump && sv.date === S.date;
    if (same) {
      if (sv.f) S.f = { ...S.f, ...sv.f, mk: Array.isArray(sv.f.mk) ? sv.f.mk : [], md: Array.isArray(sv.f.md) ? sv.f.md : [] };
      if (sv.picks) S.picks = sv.picks;
      if (sv.shown) S.shown = Math.min(+sv.shown || 24, 2000);
      S.keepShown = true;
    }
    render(); S.keepShown = false;
    if (same) { requestAnimationFrame(() => { window.scrollTo(0, sv.y || 0); topBtn(); }); if (sv.lot && S.d.map[sv.lot]) { S.replaceNext = false; detail(sv.lot); } }
    warmScanner();
    const sk = LS.get('w-skip', 0);
    if (!isStandalone() && platform() !== 'desktop' && Date.now() - sk > 3 * 864e5) welcome();
  } catch (e) {
    $('#view').innerHTML = '<p class="empty">' + T('Не удалось загрузить данные. Проверьте интернет и откройте приложение ещё раз.') + '</p>';
  }
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) nw.postMessage('skip');
        });
      });
      let reloaded = false; const hadCtrl = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtrl && !reloaded) { reloaded = true; location.reload(); } });
    } catch (e) {}
  }
  refresh(false);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(false); });
}
applyFont();
start();

/* ---------- сканер VIN ---------- */
const VIN_RE = /[A-HJ-NPR-Z0-9]{17}/;
let VINS = null, scanStop = null;
async function vinIndex() {
  if (!VINS) VINS = await getJSON('data/vins.json?v=' + S.index.version);
  return VINS;
}
function cleanVin(t) {
  let s = String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/[IQ]/g, m => m);
  const m = s.match(VIN_RE); if (m) return m[0];
  if (s.length === 18 && /^I/.test(s)) return s.slice(1); // Code 39 на импортных машинах начинается с I
  return s;
}
async function findVin(raw) {
  const v = cleanVin(raw); if (v.length < 5) return { v, hits: [] };
  const idx = await vinIndex();
  let hits = idx[v] ? idx[v].map(h => ({ vin: v, d: h[0], k: h[1] })) : [];
  if (!hits.length) for (const [vin, arr] of Object.entries(idx)) if (vin.endsWith(v) || (v.length >= 10 && vin.startsWith(v))) arr.forEach(h => hits.push({ vin, d: h[0], k: h[1] }));
  const order = S.index.dates.map(d => d.id);
  hits.sort((a, b) => (a.d === S.date ? -1 : 0) - (b.d === S.date ? -1 : 0) || order.indexOf(a.d) - order.indexOf(b.d));
  return { v, hits };
}
async function openHit(h) {
  closeScan(true); S.replaceNext = true;
  if (S.date !== h.d) { await loadDate(h.d); render(); }
  detail(h.k);
}
async function handleVin(raw, fromCamera) {
  const res = $('#scanRes'); if (!res) return;
  const { v, hits } = await findVin(raw);
  const uniq = [...new Set(hits.map(h => h.vin))];
  if (hits.length && (uniq.length === 1)) {
    if (navigator.vibrate) navigator.vibrate(60);
    const others = hits.slice(1);
    if (!others.length) return openHit(hits[0]);
    res.hidden = false;
    res.innerHTML = '<b>' + E(uniq[0]) + '</b><br>' + T('Эта машина есть на нескольких торгах:') + hits.map((h, i) => '<button class="btn" style="width:100%" data-hit="' + i + '">' + E(fmtDate(h.d)) + T(' · лот ') + E(h.k.split('|')[1]) + ' · ' + E(AUC[h.k.split('|')[0]] || '') + '</button>').join('');
    res.onclick = e => { const b = e.target.closest('[data-hit]'); if (b) openHit(hits[+b.dataset.hit]); };
    return;
  }
  if (uniq.length > 1) {
    res.hidden = false;
    res.innerHTML = T('Подходят ') + uniq.length + T(' машин, выберите:') + hits.slice(0, 8).map((h, i) => '<button class="btn" style="width:100%" data-hit="' + i + '">…' + E(h.vin.slice(-8)) + ' · ' + E(fmtDate(h.d)) + T(' · лот ') + E(h.k.split('|')[1]) + '</button>').join('');
    res.onclick = e => { const b = e.target.closest('[data-hit]'); if (b) openHit(hits[+b.dataset.hit]); };
    return;
  }
  if (fromCamera && v.length !== 17) return;
  res.hidden = false;
  res.innerHTML = '<b class="vin">' + E(v) + '</b><br>' + (v.length === 17 ? T('Этой машины нет в каталогах приложения.') : T('Ничего не нашлось. Введите VIN целиком или последние 6–8 символов.')) + (v.length === 17 ? '<br><button class="btn" data-act="copy" data-v="' + E(v) + '">' + T('Скопировать VIN') + '</button>' : '');
}
/* ---------- распознавание: штрихкод и сверка в фоновом потоке, текст в Tesseract (тоже фоновый поток) ---------- */
let SW_ = null, swReady = null, swCb = null, OCR = null;
function scanWorker() {
  if (!swReady) swReady = new Promise(ok => {
    SW_ = new Worker('scan-worker.js');
    SW_.onmessage = e => { if (e.data.type === 'ready') ok(SW_); else if (swCb) swCb(e.data); };
    vinIndex().then(idx => SW_.postMessage({ type: 'idx', idx })).catch(() => {});
  });
  return swReady;
}
function ocrWorker() {
  if (!OCR) OCR = (async () => {
    if (!window.Tesseract) await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'vendor/tess/tesseract.min.js'; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
    const base = new URL('vendor/tess/', location.href).href;
    const w = await Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true, workerBlobURL: false });
    await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789', tessedit_pageseg_mode: '6' });
    return w;
  })().catch(e => { OCR = null; throw e; });
  return OCR;
}
// прогрев: сканер готов мгновенно, когда его открывают
function warmScanner() {
  const go = () => { scanWorker(); if (LS.get('scan-used', false)) ocrWorker().catch(() => {}); };
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 2500);
}

async function openScan() {
  LS.set('scan-used', true);
  const el = document.createElement('div'); el.className = 'scan'; el.id = 'scan';
  el.innerHTML = '<div class="bar"><button data-act="scan-close">' + T('Закрыть') + '</button><button data-act="torch" id="torch" hidden>' + T('Фонарик') + '</button></div><video playsinline muted autoplay></video><div class="frame"></div>'
    + '<p class="hint" id="scanHint">' + T('Наведите на штрихкод или надпись VIN, чтобы она была в рамке.') + '</p><div class="res" id="scanRes" hidden></div>'
    + '<form id="scanForm"><input id="vinIn" placeholder="' + T('VIN или последние 6 символов') + '" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="search" aria-label="VIN"><button>' + T('Найти') + '</button></form>';
  document.body.appendChild(el); document.body.style.overflow = 'hidden';
  try { history.pushState({ scan: 1 }, ''); } catch (e) {}
  el.querySelector('#scanForm').onsubmit = e => { e.preventDefault(); handleVin($('#vinIn').value, false); };
  const video = el.querySelector('video'), hint = $('#scanHint');
  let stream, alive = true, raf = 0;
  scanStop = () => { alive = false; cancelAnimationFrame(raf); swCb = null; if (stream) stream.getTracks().forEach(t => t.stop()); };
  const wP = scanWorker(), oP = ocrWorker().catch(() => null);   // грузятся параллельно с камерой
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { hint.textContent = T('Камера недоступна в этом браузере. Введите VIN вручную.'); return; }
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); }
  catch (e) { hint.textContent = T('Нет доступа к камере. Разрешите камеру в настройках браузера или введите VIN вручную.'); return; }
  if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
  video.srcObject = stream; try { await video.play(); } catch (e) {}
  const track = stream.getVideoTracks()[0];
  try { const cap = track.getCapabilities && track.getCapabilities(); if (cap && cap.torch) { const tb = $('#torch'); tb.hidden = false; let on = false; tb.onclick = () => { on = !on; track.applyConstraints({ advanced: [{ torch: on }] }); }; } if (cap && cap.focusMode && cap.focusMode.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}

  const W = await wP; if (!alive) return;
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  const oc = document.createElement('canvas'), ox = oc.getContext('2d', { willReadFrequently: true });
  let zBusy = false, oBusy = false, n = 0, done = false, seen = {}, last = '', ocr = null, ocrK = 0;
  oP.then(w => { ocr = w; });
  const accept = async (vin, how) => {
    if (done || !alive) return; $('#vinIn').value = vin;
    if (how === 'unknown') { if (vin === last) return; last = vin; const res = $('#scanRes'); res.hidden = false; res.innerHTML = T('Прочитал VIN ') + '<b class="vin">' + E(vin) + '</b>' + T('. Сверьте с надписью: если есть ошибка, исправьте в поле внизу. Этой машины нет в каталогах приложения.') + '<br><button class="btn" data-act="copy" data-v="' + E(vin) + '">' + T('Скопировать VIN') + '</button>'; if (navigator.vibrate) navigator.vibrate(60); return; }
    done = true; await handleVin(vin, false); done = !!$('#scan') ? false : true;
  };
  swCb = m => {
    if (m.type === 'code') { zBusy = false; if (m.vin) accept(m.vin, m.known ? 'known' : 'unknown'); }
    else if (m.type === 'ocr') {
      oBusy = false; const r = m.res; if (!r || !alive) return;
      if (r.raw) { hint.textContent = T('Читаю надпись: ') + r.raw + '…'; return; }
      seen[r.vin] = (seen[r.vin] || 0) + 1;
      if (r.exact || (r.d === 1) || seen[r.vin] >= 2) accept(r.vin, r.unknown ? 'unknown' : 'known');
      else hint.textContent = T('Читаю надпись: ') + (r.read || r.vin) + '…';
    }
  };
  const loop = () => {
    if (!alive) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (vw) {
      if (!zBusy) {   // штрихкод: полоса по центру, уменьшенная до ~1000 px; каждый третий кадр — вертикальный штрихкод
        const rot = n++ % 3 === 2;
        const sw = rot ? Math.round(vw * .5) : vw, sh = rot ? vh : Math.round(vh * .45), sx = (vw - sw) >> 1, sy = (vh - sh) >> 1;
        const k = Math.min(1, 1000 / Math.max(sw, sh)); cv.width = Math.round(sw * k); cv.height = Math.round(sh * k);
        cx.drawImage(video, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
        const img = cx.getImageData(0, 0, cv.width, cv.height);
        zBusy = true; W.postMessage({ type: 'frame', w: img.width, h: img.height, buf: img.data.buffer, rot }, [img.data.buffer]);
      }
      if (ocr && !oBusy) {   // надпись: узкая полоса рамки, разные масштабы по очереди
        oBusy = true;
        const sh = Math.round(vh * .26), sy = (vh - sh) >> 1, sw = Math.round(vw * .9), sx = (vw - sw) >> 1, k = Math.min([0.55, 0.85, 1.3][ocrK++ % 3], 1800 / sw);
        oc.width = Math.round(sw * k); oc.height = Math.round(sh * k); ox.drawImage(video, sx, sy, sw, sh, 0, 0, oc.width, oc.height);
        ocr.recognize(oc).then(r => { if (alive) W.postMessage({ type: 'text', text: r.data.text }); else oBusy = false; }).catch(() => { oBusy = false; });
      }
    }
    raf = requestAnimationFrame(loop);
  };
  hint.textContent = T('Наведите на штрихкод или надпись VIN, чтобы она была в рамке.');
  loop();
}
function closeScan(fromPop) {
  const el = $('#scan'); if (!el) return;
  if (scanStop) scanStop(); scanStop = null;
  el.remove(); document.body.style.overflow = '';
  if (!fromPop) { try { history.back(); } catch (e) {} }
}
window.addEventListener('popstate', () => { if ($('#scan')) closeScan(true); });
document.addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.id === 'btnScan') openScan();
  else if (t.dataset.act === 'scan-close') closeScan();
});
