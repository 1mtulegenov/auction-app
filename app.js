'use strict';
/* Аукционы Хьюстона — мобильное приложение (PWA). Данные: data/index.json и data/<дата>.json */
const FEE = 700;
const AUC = { AAH: 'AAA Houston', AAA: 'AAA Central', H1C: 'H1C', ANA: 'AutoNation', CMX: 'CarMax Conroe' };
const SEVEN = /^(Toyota|Honda|Hyundai|BMW|Volkswagen|Kia|Mercedes)/i;
const COLOR = { BLACK: 'чёрный', WHITE: 'белый', GRAY: 'серый', GREY: 'серый', SILVER: 'серебристый', RED: 'красный', BLUE: 'синий', BROWN: 'коричневый', TAN: 'бежевый', BEIGE: 'бежевый', GOLD: 'золотистый', GREEN: 'зелёный', PURPLE: 'фиолетовый', BURGUNDY: 'бордовый', MAROON: 'бордовый', ORANGE: 'оранжевый', YELLOW: 'жёлтый', TEAL: 'бирюзовый' };
const CLS = { salvage: ['bad', 'Salvage, rebuilt или без тайтла'], noinop: ['bad', 'Не на ходу или нет ключа'], hist: ['warn', 'Пометка на чистом тайтле'], clean: ['good', 'Без пометок'] };
const STAT = { 'Основная': 's-main', 'Флип': 's-flip', 'Дорого': 's-exp' };
const SS = { sold: 'Продана', offer: 'Buy Now / оффер', none: 'Не продана', gone: 'Снята', rerun: 'Снова на торгах' };
const HOT_R = /двигател|коробк|раздатк|дифференциал|не на ходу|engine|transmission|motor|trans\b|drivetrain/i;
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
  f: { q: '', mk: '', au: '', cl: '', st: '', y: '', o: '', p: '', quick: '' , sort: 'stat' },
  rf: { q: '', st: '', sort: 'run' },
  shown: 60, deferredInstall: null
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
  if (old && old !== idx.version) { S.cache = {}; toast('Данные обновлены: ' + fmtUpdated(idx.updated)); }
  LS.set('data-ver', idx.version);
  return idx;
}
async function loadDate(id) {
  if (!S.cache[id]) {
    const d = await getJSON('data/' + id + '.json?v=' + S.index.version);
    d.map = {}; d.lots.forEach(x => { x.k = x.auc + '|' + x.run; d.map[x.k] = x; });
    S.cache[id] = d;
  }
  S.date = id; S.d = S.cache[id]; LS.set('cur-date', id);
}
function fmtUpdated(iso) {
  try { const t = new Date(iso); return t.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
}

/* ---------- помощники ---------- */
function slot(x) { if (x.auc === 'CMX') return '8:00'; if (x.auc === 'ANA') return x.cls === 'noinop' ? '9:30' : '10:00'; if (x.auc === 'AAH') return '13:00'; if (x.auc === 'H1C') return '16:30'; return String(x.run)[0] === '7' ? '13:00' : '11:45'; }
function carName(x) { return [x.y, x.mk, x.md, x.st].filter(Boolean).join(' '); }
function fmtDate(id) { const p = String(id || '').split('-'); return p.length === 3 ? p[2] + '.' + p[1] : ''; }
function lotUrl(x) { return x.u ? x.u : x.s ? 'https://www.edgepipeline.com/components/vehicle/detail/' + x.s : ''; }
function favKey(x) { return S.date + '|' + x.k; }
function isFav(x) { return !!S.favs[favKey(x)]; }
function noteOf(x) { const n = x.vin && S.notes[x.vin]; return n && n.text ? n : null; }
function runKey(r) { const m = String(r || '').match(/^([A-Za-z]*)\D*(\d+)/); return m ? [m[1].toUpperCase(), +m[2]] : [String(r || ''), 0]; }
function hl(x) { const a = x.ar || x.a || ''; return a.split(/;\s*/).filter(Boolean).map(t => HOT_R.test(t) ? '<span class="hot-r">' + E(t) + '</span>' : HOT_Y.test(t) ? '<span class="hot-y">' + E(t) + '</span>' : E(t)).join('; '); }
function hasAnn(x) { const a = x.ar || x.a || ''; return a && !/^\s*(GREEN LIGHT|AS[- ]IS,?)\s*$/i.test(a); }
function profCls(x) { return x.prof == null ? '' : x.prof >= (x.margin || 1000) ? 'pos' : x.prof > 0 ? 'mid' : 'neg'; }
function chance(x) { if (x.max == null || !x.w) return null; const r = x.max / x.w; return r >= 1 ? ['good', 'высокий'] : r >= .85 ? ['warn', 'средний'] : ['bad', 'низкий']; }
function lightChip(x) {
  if (x.auc === 'CMX') return (x.mech ? '<span class="chip bad">Дефект двигателя/КПП</span>' : '') + (x.sel ? '<span class="chip good">CarMax Select</span>' : '') + (x.arbx ? '<span class="chip good">ARBX Plus</span>' : '');
  if (x.l === 'Green') return '<span class="chip good">Зелёный свет</span>';
  if (String(x.l || '').includes('Red')) return '<span class="chip bad">Красный свет</span>';
  if (x.l === 'Yellow') return '<span class="chip warn">Жёлтый свет</span>';
  return '';
}
function titleChip(x) {
  if (x.ttl) return '<span class="chip ' + (x.ttlbad ? 'bad' : 'good') + '">' + E(x.ttl) + '</span>';
  if (x.cls === 'salvage') return '<span class="chip bad">Salvage / без тайтла</span>';
  return '';
}
function factText(x) {
  if (!S.d.results) return '';
  if (x.fact) { const pr = x.sale != null ? x.sale - x.fact - FEE : null; return '<p class="fact"><b>Продана за ' + M(x.fact) + '</b>' + (x.w ? ', ' + Math.round(100 * x.fact / x.w) + '% от MMR' : '') + (pr != null ? '. Прибыль была бы ' + M(pr) : '') + (x.max != null ? (x.max >= x.fact ? '. Наша ставка брала.' : '. Наша ставка не брала.') : '') + '</p>'; }
  if (x.ss) return '<p class="fact">' + E(SS[x.ss] || x.ss) + (x.ss === 'offer' && x.bnf ? ', ' + M(x.bnf) : '') + (x.ss === 'rerun' && x.rr ? ', лот ' + E(x.rr) : '') + '</p>';
  return '';
}

/* ---------- карточка лота ---------- */
function lotCard(x) {
  const n = noteOf(x), ch = chance(x);
  let chips = titleChip(x) + lightChip(x);
  if (x.g) { const g = parseFloat(x.g); chips += '<span class="chip ' + (g >= 4 ? 'good' : g < 3 ? 'bad' : 'warn') + '">Оценка ' + E(x.g) + '</span>'; }
  if (x.t && x.auc !== 'H1C') chips += x.t === 'At Auction' ? '<span class="chip good">Тайтл на месте</span>' : '<span class="chip warn">Тайтла нет на площадке</span>';
  if (x.cls && x.cls !== 'clean' && x.cls !== 'salvage') chips += '<span class="chip ' + CLS[x.cls][0] + '">' + CLS[x.cls][1] + '</span>';
  if (x.hist) chips += '<span class="chip bad">Пометка в истории</span>';
  if (ch) chips += '<span class="chip ' + ch[0] + '">Шанс: ' + ch[1] + '</span>';
  return '<div class="lot ' + (STAT[x.stat] || '') + '" role="button" tabindex="0" data-lot="' + E(x.k) + '">'
    + '<div class="lot-top"><span class="run">' + E(x.run) + '</span><span class="where">' + E(AUC[x.auc] || x.auc) + ' · ' + slot(x) + (x.stat ? ' · ' + E(x.stat) : '') + '</span></div>'
    + '<button class="star' + (isFav(x) ? ' on' : '') + '" data-fav="' + E(x.k) + '" aria-label="В избранное" aria-pressed="' + isFav(x) + '">' + (isFav(x) ? '★' : '☆') + '</button>'
    + '<h3>' + E(carName(x)) + '</h3>'
    + '<p class="sub">' + (x.o > 500 ? N(x.o) + ' mi · ' : '') + E(COLOR[x.c] || String(x.c || '').toLowerCase()) + (x.demand ? ' · спрос ' + x.demand + '/10' : '') + '</p>'
    + (chips ? '<div class="chips">' + chips + '</div>' : '')
    + (hasAnn(x) ? '<p class="ann">' + hl(x) + '</p>' : x.whyn && (HOT_R.test(x.whyn) || HOT_Y.test(x.whyn)) ? '<p class="ann">' + hl({ a: x.whyn }) + '</p>' : '')
    + '<div class="nums3"><div class="hl"><b>' + M(x.w) + '</b><span>MMR</span></div><div><b>' + M(x.max) + '</b><span>макс. ставка</span></div><div><b class="' + profCls(x) + '">' + M(x.prof) + '</b><span>прибыль</span></div></div>'
    + factText(x)
    + (n ? '<p class="note-pv">📝 ' + E(n.text.slice(0, 120)) + '</p>' : '')
    + '</div>';
}

/* ---------- фильтры ---------- */
const QUICK = [['', 'Все'], ['fav', '★ Избранное'], ['pick', 'Подборка'], ['seven', '7 марок'], ['clean', 'Без пометок'], ['title', 'Тайтл на месте'], ['profit', 'Прибыль > 0'], ['notes', 'С заметкой']];
const SORTS = [['stat', 'Сначала подборка'], ['prof', 'Прибыль больше'], ['w', 'MMR меньше'], ['wd', 'MMR больше'], ['run', 'По номеру лота'], ['y', 'Новее'], ['o', 'Пробег меньше'], ['diff', 'Ретейл − MMR больше']];
function applyFilters(list) {
  const f = S.f, q = f.q.toLowerCase().trim(), y = +f.y || 0, o = +f.o || 0, p = +f.p || 0;
  const lotQ = q.replace(/\s/g, '').toUpperCase();
  let a = list.filter(x => {
    if (q) { const hay = (x.run + ' ' + carName(x) + ' ' + (x.vin || '')).toLowerCase(); if (!hay.includes(q) && String(x.run).replace(/[\s-]/g, '').toUpperCase() !== lotQ.replace(/-/g, '')) return false; }
    if (f.mk && x.mk !== f.mk) return false;
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
    run: (u, v) => { const a1 = runKey(u.run), b1 = runKey(v.run); return a1[0].localeCompare(b1[0]) || a1[1] - b1[1]; },
    y: (u, v) => (v.y || 0) - (u.y || 0),
    o: (u, v) => nn(u.o, 1e9) - nn(v.o, 1e9),
    diff: (u, v) => (v.w == null ? -1e9 : v.r - v.w) - (u.w == null ? -1e9 : u.r - u.w)
  };
  a.sort(by[f.sort] || by.stat);
  return a;
}
function activeFilterCount() { const f = S.f; return ['mk', 'au', 'cl', 'st', 'y', 'o', 'p'].filter(k => f[k]).length; }

/* ---------- экраны ---------- */
const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  picks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>',
  lots: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>',
  results: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
};
function tabs() {
  const t = [['home', 'Главное'], ['picks', 'Подборка'], ['lots', 'Все лоты']];
  if (S.d && S.d.results) t.push(['results', 'Итоги']);
  t.push(['more', 'Ещё']);
  if (S.tab === 'results' && !(S.d && S.d.results)) S.tab = 'home';
  $('#tabbar').innerHTML = t.map(([k, l]) => '<button data-tab="' + k + '"' + (S.tab === k ? ' aria-current="page"' : '') + '>' + ICONS[k] + '<span>' + l + '</span></button>').join('');
}
function datesBar() {
  $('#dates').innerHTML = S.index.dates.map(d => '<button data-date="' + d.id + '" aria-pressed="' + (d.id === S.date) + '">' + E(d.label) + '<small>' + E(shortAuc(d.title)) + '</small></button>').join('');
  const on = $('#dates [aria-pressed="true"]'); if (on) on.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}
function shortAuc(t) { t = String(t || '').split(',')[0]; const m = t.match(/CarMax|AutoNation|AAA Houston|AAA|H1C|1st Choice|Manheim|Copart|IAA|ADESA/gi); return m ? [...new Set(m)].join(' + ') : t.slice(0, 18); }

function render() {
  tabs(); datesBar();
  const v = $('#view');
  if (S.tab === 'home') v.innerHTML = home();
  else if (S.tab === 'picks') v.innerHTML = picks();
  else if (S.tab === 'lots') { v.innerHTML = lotsScreen(); drawLots(); }
  else if (S.tab === 'results') { v.innerHTML = resultsScreen(); drawResults(); }
  else v.innerHTML = more();
}
function installBanner() {
  if (isStandalone() || LS.get('hide-install', false)) return '';
  return '<div class="banner"><div style="flex:1"><b>Установите как приложение</b><span class="muted">Иконка на экране, открывается без браузера и работает без интернета.</span></div><button class="btn pri" data-act="install">Как</button><button class="x" data-act="hide-install" aria-label="Скрыть">×</button></div>';
}
function home() {
  const d = S.d;
  const favN = d.lots.filter(isFav).length, notesN = d.lots.filter(noteOf).length;
  const best = d.core.concat(d.flip).map(k => d.map[k]).filter(Boolean).sort((a, b) => (b.prof || 0) - (a.prof || 0)).slice(0, 6);
  const aucs = {}; d.lots.forEach(x => { aucs[x.auc] = aucs[x.auc] || { n: 0, t: slot(x) }; aucs[x.auc].n++; });
  return installBanner()
    + '<div class="hd"><h1>' + E(d.title) + '</h1><p>' + E(d.lead) + '</p></div>'
    + '<div class="tiles">'
    + '<button class="tile" data-go="lots" data-quick=""><b>' + d.lots.length + '</b><span>лотов в каталоге</span></button>'
    + '<button class="tile" data-go="picks" data-pick="core"><b>' + d.core.length + '</b><span>дороже $5 000 в подборке</span></button>'
    + '<button class="tile" data-go="picks" data-pick="flip"><b>' + d.flip.length + '</b><span>для флипа до $5 000</span></button>'
    + '<button class="tile" data-go="picks" data-pick="fav"><b>' + favN + '</b><span>в избранном' + (notesN ? ', заметок ' + notesN : '') + '</span></button>'
    + '</div>'
    + (Object.keys(aucs).length > 1 ? '<h2>Площадки</h2><div class="rows">' + Object.entries(aucs).map(([a, o]) => '<button class="r" data-go="lots" data-au="' + a + '"><div class="l"><b>' + E(AUC[a] || a) + '</b><br><small>старт около ' + o.t + '</small></div><div class="rt"><b>' + o.n + '</b><small>лотов</small></div></button>').join('') + '</div>' : '')
    + (best.length ? '<h2>Лучшие по прибыли</h2><div class="list">' + best.map(lotCard).join('') + '</div><button class="more" data-go="picks">Вся подборка</button>' : '')
    + '<p class="foot">Данные обновлены ' + E(fmtUpdated(S.index.updated)) + '. Комиссия ' + M(FEE) + ' на машину.</p>';
}
function picks() {
  const d = S.d;
  const seg = [['core', '$5 000+', d.core.length], ['flip', 'Флип', d.flip.length], ['fav', '★ Мои', d.lots.filter(isFav).length]];
  let list = S.picks === 'fav' ? d.lots.filter(isFav) : (d[S.picks] || []).map(k => d.map[k]).filter(Boolean);
  const aucs = [...new Set(list.map(x => x.auc))];
  const pa = S.pickAuc && aucs.includes(S.pickAuc) ? S.pickAuc : '';
  if (pa) list = list.filter(x => x.auc === pa);
  return '<div class="seg" role="group">' + seg.map(([k, l, n]) => '<button data-pick="' + k + '" aria-pressed="' + (S.picks === k) + '">' + l + ' <span class="muted">' + n + '</span></button>').join('') + '</div>'
    + (aucs.length > 1 ? '<div class="qf">' + [''].concat(aucs).map(a => '<button data-pauc="' + a + '" aria-pressed="' + (pa === a) + '">' + (a ? E(AUC[a] || a) : 'Все площадки') + '</button>').join('') + '</div>' : '')
    + (list.length ? '<div class="list">' + list.map(lotCard).join('') + '</div>'
      : '<p class="empty">' + (S.picks === 'fav' ? 'Пока пусто. Нажмите ☆ на карточке машины, чтобы собрать свой список на торги.' : 'В подборке на эту дату машин нет.') + '</p>');
}
function lotsScreen() {
  const fc = activeFilterCount();
  return '<div class="searchbar"><input type="search" id="q" placeholder="Модель, лот или VIN" value="' + E(S.f.q) + '" autocomplete="off" enterkeyhint="search" aria-label="Поиск"><button id="btnFilters" class="' + (fc ? 'on' : '') + '">Фильтры' + (fc ? ' · ' + fc : '') + '</button></div>'
    + '<div class="qf">' + QUICK.map(([k, l]) => '<button data-quick="' + k + '" aria-pressed="' + (S.f.quick === k) + '">' + l + '</button>').join('') + '</div>'
    + '<div class="count"><span id="cnt"></span><select id="sort" aria-label="Сортировка">' + SORTS.map(([k, l]) => '<option value="' + k + '"' + (S.f.sort === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>'
    + '<div class="list" id="lotlist"></div><div id="lotmore"></div>';
}
function drawLots(keep) {
  const a = applyFilters(S.d.lots);
  if (!keep) S.shown = 60;
  $('#cnt').textContent = 'Показано ' + Math.min(a.length, S.shown) + ' из ' + a.length + (a.length !== S.d.lots.length ? ' (всего ' + S.d.lots.length + ')' : '');
  $('#lotlist').innerHTML = a.length ? a.slice(0, S.shown).map(lotCard).join('') : '<p class="empty">Ничего не нашлось. Попробуйте убрать фильтры.</p>';
  $('#lotmore').innerHTML = a.length > S.shown ? '<button class="more" data-act="more">Показать ещё ' + Math.min(60, a.length - S.shown) + '</button>' : '';
}
function filterSheet() {
  const d = S.d, f = S.f;
  const opt = (arr, v) => arr.map(([k, l]) => '<option value="' + E(k) + '"' + (String(v) === String(k) ? ' selected' : '') + '>' + E(l) + '</option>').join('');
  const mk = [...new Set(d.lots.map(x => x.mk).filter(Boolean))].sort();
  const aucs = [...new Set(d.lots.map(x => x.auc))];
  const st = [...new Set(d.lots.map(x => x.stat).filter(Boolean))];
  openSheet('Фильтры', '<div class="fl">'
    + '<label for="f_mk">Марка</label><select id="f_mk">' + opt([['', 'Все марки']].concat(mk.map(m => [m, m])), f.mk) + '</select>'
    + (aucs.length > 1 ? '<label for="f_au">Площадка</label><select id="f_au">' + opt([['', 'Все площадки']].concat(aucs.map(a => [a, AUC[a] || a])), f.au) + '</select>' : '')
    + '<label for="f_cl">История и тайтл</label><select id="f_cl">' + opt([['', 'Любая'], ['clean', 'Без пометок'], ['hist', 'Пометки на чистом тайтле'], ['noinop', 'Не на ходу, нет ключа'], ['salvage', 'Salvage, rebuilt, без тайтла']], f.cl) + '</select>'
    + '<label for="f_st">Решение</label><select id="f_st">' + opt([['', 'Любое']].concat(st.map(s => [s, s])), f.st) + '</select>'
    + '<div class="row"><div><label for="f_y">Год от</label><input id="f_y" type="number" inputmode="numeric" value="' + E(f.y) + '" placeholder="2012"></div><div><label for="f_o">Пробег до</label><input id="f_o" type="number" inputmode="numeric" value="' + E(f.o) + '" placeholder="150000"></div><div><label for="f_p">MMR до</label><input id="f_p" type="number" inputmode="numeric" value="' + E(f.p) + '" placeholder="8000"></div></div>'
    + '<div class="btns"><button class="btn" data-act="freset">Сбросить</button><button class="btn pri" data-act="fapply">Показать</button></div></div>', false);
}
function resultsScreen() {
  const s = S.d.stats || {}, g = o => o && o.r != null ? o.r + '% <small>(' + o.n + ')</small>' : '—';
  return '<div class="hd"><h1>Итоги торгов</h1><p>Сколько машины реально стоили относительно MMR.</p></div>'
    + '<div class="tiles"><div class="tile"><b>' + (s.n ?? '—') + '</b><span>продано' + (s.u != null ? ', не продано ' + s.u : '') + '</span></div>'
    + '<div class="tile"><b>' + (s.w ?? '—') + '%</b><span>медиана: цена к MMR' + (s.wn ? ', ' + s.wn + ' лотов' : '') + '</span></div>'
    + '<div class="tile"><b>' + (s.ps ?? '—') + ' из ' + (s.pn ?? '—') + '</b><span>машин подборки продано</span></div>'
    + '<div class="tile"><b>' + (s.pw ?? '—') + '</b><span>ушли не дороже нашей ставки</span></div></div>'
    + '<h2>По оценке</h2><div class="rows">' + [['Оценка 4+', s.g4], ['Оценка 3–3,9', s.g3], ['Ниже 3', s.g2], ['Без оценки', s.gn]].map(([l, o]) => '<div class="r"><div class="l">' + l + '</div><div class="rt">' + g(o) + '</div></div>').join('') + '</div>'
    + '<h2>Все результаты</h2><div class="searchbar"><input type="search" id="rq" placeholder="Модель или лот" value="' + E(S.rf.q) + '" aria-label="Поиск"></div>'
    + '<div class="qf">' + [['', 'Все'], ['sold', 'Продана'], ['none', 'Не продана'], ['offer', 'Оффер'], ['rerun', 'Снова на торгах']].map(([k, l]) => '<button data-rst="' + k + '" aria-pressed="' + (S.rf.st === k) + '">' + l + '</button>').join('') + '</div>'
    + '<div class="count"><span id="rcnt"></span><select id="rsort" aria-label="Сортировка">' + [['run', 'По лоту'], ['up', 'Дороже MMR'], ['down', 'Дешевле MMR'], ['f', 'Цена меньше']].map(([k, l]) => '<option value="' + k + '"' + (S.rf.sort === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>'
    + '<div class="rows" id="rlist"></div><div id="rmore"></div>';
}
function drawResults(keep) {
  const R = S.d.results || [], q = S.rf.q.toLowerCase().trim(), st = S.rf.st, s = S.rf.sort;
  const m = x => x.w || x.mmr, df = x => m(x) && x.fact ? x.fact - m(x) : null;
  let a = R.filter(x => (!st || x.ss === st || (st === 'sold' && !x.ss && x.fact)) && (!q || (x.run + ' ' + x.d).toLowerCase().includes(q)));
  a.sort((u, v) => s === 'up' ? (df(v) ?? -1e9) - (df(u) ?? -1e9) : s === 'down' ? (df(u) ?? 1e9) - (df(v) ?? 1e9) : s === 'f' ? (u.fact || 1e9) - (v.fact || 1e9) : (() => { const a1 = runKey(u.run), b1 = runKey(v.run); return a1[0].localeCompare(b1[0]) || a1[1] - b1[1]; })());
  if (!keep) S.rshown = 80;
  $('#rcnt').textContent = 'Показано ' + Math.min(a.length, S.rshown) + ' из ' + a.length;
  $('#rlist').innerHTML = a.slice(0, S.rshown).map(x => { const k = x.auc + '|' + x.run, has = S.d.map[k], d1 = df(x);
    return '<' + (has ? 'button data-lot="' + E(k) + '"' : 'div') + ' class="r"><div class="l"><b>' + E(x.run) + '</b> <small>' + E(AUC[x.auc] || x.auc) + '</small><br>' + E(x.d) + '<br><small>' + (x.o ? N(x.o) + ' mi · ' : '') + (x.g ? 'оценка ' + E(x.g) + ' · ' : '') + 'MMR ' + M(m(x)) + '</small></div><div class="rt"><b>' + (x.fact ? M(x.fact) : E(SS[x.ss] || '—')) + '</b>' + (d1 != null ? '<small class="' + (d1 > 0 ? 'pos' : d1 < 0 ? 'neg' : '') + '">' + (d1 > 0 ? '+' : '') + M(d1) + ' · ' + Math.round(100 * x.fact / m(x)) + '%</small>' : '') + '</div></' + (has ? 'button' : 'div') + '>'; }).join('') || '<p class="empty">Ничего не нашлось.</p>';
  $('#rmore').innerHTML = a.length > S.rshown ? '<button class="more" data-act="rmore">Показать ещё</button>' : '';
}
function more() {
  const notes = Object.entries(S.notes).filter(([, n]) => n && n.text);
  return '<div class="menu">'
    + '<button data-act="notes"><span class="ic">📝</span><span>Мои заметки<small>' + (notes.length ? notes.length + ' шт., привязаны к VIN' : 'Пока нет. Пишутся в карточке машины.') + '</small></span></button>'
    + '<button data-act="how"><span class="ic">🧮</span><span>Как считается прибыль<small>MMR, сбор, цена продажи, максимальная ставка</small></span></button>'
    + '<button data-act="install"><span class="ic">📲</span><span>Установить на телефон<small>' + (isStandalone() ? 'Уже установлено' : 'iPhone и Android, без App Store') + '</small></span></button>'
    + '<button data-act="share-app"><span class="ic">🔗</span><span>Поделиться приложением<small>Отправить ссылку другу</small></span></button>'
    + '<button data-act="refresh"><span class="ic">🔄</span><span>Проверить обновления<small>Данные от ' + E(fmtUpdated(S.index.updated)) + '</small></span></button>'
    + '<button data-act="theme"><span class="ic">◐</span><span>Тема оформления<small>' + ({ light: 'Светлая', dark: 'Тёмная' }[LS.get('theme', '')] || 'Как в системе') + '</small></span></button>'
    + '</div><p class="foot">Аукционы Хьюстона · версия данных ' + E(S.index.version) + '<br>Цены ориентировочные: MMR и ретейл Manheim, без осмотра машины.</p>';
}

/* ---------- шторка ---------- */
let sheetOpen = false;
function openSheet(title, html, full, actions) {
  const sh = $('#sheet');
  sh.className = 'sheet' + (full ? ' full' : '');
  sh.innerHTML = (full ? '' : '<div class="grip"></div>') + '<div class="sheet-h"><h2 id="sheetTitle">' + title + '</h2>' + (actions || '') + '<button data-act="close">' + (full ? 'Назад' : 'Готово') + '</button></div>' + html;
  sh.hidden = false; $('#sheetBg').hidden = false; document.body.style.overflow = 'hidden';
  sh.scrollTop = 0;
  if (!sheetOpen) { try { if (S.replaceNext) history.replaceState({ sheet: 1 }, ''); else history.pushState({ sheet: 1 }, ''); } catch (e) {} }
  S.replaceNext = false;
  sheetOpen = true;
}
function closeSheet(fromPop) {
  if (!sheetOpen) return;
  const ta = $('#sheet textarea.note'); if (ta) saveNote(ta);
  $('#sheet').hidden = true; $('#sheetBg').hidden = true; document.body.style.overflow = '';
  sheetOpen = false;
  if (!fromPop) { try { history.back(); } catch (e) {} }
  if (S.tab === 'lots') drawLots(true); else if (S.tab !== 'results') render();
}
window.addEventListener('popstate', () => { if (sheetOpen) closeSheet(true); });

function detail(k) {
  const x = S.d.map[k]; if (!x) return;
  const n = noteOf(x), link = lotUrl(x), ch = chance(x);
  const bid = x.max != null && x.max > 0 ? x.max : x.w || '';
  let chips = titleChip(x) + lightChip(x);
  if (x.g) chips += '<span class="chip">Оценка ' + E(x.g) + '</span>';
  if (x.t) chips += x.t === 'At Auction' ? '<span class="chip good">Тайтл на месте</span>' : '<span class="chip warn">' + E(x.t) + '</span>';
  if (x.cls) chips += '<span class="chip ' + (CLS[x.cls] || CLS.clean)[0] + '">' + (CLS[x.cls] || CLS.clean)[1] + '</span>';
  if (ch) chips += '<span class="chip ' + ch[0] + '">Шанс купить: ' + ch[1] + '</span>';
  if (x.bn) chips += '<span class="chip">Buy Now ' + M(x.bn) + '</span>';
  let info = '';
  if (x.cr) info += '<p class="p acc">' + E(x.cr) + '</p>';
  if (hasAnn(x)) info += '<p class="p">Пометка аукциона: ' + hl(x) + '</p>';
  if (x.whyn) info += '<p class="p">Почему не в подборке: ' + (HOT_R.test(x.whyn) ? '<span class="hot-r">' + E(x.whyn) + '</span>' : HOT_Y.test(x.whyn) ? '<span class="hot-y">' + E(x.whyn) + '</span>' : E(x.whyn)) + '</p>';
  if (x.prior) info += '<p class="p wrn">Уже была на торгах ' + fmtDate(x.prior.date) + ' за ' + M(x.prior.price) + '.' + (x.w && x.prior.price < .7 * x.w ? ' Это намного ниже MMR: возможен скрытый дефект.' : '') + '</p>';
  if (x.seen) info += '<p class="p wrn">Была в каталоге ' + E(x.seen) + ': выставляется повторно.</p>';
  if (x.hx) info += '<p class="p ' + (x.hxbad ? 'wrn' : '') + '"><b>История (AutoCheck):</b> ' + E(x.hx) + '</p>';
  if (x.risk) info += '<p class="p"><b>Слабые места модели</b> (в прибыль не входят): ' + E(x.risk) + '</p>';
  if (x.cons) info += '<p class="p muted">Продавец: ' + E(x.cons) + (x.drv && x.drv !== 'N/A' ? ' · ' + E(x.drv) : '') + (x.eng ? ' · ' + E(x.eng) : '') + '</p>';
  const html = '<div class="d-card"><div class="lot-top"><span class="run">' + E(x.run) + '</span><span class="where">' + E(AUC[x.auc] || x.auc) + ' · ' + S.d.label + ', ' + slot(x) + '</span></div>'
    + '<h3 class="d-name">' + E(carName(x)) + '</h3><p class="sub">' + (x.o > 500 ? N(x.o) + ' mi · ' : '') + E(COLOR[x.c] || String(x.c || '').toLowerCase()) + (x.tr ? ' · Manheim: ' + E(x.tr) : '') + '</p>'
    + (chips ? '<div class="chips">' + chips + '</div>' : '') + factText(x) + '</div>'
    + '<div class="d-card"><div class="grid6"><div class="hl"><b>' + M(x.w) + '</b><span>Adjusted MMR</span></div><div><b>' + M(x.w != null ? x.w + FEE : null) + '</b><span>MMR + сбор ' + M(FEE) + '</span></div><div><b>' + M(x.r) + '</b><span>ретейл Manheim</span></div><div><b>' + M(x.sale) + '</b><span>цена продажи</span></div><div><b class="' + profCls(x) + '">' + M(x.prof) + '</b><span>прибыль по MMR</span></div><div><b>' + M(x.max) + '</b><span>макс. ставка' + (x.margin ? ' (прибыль ' + M(x.margin) + ')' : '') + '</span></div></div>'
    + (x.demand ? '<p class="p"><b>Спрос ' + x.demand + '/10</b>' + (x.sell ? ', продаётся за ' + E(x.sell) : '') + '</p>' : '') + '</div>'
    + (x.sale != null ? '<div class="d-card"><h3>Калькулятор ставки</h3><div class="calc"><input id="bid" type="number" inputmode="numeric" value="' + E(bid) + '" aria-label="Ваша ставка, $"><div class="calc-out" id="calcOut"></div></div></div>' : '')
    + (info ? '<div class="d-card">' + info + '</div>' : '')
    + '<div class="d-card"><h3><label for="note">Заметка после осмотра' + (n && n.date && n.date !== S.date ? ' (от ' + fmtDate(n.date) + ', лот ' + E(n.run) + ')' : '') + '</label></h3><textarea class="note' + (n ? ' has' : '') + '" id="note" data-k="' + E(k) + '" placeholder="Что увидели: кузов, мотор, салон, запах, ошибки">' + E(n ? n.text : '') + '</textarea><p class="muted" id="nstat" style="font-size:12.5px;margin-top:4px">Хранится на этом телефоне и привязана к VIN.</p></div>'
    + '<div class="d-card"><p class="vin">VIN ' + E(x.vin || 'нет') + '</p><div class="btns">'
    + '<button class="btn" data-fav="' + E(k) + '">' + (isFav(x) ? '★ В избранном' : '☆ В избранное') + '</button>'
    + (x.vin ? '<button class="btn" data-act="copy" data-v="' + E(x.vin) + '">Скопировать VIN</button>' : '')
    + (link ? '<a class="btn pri" href="' + E(link) + '" target="_blank" rel="noopener">Открыть лот</a>' : '')
    + '<button class="btn" data-act="share-lot" data-k="' + E(k) + '">Поделиться</button>'
    + '</div></div>';
  openSheet('Лот ' + E(x.run), html, true);
  calc(x);
}
function calc(x) {
  const i = $('#bid'), o = $('#calcOut'); if (!i || !o) return;
  const b = +i.value || 0, tot = b + FEE, pr = x.sale - tot;
  o.innerHTML = 'С учётом сбора: <b>' + M(tot) + '</b><br>Прибыль: <b class="' + (pr >= (x.margin || 1000) ? 'pos' : pr > 0 ? 'mid' : 'neg') + '">' + M(pr) + '</b>' + (x.w ? ' · ' + Math.round(100 * b / x.w) + '% от MMR' : '');
}
function saveNote(ta) {
  const x = S.d.map[ta.dataset.k]; if (!x || !x.vin) return;
  const text = ta.value.trim(), prev = S.notes[x.vin];
  if ((prev ? prev.text : '') === text) return;
  if (text) S.notes[x.vin] = { text, date: S.date, run: x.run, car: carName(x), updatedAt: new Date().toISOString() };
  else delete S.notes[x.vin];
  LS.set('auction-notes-v1', S.notes);
  const st = $('#nstat'); if (st) st.textContent = 'Сохранено';
  ta.classList.toggle('has', !!text);
}
function notesSheet() {
  const list = Object.entries(S.notes).filter(([, n]) => n && n.text).sort((a, b) => String(b[1].updatedAt || '').localeCompare(String(a[1].updatedAt || '')));
  openSheet('Мои заметки', list.length ? '<div class="rows">' + list.map(([v, n]) => '<div class="r"><div class="l"><b>' + E(n.car || '') + '</b><br><small>' + fmtDate(n.date) + ' · лот ' + E(n.run) + ' · <span class="vin">' + E(v) + '</span></small><p style="margin-top:4px">' + E(n.text) + '</p></div></div>').join('') + '</div><div class="btns"><button class="btn pri" data-act="share-notes">Отправить все заметки</button><button class="btn" data-act="copy-notes">Скопировать</button></div><p class="muted" style="font-size:13px;margin-top:10px">Отправьте заметки в чат с Claude, и он учтёт их в следующем анализе.</p>' : '<p class="empty">Заметок пока нет. Откройте машину и напишите, что увидели на осмотре.</p>', true);
}
function notesText() { return Object.entries(S.notes).filter(([, n]) => n && n.text).map(([v, n]) => fmtDate(n.date) + ' ' + (n.run || '') + ' ' + (n.car || '') + ' VIN ' + v + ': ' + n.text).join('\n'); }
function howSheet() { openSheet('Как считается', '<div class="txt">' + (S.d.how || '<p>Описание расчёта появится с данными.</p>') + '</div>', true); }

/* ---------- установка ---------- */
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
function installSheet() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let h = '';
  if (isStandalone()) h = '<p class="txt">Приложение уже установлено. Обновления приходят сами, когда вы открываете его с интернетом.</p>';
  else if (S.deferredInstall) h = '<p class="txt">Нажмите кнопку, и иконка «Аукционы» появится на экране телефона.</p><div class="btns" style="grid-template-columns:1fr"><button class="btn pri" data-act="do-install">Установить приложение</button></div>';
  h += '<h2>iPhone</h2><ol class="steps"><li>Откройте эту ссылку в <b>Safari</b>.</li><li>Нажмите «Поделиться» <span aria-hidden="true">(квадрат со стрелкой ↑)</span> внизу экрана.</li><li>Выберите «На экран “Домой”» и нажмите «Добавить».</li></ol>'
    + '<h2>Android</h2><ol class="steps"><li>Откройте ссылку в <b>Chrome</b>.</li><li>Нажмите ⋮ в правом верхнем углу.</li><li>Выберите «Установить приложение» или «Добавить на главный экран».</li></ol>'
    + '<p class="txt muted" style="margin-top:12px">После установки приложение открывается без браузера, помнит избранное и заметки и работает на аукционе даже без связи. Новые лоты приходят сами.</p>';
  if (ios && !isStandalone()) h = '<p class="banner" style="display:block">Вы на iPhone: шаги ниже.</p>' + h;
  openSheet('Установить на телефон', h, true);
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.deferredInstall = e; });
window.addEventListener('appinstalled', () => { S.deferredInstall = null; toast('Приложение установлено'); });

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
  try { await navigator.clipboard.writeText(text); toast('Скопировано'); }
  catch (e) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('Скопировано'); } catch (x) {} t.remove(); }
}
function applyTheme() { const t = LS.get('theme', ''); if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); }
function cycleTheme() { const t = LS.get('theme', ''); LS.set('theme', t === '' ? 'dark' : t === 'dark' ? 'light' : ''); applyTheme(); toast({ dark: 'Тёмная тема', light: 'Светлая тема', '': 'Тема как в системе' }[LS.get('theme', '')]); if (S.tab === 'more') render(); }
function go(tab) { S.tab = tab; LS.set('tab', tab); render(); window.scrollTo(0, 0); }
function toggleFav(k) {
  const x = S.d.map[k]; if (!x) return;
  const fk = favKey(x); if (S.favs[fk]) delete S.favs[fk]; else S.favs[fk] = 1;
  LS.set('fav-v1', S.favs);
  document.querySelectorAll('[data-fav="' + CSS.escape(k) + '"]').forEach(b => { const on = !!S.favs[fk]; if (b.classList.contains('star')) { b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', on); } else b.textContent = on ? '★ В избранном' : '☆ В избранное'; });
  if (S.tab === 'picks' && S.picks === 'fav' && !sheetOpen) render();
}

document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-lot],a'); if (!t) return;
  if (e.target === $('#sheetBg')) return;
  const ds = t.dataset;
  if (ds.fav) { e.stopPropagation(); toggleFav(ds.fav); return; }
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
    case 'more': S.shown += 60; drawLots(true); break;
    case 'rmore': S.rshown += 80; drawResults(true); break;
    case 'fapply': {
      const v = id => { const el = $('#' + id); return el ? el.value : ''; };
      Object.assign(S.f, { mk: v('f_mk'), au: v('f_au'), cl: v('f_cl'), st: v('f_st'), y: v('f_y'), o: v('f_o'), p: v('f_p') });
      closeSheet(); if (S.tab !== 'lots') go('lots'); else render(); break;
    }
    case 'freset': Object.assign(S.f, { mk: '', au: '', cl: '', st: '', y: '', o: '', p: '' }); closeSheet(); render(); break;
    case 'notes': notesSheet(); break;
    case 'how': howSheet(); break;
    case 'install': installSheet(); break;
    case 'do-install': if (S.deferredInstall) { S.deferredInstall.prompt(); const r = await S.deferredInstall.userChoice; if (r.outcome === 'accepted') closeSheet(); S.deferredInstall = null; } break;
    case 'hide-install': LS.set('hide-install', true); render(); break;
    case 'share-app': share('Аукционы Хьюстона: лоты, MMR, прибыль и тайтл. Откройте и установите на телефон: ' + location.href.split('#')[0], 'Аукционы Хьюстона'); break;
    case 'share-lot': { const x = S.d.map[ds.k]; share(S.d.label + ', ' + (AUC[x.auc] || x.auc) + ', лот ' + x.run + ': ' + carName(x) + (x.o ? ', ' + N(x.o) + ' mi' : '') + '. MMR ' + M(x.w) + ', макс. ставка ' + M(x.max) + ', прибыль ' + M(x.prof) + (x.ttl ? '. ' + x.ttl : '') + '. VIN ' + (x.vin || '') + (lotUrl(x) ? '\n' + lotUrl(x) : ''), carName(x)); break; }
    case 'share-notes': share('Мои заметки с осмотра:\n' + notesText(), 'Заметки'); break;
    case 'copy-notes': copy(notesText()); break;
    case 'copy': copy(ds.v); break;
    case 'refresh': await refresh(true); break;
    case 'theme': cycleTheme(); break;
  }
});
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.lot[data-lot]')) { e.preventDefault(); detail(e.target.dataset.lot); } if (e.key === 'Escape' && sheetOpen) closeSheet(); });
$('#sheetBg').addEventListener('click', () => closeSheet());
let qT;
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'q') { clearTimeout(qT); qT = setTimeout(() => { S.f.q = e.target.value; drawLots(); }, 150); }
  else if (id === 'rq') { clearTimeout(qT); qT = setTimeout(() => { S.rf.q = e.target.value; drawResults(); }, 150); }
  else if (id === 'bid') { const x = S.d.map[$('#note').dataset.k]; calc(x); }
  else if (id === 'note') { const st = $('#nstat'); if (st) st.textContent = 'Сохранится, когда закончите'; clearTimeout(qT); qT = setTimeout(() => saveNote(e.target), 800); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'sort') { S.f.sort = e.target.value; drawLots(); }
  else if (e.target.id === 'rsort') { S.rf.sort = e.target.value; drawResults(); }
  else if (e.target.id === 'note') saveNote(e.target);
});

async function refresh(manual) {
  try {
    const old = S.index && S.index.version;
    await loadIndex(true);
    if (S.index.version !== old) {
      const keep = S.index.dates.some(d => d.id === S.date) ? S.date : S.index.dates[0].id;
      await loadDate(keep); if (!sheetOpen) render();
    } else if (manual) toast('У вас последняя версия');
    if (navigator.serviceWorker && navigator.serviceWorker.controller) { const r = await navigator.serviceWorker.getRegistration(); if (r) r.update(); }
  } catch (e) { if (manual) toast('Нет связи, показываю сохранённые данные'); }
}

async function start() {
  applyTheme();
  try {
    await loadIndex(false);
    const h = (location.hash || '').replace('#d-', '');
    const want = S.index.dates.some(d => d.id === h) ? h : LS.get('cur-date', null);
    const first = S.index.dates.some(d => d.id === want) && want !== null ? want : S.index.dates[0].id;
    // новая дата аукциона в данных: открываем её
    const newest = S.index.dates[0].id, seenNewest = LS.get('seen-newest', null);
    await loadDate(seenNewest && seenNewest !== newest ? newest : first);
    LS.set('seen-newest', newest);
    const tb = LS.get('tab', 'home'); S.tab = ['home', 'picks', 'lots', 'results', 'more'].includes(tb) ? tb : 'home';
    render();
  } catch (e) {
    $('#view').innerHTML = '<p class="empty">Не удалось загрузить данные. Проверьте интернет и откройте приложение ещё раз.</p>';
  }
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Вышла новая версия приложения', 'Обновить', () => { nw.postMessage('skip'); });
        });
      });
      let reloaded = false; const hadCtrl = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtrl && !reloaded) { reloaded = true; location.reload(); } });
    } catch (e) {}
  }
  refresh(false);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(false); });
}
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
    res.innerHTML = '<b>' + E(uniq[0]) + '</b><br>Эта машина есть на нескольких торгах:' + hits.map((h, i) => '<button class="btn" style="width:100%" data-hit="' + i + '">' + E(fmtDate(h.d)) + ' · лот ' + E(h.k.split('|')[1]) + ' · ' + E(AUC[h.k.split('|')[0]] || '') + '</button>').join('');
    res.onclick = e => { const b = e.target.closest('[data-hit]'); if (b) openHit(hits[+b.dataset.hit]); };
    return;
  }
  if (uniq.length > 1) {
    res.hidden = false;
    res.innerHTML = 'Подходят ' + uniq.length + ' машин, выберите:' + hits.slice(0, 8).map((h, i) => '<button class="btn" style="width:100%" data-hit="' + i + '">…' + E(h.vin.slice(-8)) + ' · ' + E(fmtDate(h.d)) + ' · лот ' + E(h.k.split('|')[1]) + '</button>').join('');
    res.onclick = e => { const b = e.target.closest('[data-hit]'); if (b) openHit(hits[+b.dataset.hit]); };
    return;
  }
  if (fromCamera && v.length !== 17) return;
  res.hidden = false;
  res.innerHTML = '<b class="vin">' + E(v) + '</b><br>' + (v.length === 17 ? 'Этой машины нет в каталогах приложения.' : 'Ничего не нашлось. Введите VIN целиком или последние 6–8 символов.') + (v.length === 17 ? '<br><button class="btn" data-act="copy" data-v="' + E(v) + '">Скопировать VIN</button>' : '');
}
async function decoderFor() {
  if ('BarcodeDetector' in window) {
    try {
      const f = await BarcodeDetector.getSupportedFormats();
      const want = ['code_39', 'code_128', 'data_matrix', 'qr_code', 'pdf417'].filter(x => f.includes(x));
      if (want.includes('code_39')) { const bd = new BarcodeDetector({ formats: want }); return async c => { const r = await bd.detect(c); return r.length ? r[0].rawValue : null; }; }
    } catch (e) {}
  }
  if (!window.ZXing) await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'vendor/zxing.min.js'; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
  const Z = window.ZXing, hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.DATA_MATRIX, Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.PDF_417]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const rd = new Z.MultiFormatReader(); rd.setHints(hints);
  return async c => { try { return rd.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(c)))).getText(); } catch (e) { return null; } finally { rd.reset(); } };
}
async function openScan() {
  const el = document.createElement('div'); el.className = 'scan'; el.id = 'scan';
  el.innerHTML = '<div class="bar"><button data-act="scan-close">Закрыть</button><button data-act="torch" id="torch" hidden>Фонарик</button></div><video playsinline muted autoplay></video><div class="frame"></div>'
    + '<p class="hint" id="scanHint">Наведите на штрихкод VIN: стойка водительской двери, лобовое стекло или наклейка в документах.</p><div class="res" id="scanRes" hidden></div>'
    + '<form id="scanForm"><input id="vinIn" placeholder="VIN или последние 6 символов" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="search" aria-label="VIN"><button>Найти</button></form>';
  document.body.appendChild(el); document.body.style.overflow = 'hidden';
  try { history.pushState({ scan: 1 }, ''); } catch (e) {}
  vinIndex().catch(() => {});
  el.querySelector('#scanForm').onsubmit = e => { e.preventDefault(); handleVin($('#vinIn').value, false); };
  const video = el.querySelector('video');
  let stream, alive = true, timer;
  scanStop = () => { alive = false; clearTimeout(timer); if (stream) stream.getTracks().forEach(t => t.stop()); };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('#scanHint').textContent = 'Камера недоступна в этом браузере. Введите VIN вручную.'; return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  } catch (e) { $('#scanHint').textContent = 'Нет доступа к камере. Разрешите камеру в настройках браузера или введите VIN вручную.'; return; }
  if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
  video.srcObject = stream; try { await video.play(); } catch (e) {}
  const track = stream.getVideoTracks()[0];
  try { const cap = track.getCapabilities && track.getCapabilities(); if (cap && cap.torch) { const tb = $('#torch'); tb.hidden = false; let on = false; tb.onclick = () => { on = !on; track.applyConstraints({ advanced: [{ torch: on }] }); }; } if (cap && cap.focusMode && cap.focusMode.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}
  const decode = await decoderFor().catch(() => null);
  if (!decode) { $('#scanHint').textContent = 'Сканер не загрузился. Введите VIN вручную.'; return; }
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  let n = 0, last = '';
  const tick = async () => {
    if (!alive) return;
    if (video.videoWidth) {
      const vw = video.videoWidth, vh = video.videoHeight, rot = n++ % 3 === 2;
      // берём полосу по центру кадра (там рамка), каждый третий кадр поворачиваем на 90° для вертикальных штрихкодов
      const sw = rot ? Math.round(vw * .5) : vw, sh = rot ? vh : Math.round(vh * .45);
      const sx = Math.round((vw - sw) / 2), sy = Math.round((vh - sh) / 2);
      const sc = Math.min(1, 1400 / Math.max(sw, sh));
      if (rot) { cv.width = Math.round(sh * sc); cv.height = Math.round(sw * sc); cx.save(); cx.translate(cv.width, 0); cx.rotate(Math.PI / 2); cx.drawImage(video, sx, sy, sw, sh, 0, 0, sw * sc, sh * sc); cx.restore(); }
      else { cv.width = Math.round(sw * sc); cv.height = Math.round(sh * sc); cx.drawImage(video, sx, sy, sw, sh, 0, 0, cv.width, cv.height); }
      const txt = await decode(cv);
      if (txt && alive) { const v = cleanVin(txt); if (VIN_RE.test(v) && v !== last) { last = v; $('#vinIn').value = v; await handleVin(v, true); } }
    }
    if (alive) timer = setTimeout(tick, 120);
  };
  tick();
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
