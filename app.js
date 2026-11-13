'use strict';
/* Аукционы Хьюстона — мобильное приложение (PWA). © 2026 Maxat Tulegenov. All rights reserved. Данные: data/index.json и data/<дата>.json */
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
const MAXB = /^(Toyota|Honda|Hyundai|BMW|Volkswagen|Kia|Mercedes|Audi)/i;
const COLOR = { BLACK: T('чёрный'), WHITE: T('белый'), GRAY: T('серый'), GREY: T('серый'), SILVER: T('серебристый'), RED: T('красный'), BLUE: T('синий'), BROWN: T('коричневый'), TAN: T('бежевый'), BEIGE: T('бежевый'), GOLD: T('золотистый'), GREEN: T('зелёный'), PURPLE: T('фиолетовый'), BURGUNDY: T('бордовый'), MAROON: T('бордовый'), ORANGE: T('оранжевый'), YELLOW: T('жёлтый'), TEAL: T('бирюзовый') };
const CLS = { salvage: ['bad', T('Salvage, rebuilt или без тайтла')], noinop: ['bad', T('Не на ходу или нет ключа')], hist: ['warn', T('Пометка на чистом тайтле')], clean: ['good', T('Без пометок')] };
const STAT = { 'Основная': 's-main', 'Флип': 's-flip', 'Дорого': 's-exp' };
const SS = { sold: T('Продана'), offer: T('На оффере'), none: T('Не продана'), gone: T('Снята'), rerun: T('Снова на торгах') };
const HOT_R0 = /двигател|коробк|раздатк|дифференциал|не на ходу|engine|transmission|motor|trans\b|drivetrain/i, HOT_OK = /зелёный свет|гаранти|guarant|gty|green light|engine runs|eng starts|вернуть при проблеме/i;
const ANN_MARK = /rental|fleet|repo\b|lemon|theft|canadian/i;
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
  favs: loadFavs(), favDel: LS.get('fav-del-v1', {}), notes: LS.get('auction-notes-v1', {}), obd: LS.get('auction-obd-v1', {}),
  f: { q: '', mk: [], md: [], au: '', cl: '', st: '', y: '', o: '', p: '', quick: '' , sort: 'stat' },
  rf: { q: '', st: '', sort: 'run' },
  favSort: LS.get('fav-sort', 'run'), flSort: LS.get('flist-sort', 'manual'),
  shown: 24, deferredInstall: null
};

/* ---------- избранное ----------
   Хранится на телефоне, общее для всех дат: ключ — VIN (если есть), иначе «дата|площадка|лот».
   Старый формат fav-v1 (ключ «дата|лот») переносится один раз. */
function loadFavs() {
  let f = LS.get('fav-v2', null);
  if (!f) { f = {}; const old = LS.get('fav-v1', {}); Object.keys(old).forEach(k => { const i = k.indexOf('|'); f[k] = { d: k.slice(0, i), k: k.slice(i + 1), ts: Date.now() }; }); LS.set('fav-v2', f); }
  return f;
}
function saveFavs(local) { LS.set('fav-v2', S.favs); LS.set('fav-del-v1', S.favDel); if (!local && window.Sync && Sync.pushFavs) Sync.pushFavs(); try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {} }

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
async function getDate(id) {
  if (!S.cache[id]) {
    const d = await getJSON('data/' + id + '.json?v=' + S.index.version);
    d.map = {}; d.lots.forEach(x => { x.k = x.auc + '|' + x.run; x._d = id; d.map[x.k] = x; });
    applyFees(d); S.cache[id] = d;
  }
  return S.cache[id];
}
async function loadDate(id) {
  await getDate(id);
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
/* заголовок: год, марка, модель · объём и название мотора · комплектация */
const GM = /^(Chevrolet|GMC|Cadillac|Buick)$/i, FCA = /^(Ram|Dodge|Jeep|Chrysler|Fiat)$/i, TOY = /^(Toyota|Lexus|Scion)$/i, HON = /^(Honda|Acura)$/i, NIS = /^(Nissan|INFINITI)$/i, HK = /^(Hyundai|Kia|Genesis)$/i, VAG = /^(Volkswagen|Audi)$/i, FRD = /^(Ford|Lincoln|Mercury)$/i;
function engParse(x) {
  const m = String(x.tr || '').match(/(\d+\.\d)\s+(\d+)cyl\.?\s*([A-Za-z]+)?/);
  if (m) return { v: m[1], c: +m[2], f: m[3] || '' };
  const e = String(x.eng || '').match(/(\d+\.\d)/);
  return e ? { v: e[1], c: 0, f: '' } : null;
}
function engName(x, v, c, f) {
  const mk = x.mk || '', md = String(x.md || ''), y = +x.y || 0, tr = String(x.tr || '') + ' ' + (x.st || '');
  if (/diesel/i.test(f)) {
    if (FRD.test(mk)) return 'Power Stroke';
    if (GM.test(mk)) return 'Duramax';
    if (/^(Ram|Dodge)$/i.test(mk) && (v === '6.7' || v === '5.9')) return 'Cummins';
    if (NIS.test(mk) && v === '5.0') return 'Cummins';
    if (FCA.test(mk) && v === '3.0') return 'EcoDiesel';
    if (VAG.test(mk)) return 'TDI';
    return '';
  }
  if (FRD.test(mk)) {
    if (/EcoBoost/i.test(tr)) return 'EcoBoost';
    if (['1.0', '1.5', '1.6', '2.3', '2.7'].includes(v) && y >= 2013) return 'EcoBoost';
    if (v === '2.0') return /Focus|Fiesta/i.test(md) && !/ST\b/.test(tr) ? '' : y >= 2013 ? 'EcoBoost' : '';
    if (v === '3.5') return /F-?150|Expedition|Navigator|Transit/i.test(md) && y >= 2011 ? 'EcoBoost' : '';
    if (v === '5.0' && y >= 2011) return 'Coyote';
    if (v === '5.4' || v === '6.8') return 'Triton';
    if (v === '6.2' && c === 8) return 'Boss';
    if (v === '7.3' && y >= 2020) return 'Godzilla';
    if (v === '3.7' || (v === '3.3' && y >= 2018)) return 'Cyclone';
    return '';
  }
  if (GM.test(mk)) {
    if (v === '6.2' && /Corvette|Camaro/i.test(md)) return '';
    if (['5.3', '6.2', '4.3'].includes(v) && c >= 6) return y >= 2014 ? 'EcoTec3' : 'Vortec';
    if (['1.2', '1.3', '1.4', '1.5'].includes(v) && y >= 2011 && !/Spark/i.test(md)) return T('турбо');
    if (v === '4.8' || v === '6.0') return 'Vortec';
    if (v === '2.7' && c === 4) return 'TurboMax';
    if (v === '2.4' && c === 4) return 'Ecotec';
    return '';
  }
  if (FCA.test(mk)) {
    if (v === '5.7' || v === '6.4') return 'HEMI';
    if (v === '6.2' && c === 8) return 'HEMI Hellcat';
    if (v === '3.6') return 'Pentastar';
    if (v === '2.4' && y >= 2013) return 'Tigershark';
    if (v === '4.7' || v === '3.7') return 'PowerTech';
    return '';
  }
  if (TOY.test(mk)) {
    return ({ '1.8': '2ZR', '2.4': '2AZ', '2.7': '2TR', '3.5': '2GR', '4.0': '1GR', '3.3': '3MZ', '4.7': '2UZ', '4.6': '1UR', '5.7': '3UR' })[v]
      || (v === '2.5' && c === 4 ? (y >= 2019 ? 'A25A' : '2AR') : '')
      || (v === '2.0' && c === 4 ? (y >= 2019 ? 'M20A' : '3ZR') : '')
      || (v === '3.4' ? (y >= 2022 ? 'V35A турбо' : '5VZ') : '');
  }
  if (HON.test(mk)) {
    if (v === '1.5') return y >= 2016 ? 'L15B турбо' : 'L15';
    if (v === '2.3' && /RDX/i.test(md)) return 'K23 ' + T('турбо');
    return ({ '2.0': 'K20', '2.4': 'K24', '3.5': 'J35', '1.8': 'R18', '3.2': 'J32' })[v] || '';
  }
  if (NIS.test(mk)) {
    if (v === '2.5' && c === 4) return /Altima/i.test(md) && y >= 2019 ? 'PR25' : 'QR25';
    if (v === '1.5' && c === 3) return 'VC-Turbo';
    if (v === '3.0' && c === 6) return 'VR30 турбо';
    return ({ '1.8': 'MRA8', '1.6': 'HR16', '2.0': 'MR20', '3.5': 'VQ35', '3.7': 'VQ37', '4.0': 'VQ40', '3.8': 'VQ38', '5.6': 'VK56' })[v] || '';
  }
  if (HK.test(mk)) {
    if (v === '2.4') return 'Theta II';
    if (v === '2.5' && y >= 2020) return 'Smartstream';
    if (v === '1.6' && y >= 2020 && /K5|Sonata|Seltos|Kona/i.test(md)) return T('турбо');
    return ({ '1.6': 'Gamma', '1.8': 'Nu', '3.3': 'Lambda', '3.5': 'Lambda', '3.8': 'Lambda', '5.0': 'Tau' })[v] || '';
  }
  if (/^BMW$/i.test(mk)) {
    if (v === '3.0' && c === 6) return y >= 2011 ? 'турбо' : '';
    if (v === '2.0') return 'турбо';
    if (v === '4.4') return 'битурбо';
    return '';
  }
  if (VAG.test(mk)) {
    if (v === '2.0' && /Jetta|Beetle|Golf/i.test(md) && y <= 2014 && !/GLI|GTI|TSI|Turbo/i.test(tr)) return '';
    if (['1.4', '1.5', '1.8', '2.0'].includes(v) && y >= 2009) return /Audi/i.test(mk) ? 'TFSI' : 'TSI';
    if (v === '3.6') return 'VR6';
    return '';
  }
  if (/^Mercedes/i.test(mk)) { if (v === '2.0') return 'турбо'; if ((v === '4.6' || v === '4.7') && y >= 2011) return 'битурбо'; return ''; }
  if (/^Volvo$/i.test(mk) && v === '2.0') return T('турбо');
  if (/^Subaru$/i.test(mk)) return v === '2.4' ? 'Boxer турбо' : 'Boxer';
  if (/^Mazda$/i.test(mk) && (v === '2.0' || v === '2.5') && y >= 2014) return 'Skyactiv';
  return '';
}
function engineTag(x) {
  if (/^Tesla$/i.test(x.mk || '')) return T('электро');
  const p = engParse(x); if (!p || p.v === '0.0') return '';
  const inl = /^(BMW|INEOS)$/i.test(x.mk || '') || (/^Volvo$/i.test(x.mk || '') && p.c === 6);
  const lay = p.c >= 6 ? (inl && p.c === 6 ? 'I6' : 'V' + p.c) : '';
  let nm = engName(x, p.v, p.c, p.f);
  if (/\b\d\.\dT\b|Turbo/i.test(String(x.tr || '') + ' ' + (x.st || '')) && !/турбо|Turbo|EcoBoost|TSI|TFSI|TurboMax/i.test(nm)) nm = (nm ? nm + ' ' : '') + T('турбо');
  return [p.v, lay, nm, /diesel/i.test(p.f) ? T('дизель') : ''].filter(Boolean).join(' ');
}
function carTitle(x) {
  const eng = engineTag(x);
  // из комплектации убираем то, что уже сказано про мотор и кузов
  const trim = String(x.st || '').replace(/\b\d\.\d(L|T)?\b|\b[VI]\d\b|\b\d-cyl\b|\b\d-Spd\b|\b(AT|MT|CVT)\b|\(Natl\)|\b[24]dr\b|\bSdn\b|\bSedan\b/gi, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  return [[x.y, x.mk, x.md].filter(Boolean).join(' '), eng, trim].filter(Boolean).join('\u00a0· ');
}
function fmtDate(id) { const p = String(id || '').split('-'); return p.length === 3 ? p[2] + '.' + p[1] : ''; }
function lotUrl(x) { return x.u ? x.u : x.s ? 'https://www.edgepipeline.com/components/vehicle/detail/' + x.s : ''; }
function favKey(x) { return (x._d || S.date) + '|' + x.k; }
function isFav(x) { return !!((x.vin && S.favs[x.vin]) || S.favs[favKey(x)]); }
function noteOf(x) { const n = x.vin && S.notes[x.vin]; return n && n.text ? n : null; }
// что важно для торгов из текста заметки: «больше не смотреть», своя цена («бить до 3.8», «до 5-6», «ммр 3к»), WS (wholesale)
function noteFlags(n) {
  if (!n || !n.text) return null;
  const s = n.text, k = v => { v = parseFloat(String(v).replace(',', '.')); return v < 100 ? Math.round(v * 1000) : Math.round(v); };
  const o = {};
  if (/не\s*(с[мио]+тр|брать)|мусорк|больше\s+не/i.test(s)) o.stop = true;
  let m = s.match(/(?:бить|бьем|бьём|дать|брать|давать)[^\d.]{0,20}?(?:до|макс)?\s*(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(?:к|k|тыщ|тыс)?/i)
    || s.match(/(?:^|[^а-яё])до\s*(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(?:к|k|тыщ|тыс)?/i)
    || s.match(/ммр\s*(\d+(?:[.,]\d+)?)\s*(?:к|k)/i);
  if (m) { const v = k(m[2] || m[1]); if (v >= 300 && v <= 200000) o.bid = v; }
  if (/дешев|дёшево|не\s*дорого/i.test(s) && !o.bid) o.cheap = true;
  m = s.match(/(?:\bWS|wholesale)\s*\$?\s*(\d{3,6})/i); if (m) o.ws = +m[1];
  if (/нет\s+(на\s+месте|в\s+линии)/i.test(s)) o.away = true;
  return Object.keys(o).length ? o : null;
}
function noteWho(n) { if (!n || !n.by) return ''; const t = n.updatedAt ? new Date(n.updatedAt) : null; const when = t && !isNaN(t) ? t.toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; return (n.cby && n.cby !== n.by ? T('Написал ') + n.cby + ', ' + T('изменил ') : T('Написал ')) + n.by + (when ? ', ' + when : ''); }
function noteStatus(n) { const Y = window.Sync && Sync.st; if (n && n.by) return noteWho(n); if (Y && Y.user) return T('Общая заметка: увидят все, кто вошёл.'); if (Y && Y.on) return T('Сейчас только на этом устройстве. Войдите через Google во вкладке «Ещё», чтобы заметку видели все.'); return T('Хранится на этом телефоне и привязана к VIN.'); }
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
  if (x.ss) return '<p class="fact">' + E(SS[x.ss] || x.ss) + (x.ss === 'offer' && x.bnf ? ': ' + M(x.bnf) + (x.w ? ', ' + Math.round(100 * x.bnf / x.w) + T('% от MMR') : '') : '') + (x.ss === 'rerun' && x.rr ? T(', лот ') + E(x.rr) : '') + '</p>';
  return '';
}

/* ---------- неходячие: линии, где аукцион продаёт машины не на ходу ---------- */
// AAA - Central Houston: линия 7, AAA - Houston и AutoNation (пятница): линия T (правила Максата). Другие аукционы добавить сюда, когда станут известны их линии.
const INOP_LANES = { AAA: ['7'], AAH: ['T'], ANA: ['T'] };
function lane(x) { return String(x.run || '').split('-')[0].trim(); }
function inopLane(x) { return (INOP_LANES[x.auc] || []).includes(lane(x)); }
function isInop(x) { return x.cls === 'noinop' || inopLane(x); }
/* ---------- подбор для Максата: машина жене на 3–4 месяца, потом продать в ноль ----------
   Ставка в ноль = цена продажи через 3–4 мес. (наша цена продажи −4% за время и пробег) − сбор − запас на обслуживание.
   Надёжность по марке/мотору, возраст, пробег, свет, история, заметки и OBD дают комментарий и порядок в списке. */
const WIFE_RISK = [
  [/Hyundai|Kia/, /(Sonata|Optima|Santa Fe|Sorento|Sportage|Tucson|Forte|Elantra|Soul)/, y => y >= 2011 && y <= 2019, 'мотор Theta II/Nu GDI этих лет: известны задиры и отзывные клины. Проверить, делали ли отзыв (продлённая гарантия)', 2],
  [/Hyundai|Kia/, /./, y => true, 'надёжные в целом, ремонт недорогой', 0],
  [/Toyota/, /./, y => true, 'самая надёжная марка для такой задачи', -1],
  [/Honda/, /(Odyssey|Pilot|Accord|Ridgeline)/, y => y >= 2008 && y <= 2017, 'V6 с отключением цилиндров (VCM): бывает расход масла; в остальном надёжная', 0],
  [/Honda/, /(CR-V|Civic|HR-V|Fit)/, y => y >= 2014 && y <= 2020, 'вариатор CVT: менять жидкость; 1.5 турбо CR-V 2017–2019 — масло с бензином', 0],
  [/Honda/, /./, y => true, 'надёжная марка', -1],
  [/Volkswagen|Audi/, /./, y => y <= 2012, '2.0 турбо старых лет: цепь ГРМ и расход масла, ремонт $1500–3000', 2],
  [/Volkswagen|Audi/, /./, y => true, 'немец: DSG, цепь/помпа, электрика. Мелкие поломки вероятны, ремонт дороже японцев', 1],
  [/BMW/, /./, y => true, 'BMW: течи масла, охлаждение, цепь ГРМ на N20/N26. За 3–4 мес. вероятны вложения $500–1500', 2],
  [/Mercedes/, /./, y => true, 'Mercedes: дорогой сервис, электроника, пневмоподвеска на старших. Вероятны вложения', 2],
];
const WIFE_RES = { Toyota: 300, Honda: 300, Hyundai: 500, Kia: 500, Volkswagen: 700, Audi: 900, BMW: 1000, Mercedes: 1000 };
const _we = new Map();
function wifeEval(x) {
  if (_we.has(x)) return _we.get(x);
  const mk = String(x.mk || ''), md = String(x.md || ''), y = +x.y || 0, age = 2026 - y, o = +x.o || 0;
  const notes = []; let pen = 0;
  const r = WIFE_RISK.find(r => r[0].test(mk) && r[1].test(md) && r[2](y));
  if (r) { notes.push(r[3]); pen += r[4]; }
  if (o > 180000) { notes.push('пробег ' + N(o) + ' mi: много, износ подвески и мотора'); pen += 2; }
  else if (o > 140000) { notes.push('пробег ' + N(o) + ' mi: выше среднего'); pen += 1; }
  else if (o > 500 && o < 90000) { notes.push('небольшой пробег'); pen -= 1; }
  if (age >= 16) { notes.push(y + ' год: старая, резинки и пластик стареют'); pen += 1; }
  if (String(x.l || '').includes('Red')) { notes.push('красный свет: продаётся как есть, без гарантии хода и КПП'); pen += 3; }
  else if (x.l === 'Green') pen -= 1;
  if (x.g) { const g = parseFloat(x.g); if (g < 3) { notes.push('оценка ' + x.g + ': плохое состояние'); pen += 1; } }
  if (x.ttlbad || x.cls === 'salvage') { notes.push('проблемный тайтл: продать потом сложнее'); pen += 3; }
  if (x.ar || x.a) notes.push('пометка аукциона: ' + annText(x));
  if (/rental|прокат/i.test(x.a || '')) { notes.push('прокатная: пробег в основном городской, при перепродаже небольшой дисконт'); }
  if (x.hist) { notes.push('пометка в истории: дисконт при продаже'); pen += 1; }
  if (/рам|frame/i.test(x.cr || '')) { notes.push('по отчёту повреждение рамы'); pen += 3; }
  const nf = noteFlags(noteOf(x)); if (nf && nf.stop) { notes.push('по заметке: не смотреть'); pen += 3; }
  const ob = obdOf(x), ov = ob && window.OBD && OBD.verdict(ob.codes, x.mk); if (ov) { notes.push('OBD: ' + OBD.SEV[ov.s][1]); pen += ov.s === 3 ? 3 : ov.s === 2 ? 1 : 0; }
  const res = (WIFE_RES[Object.keys(WIFE_RES).find(k => mk.startsWith(k))] || 600) + (o > 140000 ? 400 : 0);
  let max = null, sale3 = null, ok = null;
  if (x.sale != null) {
    sale3 = Math.round(x.sale * .96 / 50) * 50;
    max = Math.max(0, Math.floor((sale3 - FEE - res) / 50) * 50);
    if (x.w) { ok = max >= x.w ? 'easy' : max >= .85 * x.w ? 'tight' : 'no'; if (ok === 'no') { notes.push('в ноль выйти можно только при ставке сильно ниже MMR, шанс купить низкий'); pen += 1; } else if (ok === 'easy') pen -= 1; }
    if (x.floor && x.floor > max) notes.push('floor price ' + M(x.floor) + ' выше ставки в ноль: дешевле, скорее всего, не отдадут');
  } else notes.push('нет оценки цены продажи');
  const lv = pen >= 4 ? 'bad' : pen >= 2 ? 'warn' : 'ok';
  const score = -pen * 10 + (ok === 'easy' ? 8 : ok === 'tight' ? 3 : 0) + (x.sale ? Math.min(5, (max - (x.w || 0)) / 500) : -20);
  const out = { lv, max, sale3, res, ok, notes, score, word: lv === 'ok' ? 'подходит' : lv === 'warn' ? 'с оговорками' : 'рискованно' };
  _we.set(x, out); return out;
}
function isMax() { return !!(window.Sync && Sync.isAdmin && Sync.isAdmin()); }
function wifeOn() { return S.tab === 'lots' && S.f.quick === 'seven' && isMax(); }
function wifeHtml(x, full) {
  const v = wifeEval(x);
  const head = '<b>' + T('Жене на 3–4 мес.: ') + v.word + '</b>' + (v.max != null ? '. ' + T('Бить до ') + M(v.max) + T(' (с ') + T('сбором ') + M(v.max + FEE) + ')' : '');
  if (!full) return '<div class="wife ' + v.lv + '">' + head + '<span>' + E(v.notes.join('; ')) + '</span></div>';
  return '<div class="d-card wife-d ' + v.lv + '"><h3>' + T('Подбор для Максата') + '</h3><p>' + head + '</p>'
    + (v.sale3 != null ? '<p class="muted">' + T('Продажа через 3–4 мес. ≈ ') + M(v.sale3) + ' − ' + T('сбор ') + M(FEE) + ' − ' + T('запас на обслуживание ') + M(v.res) + ' = ' + T('ставка в ноль ') + M(v.max) + (x.w ? '. MMR ' + M(x.w) : '') + '</p>' : '')
    + '<ul>' + v.notes.map(n => '<li>' + E(n) + '</li>').join('') + '</ul></div>';
}
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
  else if (ANN_MARK.test(x.a || '')) add('warn', E(annText(x).split(/;\s*/).filter(t => !/свет|гаранти|тайтл на месте/i.test(t)).join(', ')));
  if (x.auc === 'CMX' && x.mech) add('bad', T('Дефект двигателя/КПП'));
  if (x.l === 'Green') add('ok', T('Зелёный свет')); else if (String(x.l || '').includes('Red')) add('bad', T('Красный свет')); else if (x.l === 'Yellow') add('warn', T('Жёлтый свет'));
  if (x.g) { const g = parseFloat(x.g); add(g >= 4 ? 'ok' : g < 3 ? 'bad' : 'warn', T('Оценка ') + E(x.g)); }
  const nf = noteFlags(noteOf(x));
  if (nf) {
    if (nf.stop) add('bad', T('По заметке: не смотреть'));
    if (nf.away) add('warn', T('По заметке: не было на месте'));
    if (nf.bid) add('warn', T('По заметке: бить до ') + M(nf.bid));
    else if (nf.cheap) add('warn', T('По заметке: только дёшево'));
    if (nf.ws) add('ok', 'WS ' + M(nf.ws));
  }
  if (x.floor) add(x.max != null && x.floor > x.max ? 'warn' : '', T('Floor price ') + M(x.floor) + (x.max != null && x.floor > x.max ? T(', выше ставки') : '') + (x.cons ? ' · ' + E(x.cons) : ''));
  { const fr = flRes(x); if (fr) add(fr.c, E(fr.t)); }
  const ob = obdOf(x), ov = ob && window.OBD && OBD.verdict(ob.codes, x.mk);
  if (ov) add(OBD.SEV[ov.s][0], 'OBD: ' + ob.codes.length + ' ' + T(ob.codes.length === 1 ? 'ошибка' : ob.codes.length < 5 ? 'ошибки' : 'ошибок') + ', ' + T(OBD.SEV[ov.s][1]));
  else if (ob && ob.shots.length) add('warn', T('OBD: скриншот без кодов'));
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
function photo(x, cls, lazy) { const u = photoUrl(x); return u ? '<img class="' + cls + '" src="' + u + '" alt="" referrerpolicy="no-referrer" decoding="async"' + (lazy ? ' loading="lazy"' : '') + ' onerror="if(/\\/00$/.test(this.src)&&!this.dataset.f){this.dataset.f=1;this.src=this.src.replace(/00$/,\'01\')}else this.remove()">' : ''; }
/* сравнение floor price с ценой, за которую машину отдали сразу на аукционе (без оффера), по пост-сейлу */
function flRes(x) {
  if (!x.floor || x.ss !== 'sold' || !x.fact) return null;
  const d = x.fact - x.floor, lim = Math.max(500, Math.round(x.floor * .05));
  const c = d <= 0 ? 'ok' : d <= lim ? 'warn' : 'bad';
  const t = d < 0 ? T('Отдали сразу за ') + M(x.fact) + ', ' + M(-d).replace(/^/, '−') + T(' от floor') : d === 0 ? T('Отдали сразу за ') + M(x.fact) + T(', ровно floor') : T('Отдали сразу за ') + M(x.fact) + ', +' + M(d) + T(' к floor');
  return { c, t, d };
}
function flResTag(x) { const r = flRes(x); return r ? '<p class="fl-res ' + r.c + '">' + E(r.t) + '</p>' : ''; }
function lotCard(x) {
  const flOn = S.tab === 'lots' && S.f.quick === 'floor' && !!x.floor;
  const n = noteOf(x), v = VERDICT[x.stat], fav = isFav(x), fd = x._d && x._d !== S.date ? ' data-fd="' + E(x._d) + '"' : '';
  return '<article class="lot' + (x.past && x.past.length ? ' seen ' + seenLv(x) : '') + '" role="button" tabindex="0" data-lot="' + E(x.k) + '"' + fd + '>'
    + '<div class="lot-top"><span class="run">' + E(x.run) + '</span><span class="where">' + E(AUC[x.auc] || x.auc) + ' · ' + slot(x) + '</span>' + (v ? '<span class="verdict ' + v[0] + '">' + v[1] + '</span>' : '') + '</div>'
    + '<button class="star' + (fav ? ' on' : '') + '" data-fav="' + E(x.k) + '"' + fd + ' aria-label="' + T('В избранное') + '" aria-pressed="' + fav + '">' + (fav ? '★' : '☆') + '</button>'
    + '<div class="lot-id">' + photo(x, 'thumb', true) + '<div><h3>' + E(carTitle(x)) + '</h3>'
    + '<p class="sub">' + [x.o > 500 ? N(x.o) + ' mi' : '', COLOR[x.c] || String(x.c || '').toLowerCase()].filter(Boolean).map(E).join(' · ') + '</p>' + flResTag(x) + '</div></div>'
    + (isInop(x) ? '<div class="money inop"><div class="m-main"><span>MMR</span><b>' + M(x.w) + '</b></div><div class="m-note">' + T('Неходячая: прибыль не считаем') + '</div></div>' : '<div class="money ' + (flOn ? 'three' : 'two') + '"><div class="m-main"><span>' + (x.est ? T('MMR, оценка') : 'MMR') + '</span><b>' + (x.est && x.w != null ? '≈' : '') + M(x.w) + '</b></div>' + (flOn ? '<div class="m-main"><span>Floor price</span><b class="' + (x.max != null && x.floor > x.max ? 'fl-hi' : '') + '">' + M(x.floor) + '</b></div>' : '') + '<div class="m-main"><span>' + T('Ретейл') + '</span><b>' + (x.est && x.r != null ? '≈' : '') + M(x.r) + '</b></div></div>')
    + '<div class="status">' + statusLine(x) + '</div>'
    + (wifeOn() && !isInop(x) ? wifeHtml(x) : '')
    + pastCard(x)
    + hotLine(x)
    + factText(x)
    + (n ? '<p class="note-pv">' + E(n.text.slice(0, 120)) + '</p>' : '')
    + '</article>';
}

/* ---------- фильтры ---------- */
const QUICK = [['', T('Все')], ['fav', T('★ Избранное')], ['pick', T('Подборка')], ['seven', T('Подбор для Максата')], ['inop', T('Неходячие')], ['clean', T('Без пометок')], ['floor', T('С floor price')], ['past', T('Были на торгах')], ['notes', T('С заметкой')]];
const SORTS = [['stat', T('Сначала подборка')], ['prof', T('Прибыль больше')], ['w', T('MMR меньше')], ['wd', T('MMR больше')], ['diff', T('Ретейл − MMR больше')], ['time', T('Аукцион и время')], ['mk', T('Марка, модель, год')], ['ymm', T('Год, марка, модель')], ['run', T('Run номер')], ['o', T('Пробег меньше')], ['new', T('Недавно выставленные')], ['y', T('Год новее')]];
const STAT_ORDER = { 'Основная': 0, 'Флип': 1, 'Дорого': 2, 'Вне критериев': 3, 'Нет': 4 };
const nnv = (v, d) => v == null ? d : v;
const LOT_SORT = {
  stat: (u, v) => (nnv(STAT_ORDER[u.stat], 9) - nnv(STAT_ORDER[v.stat], 9)) || (nnv(v.prof, -1e9) - nnv(u.prof, -1e9)),
  prof: (u, v) => nnv(v.prof, -1e9) - nnv(u.prof, -1e9),
  w: (u, v) => nnv(u.w, 1e9) - nnv(v.w, 1e9),
  wd: (u, v) => nnv(v.w, -1e9) - nnv(u.w, -1e9),
  run: (u, v) => { const a1 = runKey(u.run), b1 = runKey(v.run); return String(u.auc).localeCompare(String(v.auc)) || a1[0].localeCompare(b1[0]) || a1[1] - b1[1] || a1[2] - b1[2]; },
  ymm: (u, v) => (v.y || 0) - (u.y || 0) || String(u.mk || '').localeCompare(String(v.mk || '')) || String(u.md || '').localeCompare(String(v.md || '')),
  time: (u, v) => slot(u).localeCompare(slot(v)) || LOT_SORT.run(u, v),
  new: (u, v) => phId(v) - phId(u) || LOT_SORT.run(u, v),
  mk: (u, v) => String(u.mk || '').localeCompare(String(v.mk || '')) || String(u.md || '').localeCompare(String(v.md || '')) || (v.y || 0) - (u.y || 0),
  y: (u, v) => (v.y || 0) - (u.y || 0),
  o: (u, v) => nnv(u.o, 1e9) - nnv(v.o, 1e9),
  diff: (u, v) => (v.w == null ? -1e9 : v.r - v.w) - (u.w == null ? -1e9 : u.r - u.w)
};
// свой порядок (перетаскивание в списке избранного): поле o у записи избранного, синхронизируется вместе с избранным
const favOrd = f => (f && f.o != null ? f.o : 1e9);
const FAV_SORTS = () => [['manual', T('Свой порядок')]].concat(SORTS.filter(([k]) => k !== 'stat' && k !== 'new'));
function sortFavRows(rows, key) {
  const run = LOT_SORT.run;
  return rows.sort(key === 'manual' ? (a, b) => favOrd(a[1]) - favOrd(b[1]) || run(a[2], b[2]) : (a, b) => (LOT_SORT[key] || run)(a[2], b[2]) || run(a[2], b[2]));
}
function favSortSel(id, cur) {
  return '<div class="count fav-sort"><span></span><select id="' + id + '" aria-label="' + T('Сортировка') + '">' + FAV_SORTS().map(([k, l]) => '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>';
}
function applyFilters(list) {
  const f = S.f, q = f.q.toLowerCase().trim(), y = +f.y || 0, o = +f.o || 0, p = +f.p || 0;
  const lotQ = q.replace(/\s/g, '').toUpperCase();
  let a = list.filter(x => {
    if (q) { const hay = (x.run + ' ' + carName(x) + ' ' + engineTag(x) + ' ' + (x.vin || '')).toLowerCase(); if (!hay.includes(q) && String(x.run).replace(/[\s-]/g, '').toUpperCase() !== lotQ.replace(/-/g, '')) return false; }
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
      case 'seven': return !isMax() || (MAXB.test(x.mk || '') && !isInop(x));
      case 'clean': return x.cls === 'clean' && !x.hist && !x.ttlbad && !ANN_MARK.test(x.a || '');
      case 'floor': return !!x.floor;
      case 'notes': return !!noteOf(x);
      case 'past': return !!(x.past && x.past.length);
      case 'inop': return isInop(x);
    }
    return true;
  });
  if (f.quick === 'seven' && (!f.sort || f.sort === 'stat')) a.sort((p, q) => wifeEval(q).score - wifeEval(p).score); else
  a.sort(LOT_SORT[f.sort] || LOT_SORT.stat);
  return a;
}
function activeFilterCount() { const f = S.f; return ['au', 'cl', 'st', 'y', 'o', 'p'].filter(k => f[k]).length + (f.mk.length ? 1 : 0) + (f.md.length ? 1 : 0); }

/* ---------- экраны ---------- */
const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  fav: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>',
  picks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/></svg>',
  lots: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/></svg>',
  results: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  flist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 5h16M4 10h16M4 15h10M4 20h7"/><path d="M17 15l1.5 3 3 .4-2.2 2 .6 3-2.9-1.5" stroke-width="1.6"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
};
function tabs() {
  const t = [['home', T('Главное')], ['fav', T('Избранное')], ['flist', T('Список')], ['lots', T('Все лоты')]];
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
  else if (S.tab === 'fav') { v.innerHTML = '<p class="empty">…</p>'; favScreen().then(h => { if (S.tab === 'fav') v.innerHTML = h; }); }
  else if (S.tab === 'flist') { v.innerHTML = '<p class="empty">…</p>'; favListScreen().then(h => { if (S.tab === 'flist') v.innerHTML = h; }); }
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
    + '<button class="tile" data-go="fav"><b>' + favN + '</b><span>' + T('в избранном') + (notesN ? T(', заметок ') + notesN : '') + '</span></button>'
    + '</div>'
    + (Object.keys(aucs).length > 1 ? '<h2>' + T('Площадки') + '</h2><div class="rows">' + Object.entries(aucs).map(([a, o]) => '<button class="r" data-go="lots" data-au="' + a + '"><div class="l"><b>' + E(AUC[a] || a) + '</b><br><small>' + T('старт около ') + o.t + '</small></div><div class="rt"><b>' + o.n + '</b><small>' + T('лотов') + '</small></div></button>').join('') + '</div>' : '')
    + (best.length ? '<h2>' + T('Лучшие по прибыли') + '</h2><div class="list" id="bestList">' + best.map(lotCard).join('') + '</div><button class="more" data-go="picks">' + T('Вся подборка') + '</button>' : '')
    + '<p class="foot">' + T('Данные обновлены ') + E(fmtUpdated(S.index.updated)) + T('. Комиссия ') + M(FEE) + T(' на машину.') + '</p>';
}
function bestLots() { const d = S.d; return d.core.concat(d.flip).map(k => d.map[k]).filter(Boolean).sort((a, b) => (b.prof || 0) - (a.prof || 0)).slice(0, 6); }
function picks() {
  const d = S.d;
  if (S.picks === 'fav') S.picks = 'core';
  const seg = [['core', '$5 000+', d.core.length], ['flip', T('Флип'), d.flip.length]];
  let list = (d[S.picks] || []).map(k => d.map[k]).filter(Boolean);
  const aucs = [...new Set(list.map(x => x.auc))];
  const pa = S.pickAuc && aucs.includes(S.pickAuc) ? S.pickAuc : '';
  if (pa) list = list.filter(x => x.auc === pa);
  return '<div class="seg" role="group">' + seg.map(([k, l, n]) => '<button data-pick="' + k + '" aria-pressed="' + (S.picks === k) + '">' + l + ' <span class="muted">' + n + '</span></button>').join('') + '</div>'
    + (aucs.length > 1 ? '<div class="qf">' + [''].concat(aucs).map(a => '<button data-pauc="' + a + '" aria-pressed="' + (pa === a) + '">' + (a ? E(AUC[a] || a) : T('Все площадки')) + '</button>').join('') + '</div>' : '')
    + (list.length ? '<div class="list">' + list.map(lotCard).join('') + '</div>'
      : '<p class="empty">' + (S.picks === 'fav' ? T('Пока пусто. Нажмите ☆ на карточке машины, чтобы собрать свой список на торги.') : T('В подборке на эту дату машин нет.')) + '</p>');
}
// избранное со всех дат: ближайшие торги сверху
async function favScreen() {
  const by = {};
  Object.entries(S.favs).forEach(([id, f]) => { if (f && f.d) (by[f.d] = by[f.d] || []).push(f); });
  const known = new Set(S.index.dates.map(d => d.id)), key = S.favSort;
  const ids = Object.keys(by).sort().reverse();
  let h = '', n = 0;
  for (const id of ids) {
    let lots = [];
    if (known.has(id)) { try { const d = await getDate(id); lots = sortFavRows(by[id].map(f => [null, f, d.map[f.k]]).filter(r => r[2]), key).map(r => r[2]); } catch (e) {} }
    const lost = by[id].filter(f => !lots.some(x => x.k === f.k));
    if (!lots.length && !lost.length) continue;
    n += lots.length + lost.length;
    const dd = S.index.dates.find(d => d.id === id);
    h += '<h2>' + E(dd ? dLabel(dd) : fmtDate(id)) + (dd ? ' <span class="muted">' + E(shortAuc(dd.title)) + '</span>' : '') + '</h2>'
      + (lots.length ? '<div class="list">' + lots.map(lotCard).join('') + '</div>' : '')
      + lost.map(f => '<p class="muted">' + E(f.t || f.k) + (known.has(id) ? T(' — лота больше нет в каталоге') : T(' — этой даты уже нет в приложении')) + '</p>').join('');
  }
  return '<div class="hd"><h1>' + T('Избранное') + '</h1><p>' + (n ? T('Машин: ') + n + T('. Сохраняется на этом телефоне, для всех дат.') : '') + '</p></div>'
    + (n ? '<div class="fav-tools">' + favSortSel('favsort', key) + '<button class="btn fav-clear" data-act="fav-clear">' + T('Очистить избранное') + '</button></div>' : '') + (h || '<p class="empty">' + T('Пока пусто. Нажмите ☆ на карточке машины, чтобы собрать свой список на торги.') + '</p>');
}
// избранное списком: лот, машина, MMR, общая заметка (по VIN) и заметка для покупки (живёт, пока машина в избранном)
async function favListScreen() {
  const by = {};
  Object.entries(S.favs).forEach(([id, f]) => { if (f && f.d) (by[f.d] = by[f.d] || []).push([id, f]); });
  const known = new Set(S.index.dates.map(d => d.id)), key = S.flSort, man = key === 'manual';
  let h = '', n = 0;
  for (const id of Object.keys(by).sort().reverse()) {
    if (!known.has(id)) continue;
    let d; try { d = await getDate(id); } catch (e) { continue; }
    const rows = by[id].map(([fid, f]) => [fid, f, d.map[f.k]]).filter(r => r[2]);
    sortFavRows(rows, key);
    rows.sort((a, b) => (a[1].x ? 1 : 0) - (b[1].x ? 1 : 0)); // вычеркнутые внизу
    if (!rows.length) continue;
    n += rows.length;
    const dd = S.index.dates.find(x => x.id === id);
    h += '<h2>' + E(dd ? dLabel(dd) : fmtDate(id)) + ' <span class="muted">' + E(dd ? shortAuc(dd.title) : '') + '</span></h2><div class="flist' + (man ? ' man' : '') + '">'
      + '<div class="fl-h"><span>' + T('Лот') + '</span><span>' + T('Машина') + '</span><span>MMR</span><span>' + T('Для покупки') + '</span><span></span><span></span></div>'
      + rows.map(([fid, f, x]) => {         return '<div class="fl-r' + (f.x ? ' gone' : '') + '" data-fid="' + E(fid) + '"><button class="fl-run" data-lot="' + E(x.k) + '"' + (id !== S.date ? ' data-fd="' + E(id) + '"' : '') + '>' + E(x.run) + '</button>'
          + '<span class="fl-car">' + ((nf => nf ? (nf.stop ? ' <em class="fl-tag bad">' + T('не смотреть') + '</em>' : '') + (nf.bid ? ' <em class="fl-tag">' + T('до ') + M(nf.bid) + '</em>' : '') : '')(noteFlags(noteOf(x)))) + ((ov => ov ? ' <em class="fl-tag' + (ov.s === 3 ? ' bad' : ov.s === 1 ? ' ok' : '') + '">OBD</em>' : '')(obdOf(x) && window.OBD && OBD.verdict(obdOf(x).codes, x.mk)))  + ' ' + E(carName(x))+ '</span><span class="fl-mmr">' + (x.est && x.w ? '≈' : '') + M(x.w) + '</span>'
          + '<textarea class="fl-in buy" rows="1" data-bn="' + E(fid) + '" placeholder="' + T('Для покупки') + '">' + E(f.bn || '') + '</textarea><button class="fl-x" data-act="fl-x" data-fid="' + E(fid) + '" aria-pressed="' + !!f.x + '" title="' + (f.x ? T('Вернуть') : T('Ушла, не купили: зачеркнуть')) + '" aria-label="' + (f.x ? T('Вернуть') : T('Зачеркнуть')) + '">' + (f.x ? '↺' : '✕') + '</button><button class="fl-grip" aria-label="' + T('Перетащить') + '" title="' + T('Перетащить') + '"><i></i><i></i><i></i></button></div>'; }).join('') + '</div>';
  }
  return '<div class="hd"><h1>' + T('Список избранного') + '</h1><p>' + (n ? T('Заметка для покупки удаляется, когда машину убирают из избранного.') + ' ' + T('Порядок меняется перетаскиванием за ≡ справа.') : '') + '</p></div>'
    + (n ? favSortSel('flsort', key) : '') + (h || '<p class="empty">' + T('Пока пусто. Нажмите ☆ на карточке машины, чтобы собрать свой список на торги.') + '</p>');
}
function setNote(vin, text, x, date) {
  const prev = S.notes[vin]; text = String(text || '').trim();
  if ((prev ? prev.text : '') === text) return false;
  if (text) S.notes[vin] = Object.assign({ text, date: date || S.date, run: x ? x.run : prev && prev.run, car: x ? carName(x) : prev && prev.car, updatedAt: new Date().toISOString() }, prev && prev.cby ? { cby: prev.cby, cat: prev.cat } : {});
  else S.notes[vin] = { text: '', updatedAt: new Date().toISOString(), del: 1 };
  LS.set('auction-notes-v1', S.notes);
  if (window.Sync) Sync.pushNote(vin, S.notes[vin]);
  return true;
}
function saveListInput(t) {
  if (t.dataset.gn) { const d = S.cache[t.dataset.d] || S.d, x = d && d.map[t.dataset.k]; setNote(t.dataset.gn, t.value, x, t.dataset.d); }
  else if (t.dataset.bn) { const f = S.favs[t.dataset.bn]; if (!f) return; const v = t.value.trim(); if ((f.bn || '') === v) return; if (v) f.bn = v; else delete f.bn; f.ts2 = Date.now(); saveFavs(); }
}
function lotsScreen() {
  const fc = activeFilterCount();
  return '<div class="searchbar"><input type="search" id="q" placeholder="' + T('Модель, лот или VIN') + '" value="' + E(S.f.q) + '" autocomplete="off" enterkeyhint="search" aria-label="' + T('Поиск') + '"><button id="btnFilters" class="' + (fc ? 'on' : '') + '">' + T('Фильтры') + (fc ? ' · ' + fc : '') + '</button></div>'
    + '<div class="qf">' + QUICK.filter(q => q[0] !== 'seven' || isMax()).map(([k, l]) => '<button data-quick="' + k + '" aria-pressed="' + (S.f.quick === k) + '">' + l + '</button>').join('') + '</div>'
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
    + '<div class="tiles"><div class="tile"><b>' + (s.n ?? '—') + '</b><span>' + T('продано') + (s.off ? T(', на оффере ') + s.off : '') + (s.u != null ? T(', не продано ') + s.u : '') + '</span></div>'
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
    return '<' + (has ? 'button data-lot="' + E(k) + '"' : 'div') + ' class="r"><div class="l"><b>' + E(x.run) + '</b> <small>' + E(AUC[x.auc] || x.auc) + '</small><br>' + E(x.d) + '<br><small>' + (x.o ? N(x.o) + ' mi · ' : '') + (x.g ? T('оценка ') + E(x.g) + ' · ' : '') + 'MMR ' + M(m(x)) + '</small></div><div class="rt"><b>' + (x.fact ? M(x.fact) : x.ss === 'offer' && x.bnf ? M(x.bnf) : E(SS[x.ss] || '—')) + '</b>' + (x.fact || (x.ss === 'offer' && x.bnf) ? '<small class="st' + (x.fact ? '' : ' off') + '">' + E(x.fact ? SS.sold : SS.offer) + '</small>' : '') + (d1 != null ? '<small class="' + (d1 > 0 ? 'pos' : d1 < 0 ? 'neg' : '') + '">' + (d1 > 0 ? '+' : '') + M(d1) + ' · ' + Math.round(100 * x.fact / m(x)) + '%</small>' : '') + '</div></' + (has ? 'button' : 'div') + '>'; }).join('') || '<p class="empty">' + T('Ничего не нашлось.') + '</p>';
  $('#rmore').innerHTML = a.length > S.rshown ? '<button class="more" data-act="rmore">' + T('Показать ещё') + '</button>' : '';
}
function more() {
  const notes = Object.entries(S.notes).filter(([, n]) => n && n.text);
  const cur = LANGS.find(l => l[0] === LANG);
  const Y = window.Sync && Sync.st;
  const acc = Y && Y.on ? '<button data-act="auth"><span class="ic">👤</span><span>' + (Y.user ? E(Y.user.name) + '<small>' + E(Y.user.email) + T(' · заметки общие. Нажмите, чтобы выйти') + '</small>' : T('Войти через Google') + '<small>' + (Y.err ? E(Y.err) : T('Чтобы заметки были видны всем и было видно, кто их оставил')) + '</small>') + '</span></button>' : '';
  return '<div class="menu">' + acc + '<button data-act="lang"><span class="ic flag">' + cur[1] + '</span><span>' + T('Язык') + '<small>' + cur[2] + '</small></span></button>'
    + (window.Sync && Sync.isAdmin && Sync.isAdmin() ? '<button data-act="activity"><span class="ic">📊</span><span>' + T('Активность') + '<small>' + T('Кто сколько раз заходил и сколько минут был в приложении') + '</small></span></button>' : '')
    + '<button data-act="notes"><span class="ic">📝</span><span>' + T('Заметки') + '<small>' + (notes.length ? notes.length + T(' шт., привязаны к VIN') : T('Пока нет. Пишутся в карточке машины.')) + '</small></span></button>'
    + '<button data-act="how"><span class="ic">🧮</span><span>' + T('Как считается прибыль') + '<small>' + T('MMR, сбор, цена продажи, максимальная ставка') + '</small></span></button>'
    + '<button data-act="install"><span class="ic">📲</span><span>' + installTitle() + '<small>' + (isStandalone() ? T('Уже установлено') : platform() === 'desktop' ? T('Windows и Mac, без магазина приложений') : T('iPhone и Android, без App Store')) + '</small></span></button>'
    + '<button data-act="share-app"><span class="ic">🔗</span><span>' + T('Поделиться приложением') + '<small>' + T('Отправить ссылку другу') + '</small></span></button>'
    + '<button data-act="refresh"><span class="ic">🔄</span><span>' + T('Проверить обновления') + '<small>' + T('Данные от ') + E(fmtUpdated(S.index.updated)) + '</small></span></button>'
    + '<button data-act="font"><span class="ic">Aa</span><span>' + T('Шрифт') + '<small>' + fontLabel() + '</small></span></button>'
    + '<button data-act="theme"><span class="ic">◐</span><span>' + T('Тема оформления') + '<small>' + ({ light: T('Светлая'), dark: T('Тёмная') }[LS.get('theme', '')] || T('Как в системе')) + '</small></span></button>'
    + '</div><p class="foot">' + T('Аукционы Хьюстона · версия данных ') + E(S.index.version) + '<br>' + T('Цены ориентировочные: MMR и ретейл Manheim, без осмотра машины.') + '<br>© 2026 Maxat Tulegenov. ' + T('Все права защищены.') + '</p>';
}

/* ---------- активность (только админ) ---------- */
async function activitySheet(days) {
  S.actDays = days;
  const since = new Date(Date.now() - (days - 1) * 864e5), sd = since.getFullYear() + '-' + String(since.getMonth() + 1).padStart(2, '0') + '-' + String(since.getDate()).padStart(2, '0');
  const seg = '<div class="seg act-seg" role="group">' + [[1, T('Сегодня')], [7, T('7 дней')], [30, T('30 дней')]].map(([n, l]) => '<button data-act="act-days" data-n="' + n + '" aria-pressed="' + (days === n) + '">' + l + '</button>').join('') + '</div>';
  openSheet(T('Активность'), seg + '<p class="empty">…</p>', true);
  let rows;
  try { rows = await Sync.activity(sd); }
  catch (e) { const sh = $('#sheet'); if (sh && sheetOpen) sh.querySelector('.empty').textContent = (e && e.code === 'permission-denied') ? T('База пока не пускает: обновите правила Firestore (раздел activity).') : String(e.message || e); return; }
  const fmtMin = s => { const m = Math.round(s / 60); return m < 60 ? m + T(' мин') : Math.floor(m / 60) + T(' ч ') + (m % 60) + T(' мин'); };
  const by = {};
  rows.forEach(r => { const u = by[r.uid] = by[r.uid] || { name: r.name || r.email, email: r.email, sessions: 0, sec: 0, days: {}, last: null, dev: {} }; u.sessions += r.sessions; u.sec += r.sec; u.days[r.date] = (u.days[r.date] || 0) + r.sec; if (r.last && (!u.last || r.last > u.last)) u.last = r.last; if (r.dev) u.dev[r.dev] = 1; });
  const us = Object.values(by).sort((p, q) => q.sec - p.sec);
  const dl = []; for (let i = days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); dl.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); }
  const mx = Math.max(60, ...us.flatMap(u => dl.map(d => u.days[d] || 0)));
  const DEV = { 'app/phone': T('приложение на телефоне'), 'web/phone': T('браузер на телефоне'), 'app/desktop': T('приложение на компьютере'), 'web/desktop': T('браузер на компьютере') };
  const ago = d => { if (!d) return '—'; const m = Math.round((Date.now() - d) / 60000); return m < 2 ? T('сейчас') : m < 60 ? m + T(' мин назад') : m < 1440 ? Math.round(m / 60) + T(' ч назад') : d.toLocaleDateString(LANG === 'en' ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString(LANG === 'en' ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' }); };
  const h = us.length ? us.map(u => '<div class="act-u"><div class="act-h"><b>' + E(u.name) + '</b><small>' + E(u.email || '') + '</small></div>'
      + '<div class="act-k"><div><span>' + T('Входов') + '</span><b>' + u.sessions + '</b></div><div><span>' + T('Время') + '</span><b>' + fmtMin(u.sec) + '</b></div><div><span>' + T('Дней') + '</span><b>' + Object.values(u.days).filter(s => s > 0).length + '</b></div><div><span>' + T('Последний раз') + '</span><b>' + ago(u.last) + '</b></div></div>'
      + (days > 1 ? '<div class="act-bars" aria-hidden="true">' + dl.map(d => '<i title="' + d + ': ' + fmtMin(u.days[d] || 0) + '" style="height:' + Math.max(2, Math.round(40 * (u.days[d] || 0) / mx)) + 'px"></i>').join('') + '</div><div class="act-ax"><span>' + fmtDate(dl[0]) + '</span><span>' + fmtDate(dl[dl.length - 1]) + '</span></div>' : '')
      + '<small class="muted">' + Object.keys(u.dev).map(k => DEV[k] || k).join(', ') + '</small></div>').join('')
    : '<p class="empty">' + T('За этот период заходов нет. Учёт идёт с момента обновления приложения.') + '</p>';
  const sh = $('#sheet'); if (!sh || !sheetOpen || S.actDays !== days) return;
  sh.querySelector('.empty').outerHTML = h + '<p class="muted" style="font-size:12.5px;margin-top:10px">' + T('Вход считается, когда приложение открыли или вернулись в него после перерыва больше 30 минут. Время идёт, только пока приложение на экране.') + '</p>';
}

/* ---------- шторка ---------- */
let sheetOpen = false;
function openSheet(title, html, full, actions) {
  const sh = $('#sheet');
  sh.className = 'sheet' + (full ? ' full' : '');
  sh.innerHTML = (full ? '' : '<div class="grip"></div>') + '<div class="sheet-h"><h2 id="sheetTitle">' + title + '</h2>' + (actions || '') + '<button data-act="close">' + (full ? T('Назад') : T('Готово')) + '</button></div>' + html;
  sh.hidden = false; $('#sheetBg').hidden = false; document.body.style.overflow = 'hidden';
  sh.scrollTop = 0;
  if (!sheetOpen) S.sheetY = window.scrollY;
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
  if (x.cls && !(x.cls === 'clean' && ANN_MARK.test(x.a || ''))) chips += '<span class="chip ' + (CLS[x.cls] || CLS.clean)[0] + '">' + (CLS[x.cls] || CLS.clean)[1] + '</span>';
  if (ANN_MARK.test(x.a || '') && !x.hist) chips += '<span class="chip warn">' + E(annText(x).split(/;\s*/).filter(t => /прокат|флот|изъят|rental|fleet|repo/i.test(t)).join(', ') || annText(x)) + '</span>';
  if (ch) chips += '<span class="chip ' + ch[0] + '">' + T('Шанс купить: ') + ch[1] + '</span>';
  if (x.bn) chips += '<span class="chip">Buy Now ' + M(x.bn) + '</span>';
  if (x.floor) chips += '<span class="chip' + (x.max != null && x.floor > x.max ? ' warn' : '') + '">' + T('Floor price ') + M(x.floor) + (x.max != null && x.floor > x.max ? T(', выше нашей ставки') : '') + '</span>';
  { const fr = flRes(x); if (fr) chips += '<span class="chip ' + (fr.c === 'ok' ? 'good' : fr.c) + '">' + E(fr.t) + '</span>'; }
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
    + '<h3 class="d-name">' + E(carTitle(x)) + '</h3><p class="sub">' + (x.o > 500 ? N(x.o) + ' mi · ' : '') + E(COLOR[x.c] || String(x.c || '').toLowerCase()) + (x.tr ? (x.est ? ' · EDGE: ' : ' · Manheim: ') + E(x.tr) : '') + '</p>' + flResTag(x)
    + (chips ? '<div class="chips">' + chips + '</div>' : '') + factText(x) + '</div>'
    + (isInop(x) ? '<div class="d-card"><div class="grid6"><div class="hl"><b>' + M(x.w) + '</b><span>Adjusted MMR</span></div></div><p class="muted" style="margin-top:6px">' + T('Неходячая машина: прибыль, цену продажи и макс. ставку не считаем, только MMR.') + '</p></div>' : '')
    + (isInop(x) ? '' : '<div class="d-card"><div class="grid6"><div class="hl"><b>' + M(x.w) + '</b><span>Adjusted MMR</span></div><div><b>' + M(x.w != null ? x.w + FEE : null) + '</b><span>' + T('MMR + сбор ') + M(FEE) + '</span></div><div><b>' + M(x.r) + '</b><span>' + (x.est ? T('ретейл, оценка') : T('ретейл Manheim')) + '</span></div><div><b>' + M(x.sale) + '</b><span>' + T('цена продажи') + '</span></div><div><b class="' + profCls(x) + '">' + M(x.prof) + '</b><span>' + T('прибыль по MMR') + '</span></div><div><b>' + M(x.max) + '</b><span>' + T('макс. ставка') + (x.margin ? T(' (прибыль ') + M(x.margin) + ')' : '') + '</span></div>' + ((nf => nf && (nf.bid || nf.ws) ? (nf.bid ? '<div><b>' + M(nf.bid) + '</b><span>' + T('ставка по заметке') + '</span></div>' : '') + (nf.ws ? '<div><b>' + M(nf.ws) + '</b><span>' + T('WS по заметке') + '</span></div>' : '') : '')(noteFlags(noteOf(x)))) + '</div>'
    + (x.est ? '<p class="muted" style="margin-top:6px">' + T('Новый лот: Manheim ещё не смотрели. MMR и ретейл оценены по похожим машинам с прошлых торгов.') + ' ' + E(x.src || '') + '</p>' : '')
    + (x.demand ? '<p class="p"><b>' + T('Спрос ') + x.demand + '/10</b>' + (x.sell ? T(', продаётся за ') + E(weeks(x.sell)) : '') + '</p>' : '') + '</div>')
    + (x.sale != null && !isInop(x) ? '<div class="d-card"><h3>' + T('Калькулятор ставки') + '</h3><div class="calc"><input id="bid" type="number" inputmode="numeric" value="' + E(bid) + '" aria-label="' + T('Ваша ставка, $') + '"><div class="calc-out" id="calcOut"></div></div></div>' : '')
    + (wifeOn() && !isInop(x) ? wifeHtml(x, true) : '')
    + (info ? '<div class="d-card">' + info + '</div>' : '')
    + '<div class="d-card"><h3><label for="note">' + T('Заметка после осмотра') + (n && n.date && n.date !== S.date ? T(' (от ') + fmtDate(n.date) + T(', лот ') + E(n.run) + ')' : '') + '</label></h3><textarea class="note' + (n ? ' has' : '') + '" id="note" data-k="' + E(k) + '" placeholder="' + T('Что увидели: кузов, мотор, салон, запах, ошибки') + '">' + E(n ? n.text : '') + '</textarea><div class="note-bar"><p class="muted" id="nstat" style="font-size:12.5px">' + E(noteStatus(n)) + '</p><button class="btn" data-act="note-done">' + T('Сохранить') + '</button></div></div>'
    + '<div class="d-card obd" id="obdCard" data-k="' + E(k) + '">' + obdCard(x) + '</div>'
    + '<div class="d-card"><p class="vin">VIN ' + E(x.vin || T('нет')) + '</p><div class="btns">'
    + '<button class="btn" data-fav="' + E(k) + '">' + (isFav(x) ? T('★ В избранном') : T('☆ В избранное')) + '</button>'
    + (x.vin ? '<button class="btn" data-act="copy" data-v="' + E(x.vin) + '">' + T('Скопировать VIN') + '</button>' : '')
    + (link ? '<a class="btn pri" href="' + E(link) + '" target="_blank" rel="noopener">' + T('Открыть лот') + '</a>' : '')
    + '<button class="btn" data-act="share-lot" data-k="' + E(k) + '">' + T('Поделиться') + '</button>'
    + '</div></div>';
  openSheet(T('Лот ') + E(x.run), html, true);
  calc(x); obdThumbs(x);
}
/* ---------- ошибки OBD: скриншот ThinkDiag у машины, коды распознаются в приложении, пояснения из справочника obd.js ---------- */
const OBD_IMG = {};
function obdOf(x) { const o = x && x.vin && S.obd[x.vin]; return o && ((o.codes && o.codes.length) || (o.shots && o.shots.length)) ? o : null; }
function obdCard(x) {
  let h = '<h3>' + T('Ошибки OBD (ThinkDiag)') + '</h3>';
  if (!x.vin) return h + '<p class="muted">' + T('У лота нет VIN: скриншот не к чему привязать.') + '</p>';
  if (!window.OBD) return h + '<p class="muted">' + T('Загрузка…') + '</p>';
  const o = obdOf(x), v = o && OBD.verdict(o.codes, x.mk);
  if (o && o.shots.length) h += '<div class="obd-shots">' + o.shots.map(s => '<button class="obd-th" data-act="obd-view" data-id="' + E(s.id) + '" aria-label="' + T('Открыть скриншот') + '"><img alt="" data-obd="' + E(s.id) + '"' + (OBD_IMG[x.vin + '/' + s.id] ? ' src="' + OBD_IMG[x.vin + '/' + s.id] + '"' : '') + '></button>').join('') + '</div>';
  if (v) h += '<p class="obd-v ' + OBD.SEV[v.s][0] + '"><b>' + E(T(v.t)) + '</b></p>';
  if (o && o.codes.length) h += '<ul class="obd-list">' + o.codes.map((c, i) => { const f = OBD.info(c.c, c.d, x.mk), sv = OBD.SEV[f.s]; return '<li class="' + sv[0] + '"><div class="obd-h"><b class="obd-c' + (c.c ? '' : ' nc') + '">' + E(c.c || c.rc || T('без кода')) + '</b><span class="obd-sev">' + T(sv[1]) + '</span>' + (c.st ? '<span class="obd-st">' + T(OBD.ST[c.st]) + '</span>' : '') + '<button class="obd-rm" data-act="obd-rm" data-i="' + i + '" aria-label="' + T('Убрать код') + '">✕</button></div><p class="obd-t">' + E(f.t) + '</p><p class="obd-n">' + E(f.n) + '</p>' + (c.c && c.d && f.known ? '<p class="obd-en">ThinkDiag: ' + E(c.d) + '</p>' : '') + '</li>'; }).join('') + '</ul>';
  else if (o) h += '<p class="muted">' + T('Коды на скриншоте не распознались. Введите их ниже.') + '</p>';
  h += '<div class="obd-bar"><label class="btn pri obd-add">' + T('📷 Добавить скриншот') + '<input type="file" accept="image/*" multiple id="obdFile" hidden></label></div>'
    + '<div class="obd-man"><input id="obdIn" type="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="' + T('Код вручную: P0420, U0100') + '" aria-label="' + T('Код ошибки') + '"><button class="btn" data-act="obd-code">' + T('Добавить') + '</button></div>';
  const Y = window.Sync && Sync.st;
  const err = Y && Y.obdErr === 'rules' ? T('Не сохраняется в базе: в Firebase нужно добавить правило для obd (см. сообщение в чате).') : Y && Y.obdErr ? Y.obdErr : '';
  const pendN = window.Sync && Sync.obdPending ? Sync.obdPending() : 0;
  h += '<p class="muted obd-stat" id="obdSt">' + E(err ? err + (pendN ? T(' Неотправленных: ') + pendN + T(', отправятся сами.') : '') : pendN ? T('Ждёт отправки в базу, отправится само при подключении.') : (o && o.by ? T('Добавил ') + o.by + (o.at ? ', ' + new Date(o.at).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '') : T('Скриншот с ошибками увидят все. Коды распознаются автоматически.'))) + '</p>';
  return h;
}
function obdRedraw() { const c = $('#obdCard'); if (!c) return; const x = S.d.map[c.dataset.k]; if (!x) return; const a = document.activeElement, keep = a && a.id === 'obdIn' ? a.value : null; c.innerHTML = obdCard(x); if (keep != null) { const i = $('#obdIn'); i.value = keep; i.focus(); } obdThumbs(x); }
async function obdThumbs(x) {
  const o = obdOf(x); if (!o) return;
  for (const s of o.shots) {
    const key = x.vin + '/' + s.id;
    if (!OBD_IMG[key] && window.Sync && Sync.obdImg) { const d = await Sync.obdImg(x.vin, s.id); if (d) OBD_IMG[key] = d; }
    const im = document.querySelector('img[data-obd="' + CSS.escape(s.id) + '"]'); if (im && OBD_IMG[key] && im.src !== OBD_IMG[key]) im.src = OBD_IMG[key];
  }
}
function obdSave(x, o, img) {
  o.car = carName(x); o.run = x.run; o.date = x._d || S.date;
  const Y = window.Sync && Sync.st; o.by = (Y && Y.user && Y.user.name) || o.by || ''; o.at = new Date().toISOString();
  if (!o.codes.length && !o.shots.length) delete S.obd[x.vin]; else S.obd[x.vin] = o;
  LS.set('auction-obd-v1', S.obd);
  obdRedraw();
  if (window.Sync && Sync.pushObd) return Sync.pushObd(x.vin, o.codes.length || o.shots.length ? o : null, img).then(() => obdRedraw());
}
function obdCur() { const c = $('#obdCard'), x = c && S.d.map[c.dataset.k]; if (!x || !x.vin) return null; const o = S.obd[x.vin] ? JSON.parse(JSON.stringify(S.obd[x.vin])) : { codes: [], shots: [] }; o.codes = o.codes || []; o.shots = o.shots || []; return [x, o]; }
function loadImg(f) { return new Promise((ok, bad) => { const u = URL.createObjectURL(f), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); ok(im); }; im.onerror = e => { URL.revokeObjectURL(u); bad(e); }; im.src = u; }); }
// сжатие для базы: длинная сторона до 1600px, JPEG ~150–300 КБ (лимит документа Firestore 1 МБ)
function obdShrink(im) {
  let q = .72, mx = 1600, out = '';
  for (let t = 0; t < 4; t++) {
    const r = Math.min(1, mx / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * r); c.height = Math.round(im.naturalHeight * r);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    out = c.toDataURL('image/jpeg', q);
    if (out.length < 700000) break; q -= .12; mx -= 300;
  }
  return out;
}
// для распознавания: красная печать THINKCAR стирается, серый, тёмная тема переворачивается в светлую, мелкий скриншот увеличивается
function obdPrep(im) {
  const r = Math.max(1, 1400 / im.naturalWidth), c = document.createElement('canvas');
  c.width = Math.round(im.naturalWidth * Math.min(r, 2.5)); c.height = Math.round(im.naturalHeight * Math.min(r, 2.5));
  const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data; let sum = 0;
  for (let i = 0; i < p.length; i += 4) { const R = p[i], G = p[i + 1], B = p[i + 2]; const l = (R > 140 && R - G > 60 && R - B > 60) ? 255 : .299 * R + .587 * G + .114 * B; p[i] = p[i + 1] = p[i + 2] = l; sum += l; }
  if (sum / (p.length / 4) < 110) for (let i = 0; i < p.length; i += 4) p[i] = p[i + 1] = p[i + 2] = 255 - p[i];
  g.putImageData(d, 0, 0); return c;
}
let OCR2 = null, ocr2T = 0;
function ocrText() {
  if (!OCR2) OCR2 = (async () => {
    if (!window.Tesseract) await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'vendor/tess/tesseract.min.js'; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
    const base = new URL('vendor/tess/', location.href).href;
    return Tesseract.createWorker(['rus', 'eng'], 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true, workerBlobURL: false });
  })().catch(e => { OCR2 = null; throw e; });
  clearTimeout(ocr2T);
  return OCR2;
}
function ocrIdle() { clearTimeout(ocr2T); ocr2T = setTimeout(() => { if (OCR2) OCR2.then(w => w.terminate()).catch(() => {}); OCR2 = null; }, 90000); }
async function obdAdd(files) {
  const cur = obdCur(); if (!cur) return; const [x, o] = cur;
  const say = t => { const el = $('#obdSt'); if (el) el.textContent = t; };
  for (const f of files) {
    let im; try { im = await loadImg(f); } catch (e) { toast(T('Не получилось открыть картинку')); continue; }
    say(T('Сохраняю скриншот…'));
    const data = obdShrink(im), id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    OBD_IMG[x.vin + '/' + id] = data;
    o.shots.push({ id, at: new Date().toISOString(), by: (window.Sync && Sync.st.user && Sync.st.user.name) || '' });
    obdSave(x, o, { id, data });
    say(T('Распознаю коды ошибок…'));
    let found = [];
    try { const w = await ocrText(); const r = await w.recognize(obdPrep(im)); found = OBD.parse(r.data.text); ocrIdle(); } catch (e) { console.warn('ocr', e); }
    const add = found.filter(c => !o.codes.some(z => c.c ? z.c === c.c : c.rc ? z.rc === c.rc : !z.c && z.d === c.d));
    o.codes.push(...add);
    if (add.length) obdSave(x, o);
    toast(found.length ? T('Найдено ошибок: ') + found.length : T('Коды не распознаны: введите вручную'));
  }
  obdRedraw();
}
function obdView(id) {
  const cur = obdCur(); if (!cur) return; const [x] = cur, src = OBD_IMG[x.vin + '/' + id]; if (!src) return;
  const v = document.createElement('div'); v.className = 'obd-view'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true');
  v.innerHTML = '<img alt="' + T('Скриншот OBD') + '" src="' + src + '"><div class="obd-vbar"><button class="btn" data-act="obd-del-img" data-id="' + E(id) + '">' + T('Удалить скриншот') + '</button><button class="btn pri" data-act="obd-close">' + T('Закрыть') + '</button></div>';
  document.body.appendChild(v);
}
function calc(x) {
  const i = $('#bid'), o = $('#calcOut'); if (!i || !o) return;
  const b = +i.value || 0, tot = b + FEE, pr = x.sale - tot;
  o.innerHTML = T('С учётом сбора: ') + '<b>' + M(tot) + '</b><br>' + T('Прибыль: ') + '<b class="' + (pr >= (x.margin || 1000) ? 'pos' : pr > 0 ? 'mid' : 'neg') + '">' + M(pr) + '</b>' + (x.w ? ' · ' + Math.round(100 * b / x.w) + T('% от MMR') : '');
}
function saveNote(ta) {
  const x = S.d.map[ta.dataset.k]; if (!x || !x.vin) return;
  const text = ta.value.trim();
  if (!setNote(x.vin, text, x, x._d || S.date)) return;
  const st = $('#nstat'); if (st) st.textContent = T('Сохранено');
  ta.classList.toggle('has', !!text);
}
function notesSheet() {
  const list = Object.entries(S.notes).filter(([, n]) => n && n.text).sort((a, b) => String(b[1].updatedAt || '').localeCompare(String(a[1].updatedAt || '')));
  openSheet(T('Заметки'), list.length ? '<div class="rows">' + list.map(([v, n]) => '<button class="r" data-nv="' + E(v) + '" data-nd="' + E(n.date || '') + '"><div class="l"><b>' + E(n.car || '') + '</b><br><small>' + fmtDate(n.date) + T(' · лот ') + E(n.run) + ' · <span class="vin">' + E(v) + '</span></small><p style="margin-top:4px">' + E(n.text) + '</p>' + (n.by ? '<small>' + E(noteWho(n)) + '</small>' : '') + '</div></button>').join('') + '</div><div class="btns"><button class="btn pri" data-act="share-notes">' + T('Отправить все заметки') + '</button><button class="btn" data-act="copy-notes">' + T('Скопировать') + '</button></div><p class="muted" style="font-size:13px;margin-top:10px">' + T('Отправьте заметки в чат с Claude, и он учтёт их в следующем анализе.') + '</p>' : '<p class="empty">' + T('Заметок пока нет. Откройте машину и напишите, что увидели на осмотре.') + '</p>', true);
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
function toggleFav(k, fd) {
  const d = fd && S.cache[fd] ? S.cache[fd] : S.d, x = d.map[k]; if (!x) return;
  const fk = favKey(x), on = !isFav(x);
  if (on) { S.favs[x.vin || fk] = { d: x._d || S.date, k: x.k, t: carTitle(x), ts: Date.now() }; delete S.favDel[x.vin || fk]; }
  else { const now = Date.now(); if (x.vin) { delete S.favs[x.vin]; S.favDel[x.vin] = now; } delete S.favs[fk]; S.favDel[fk] = now; }
  saveFavs();
  toast(on ? T('Добавлено в избранное') : T('Убрано из избранного'));
  document.querySelectorAll('[data-fav="' + CSS.escape(k) + '"]').forEach(b => { if ((b.dataset.fd || '') !== (fd || '')) return; if (b.classList.contains('star')) { b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', on); } else b.textContent = on ? T('★ В избранном') : T('☆ В избранное'); });
  if ((S.tab === 'fav' || S.tab === 'flist') && !sheetOpen) render();
}

document.addEventListener('click', async e => {
  const t = e.target.closest('button,[data-lot],a'); if (!t) return;
  if (e.target === $('#sheetBg')) return;
  const ds = t.dataset;
  if (ds.fav) { e.stopPropagation(); toggleFav(ds.fav, ds.fd); return; }
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
  if (ds.nv) { const known = S.index.dates.some(d => d.id === ds.nd); if (!known) { toast(T('Этой даты уже нет в приложении')); return; } const d = await getDate(ds.nd), x = d.lots.find(l => l.vin === ds.nv); if (!x) return; closeSheet(); if (ds.nd !== S.date) { await loadDate(ds.nd); render(); } setTimeout(() => detail(x.k), 50); return; }
  if (ds.lot) { if (ds.fd && ds.fd !== S.date) { await loadDate(ds.fd); datesBar(); } detail(ds.lot); return; }
  if (t.id === 'btnFilters') { filterSheet(); return; }
  if (t.id === 'btnTheme') { cycleTheme(); return; }
  switch (ds.act) {
    case 'close': closeSheet(); break;
    case 'obd-view': obdView(ds.id); break;
    case 'obd-close': { const v = document.querySelector('.obd-view'); if (v) v.remove(); break; }
    case 'obd-del-img': { const v = document.querySelector('.obd-view'); if (v) v.remove(); const cur = obdCur(); if (!cur) break; const [x, o] = cur; o.shots = o.shots.filter(s => s.id !== ds.id); delete OBD_IMG[x.vin + '/' + ds.id]; if (window.Sync && Sync.delObdImg) Sync.delObdImg(x.vin, ds.id); obdSave(x, o); toast(T('Скриншот удалён')); break; }
    case 'obd-rm': { const cur = obdCur(); if (!cur) break; const [x, o] = cur; o.codes.splice(+ds.i, 1); obdSave(x, o); break; }
    case 'obd-code': { const i = $('#obdIn'), cur = obdCur(); if (!i || !cur) break; const [x, o] = cur; const cs = String(i.value).toUpperCase().split(/[\s,;]+/).map(OBD.norm).filter(c => /^[PCBU][0-3][0-9A-F]{3}$/.test(c)); if (!cs.length) { toast(T('Формат кода: буква P, C, B или U и 4 знака, например P0420')); break; } cs.forEach(c => { if (!o.codes.some(z => z.c === c)) o.codes.push({ c, d: '', st: '' }); }); i.value = ''; obdSave(x, o); break; }
    case 'note-done': { const ta = $('#note'); if (ta) { saveNote(ta); ta.blur(); } toast(T('Заметка сохранена')); break; }
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
    case 'activity': activitySheet(S.actDays || 7); break;
    case 'fl-x': { const f = S.favs[ds.fid]; if (!f) break; if (f.x) delete f.x; else f.x = 1; f.ts2 = Date.now(); saveFavs(); const r = t.closest('.fl-r'); if (r) { r.classList.toggle('gone', !!f.x); t.textContent = f.x ? '↺' : '✕'; t.setAttribute('aria-pressed', !!f.x); t.title = f.x ? T('Вернуть') : T('Ушла, не купили: зачеркнуть'); const L = r.parentNode; if (L) { if (f.x) L.appendChild(r); else { const g = L.querySelector('.fl-r.gone'); L.insertBefore(r, g || null); } } } break; }
    case 'fav-clear': {
      const keep = S.favs, now = Date.now(), n = Object.keys(keep).length; if (!n) break;
      S.favs = {}; Object.keys(keep).forEach(k => { S.favDel[k] = now; }); saveFavs(); keepScroll(render);
      toast(T('Избранное очищено: ') + n, T('Вернуть'), () => { const t2 = Date.now(); Object.entries(keep).forEach(([k, f]) => { S.favs[k] = Object.assign({}, f, { ts2: t2 }); delete S.favDel[k]; }); saveFavs(); keepScroll(render); });
      setTimeout(() => { const tt = $('#toast'); if (tt && tt.querySelector('#toastBtn') && /\d/.test(tt.textContent)) tt.hidden = true; }, 8000);
      break;
    }
    case 'act-days': activitySheet(+t.dataset.n); break;
    case 'auth': { const Y = window.Sync && Sync.st; if (!Y) break; if (Y.user) await Sync.signOut(); else await Sync.signIn(); render(); break; }
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
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'obdIn') { e.preventDefault(); const b = document.querySelector('[data-act="obd-code"]'); if (b) b.click(); return; } if (e.key === 'Escape' && document.querySelector('.obd-view')) { document.querySelector('.obd-view').remove(); return; } if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.lot[data-lot]')) { e.preventDefault(); e.target.click(); } if (e.key === 'Escape' && sheetOpen) closeSheet(); if (e.key === '/' && !sheetOpen && !e.target.matches('input,textarea,select') && $('#q')) { e.preventDefault(); $('#q').focus(); } });
$('#sheetBg').addEventListener('click', () => closeSheet());
let qT;
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'q') { clearTimeout(qT); qT = setTimeout(() => { S.f.q = e.target.value; drawLots(); }, 150); }
  else if (id === 'rq') { clearTimeout(qT); qT = setTimeout(() => { S.rf.q = e.target.value; drawResults(); }, 150); }
  else if (id === 'fee_auc' || id === 'fee_dealer') { clearTimeout(qT); qT = setTimeout(setFees, 250); }
  else if (id === 'bid') { const x = S.d.map[$('#note').dataset.k]; calc(x); }
  else if (e.target.matches('.fl-in')) { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; clearTimeout(e.target._t); e.target._t = setTimeout(() => saveListInput(e.target), 700); }
  else if (id === 'note') { const st = $('#nstat'); if (st) st.textContent = T('Сохранится, когда закончите'); clearTimeout(qT); qT = setTimeout(() => saveNote(e.target), 800); }
});
// iPhone: после клавиатуры экран остаётся сдвинутым, и кнопка «Назад» уходит за верх. Возвращаем на место.
document.addEventListener('focusout', e => {
  if (!sheetOpen || !e.target.matches('#sheet textarea, #sheet input')) return;
  setTimeout(() => { if (document.activeElement && document.activeElement.matches('#sheet textarea, #sheet input')) return; window.scrollTo(0, S.sheetY || 0); const h = $('#sheet .sheet-h'); if (h && h.getBoundingClientRect().top < 0) $('#sheet').scrollTop = 0; }, 60);
});
document.addEventListener('change', e => {
  if (e.target.id === 'obdFile') { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) obdAdd(fs); return; }
  if (e.target.id === 'sort') { S.f.sort = e.target.value; drawLots(); }
  else if (e.target.id === 'rsort') { S.rf.sort = e.target.value; drawResults(); }
  else if (e.target.id === 'favsort') { S.favSort = e.target.value; LS.set('fav-sort', S.favSort); keepScroll(render); }
  else if (e.target.id === 'flsort') { S.flSort = e.target.value; LS.set('flist-sort', S.flSort); keepScroll(render); }
  else if (e.target.id === 'note') saveNote(e.target);
  else if (e.target.matches('.fl-in')) saveListInput(e.target);
  else if (e.target.closest('#f_mk')) { const g = document.querySelector('#f_md .md-g[data-mk="' + CSS.escape(e.target.value) + '"]'); if (g) g.hidden = !e.target.checked; }
});

// список избранного: свой порядок перетаскиванием за ≡ (мышь и палец). Строка едет за пальцем, соседние плавно расступаются.
// Порядок пишется в избранное и синхронизируется.
(function () {
  const EASE = 'transform .22s cubic-bezier(.2,.8,.2,1)';
  let row = null, list = null, pid = null, rows = [], tops = [], from = 0, to = 0, h = 0, y0 = 0, s0 = 0, lastY = 0, scrollT = null, done = false;
  function layout() {
    const dy = lastY - y0 + (window.scrollY - s0);
    const c = tops[from] + h / 2 + dy;
    let t = from;
    for (let i = 0; i < rows.length; i++) if (i !== from) { const m = tops[i] + rows[i].offsetHeight / 2; if (i < from && c < m) { t = i; break; } if (i > from && c > m) t = i; }
    if (t !== to) { to = t; if (navigator.vibrate) navigator.vibrate(4); }
    rows.forEach((r, i) => { if (i === from) return; r.style.transform = from < i && i <= to ? 'translateY(' + -h + 'px)' : to <= i && i < from ? 'translateY(' + h + 'px)' : ''; });
    row.style.transform = 'translateY(' + dy + 'px) scale(1.045)';
  }
  function edgeScroll() {
    clearInterval(scrollT);
    scrollT = setInterval(() => {
      if (!row || done) return clearInterval(scrollT);
      const v = lastY < 80 ? -Math.min(14, (80 - lastY) / 4 + 2) : lastY > innerHeight - 100 ? Math.min(14, (lastY - innerHeight + 100) / 4 + 2) : 0;
      if (v) { window.scrollBy(0, v); layout(); }
    }, 16);
  }
  function end() {
    if (!row || done) return;
    done = true; clearInterval(scrollT);
    // доезжаем до своего места, потом переставляем в DOM без рывка
    const off = to > from ? tops[to] + rows[to].offsetHeight - (tops[from] + h) : tops[to] - tops[from];
    row.style.transition = EASE + ',box-shadow .22s ease';
    row.style.transform = 'translateY(' + (off - (window.scrollY - s0)) + 'px)';
    row.classList.add('drop');
    document.body.classList.remove('fl-dragging');
    setTimeout(() => {
      const ref = to > from ? rows[to].nextSibling : rows[to];
      if (to !== from) list.insertBefore(row, ref);
      rows.forEach(r => { r.style.transition = 'none'; r.style.transform = ''; });
      row.classList.remove('drag', 'drop'); list.classList.remove('dragging');
      void list.offsetHeight;
      rows.forEach(r => { r.style.transition = ''; });
      if (to !== from) {
        const now = Date.now();
        [...list.querySelectorAll('.fl-r')].forEach((r, i) => { const f = S.favs[r.dataset.fid]; if (f && f.o !== i) { f.o = i; f.ts2 = now; } });
        if (S.flSort !== 'manual') { S.flSort = 'manual'; LS.set('flist-sort', 'manual'); const sel = $('#flsort'); if (sel) sel.value = 'manual'; }
        saveFavs();
      }
      row = list = pid = null; rows = []; S.dragging = false;
    }, 230);
  }
  document.addEventListener('pointerdown', e => {
    const g = e.target.closest && e.target.closest('.fl-grip'); if (!g || row) return;
    e.preventDefault();
    row = g.closest('.fl-r'); list = row.parentNode; pid = e.pointerId; S.dragging = true; done = false;
    rows = [...list.querySelectorAll('.fl-r')]; from = to = rows.indexOf(row);
    s0 = window.scrollY; tops = rows.map(r => r.getBoundingClientRect().top + s0);
    h = from < rows.length - 1 ? tops[from + 1] - tops[from] : row.offsetHeight;
    y0 = lastY = e.clientY;
    try { g.setPointerCapture(pid); } catch (er) {}
    rows.forEach(r => { r.style.transition = r === row ? 'transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s ease' : EASE + ',filter .18s ease,opacity .18s ease'; });
    row.classList.add('drag'); list.classList.add('dragging'); document.body.classList.add('fl-dragging');
    row.style.transform = 'scale(1.045)';
    setTimeout(() => { if (row && !done) row.style.transition = 'box-shadow .18s ease'; }, 180);
    if (navigator.vibrate) navigator.vibrate(15);
    edgeScroll();
  });
  document.addEventListener('pointermove', e => { if (row && !done && e.pointerId === pid) { e.preventDefault(); lastY = e.clientY; layout(); } }, { passive: false });
  document.addEventListener('pointerup', e => { if (row && e.pointerId === pid) end(); });
  document.addEventListener('pointercancel', e => { if (row && e.pointerId === pid) end(); });
  // iOS: не даём странице прокручиваться, пока тянем строку
  document.addEventListener('touchmove', e => { if (row) e.preventDefault(); }, { passive: false });
})();

// заметки пришли из базы: обновляем то, что на экране, не трогая поле, в котором сейчас пишут
window.addEventListener('notes-updated', () => {
  const a = document.activeElement, typing = a && a.matches && a.matches('textarea,input');
  const ta = $('#note');
  if (sheetOpen && ta) { const x = S.d.map[ta.dataset.k], n = x && noteOf(x), st = $('#nstat'); if (a !== ta) { ta.value = n ? n.text : ''; ta.classList.toggle('has', !!n); } if (st && (a !== ta || (n && n.by))) st.textContent = noteStatus(n); }
  if (typing || sheetOpen) return;
  if (S.tab === 'flist' || S.tab === 'fav' || S.tab === 'home') keepScroll(render); else if (S.tab === 'lots') drawLots(true);
});
window.addEventListener('favs-updated', () => { const a = document.activeElement; if (S.dragging || sheetOpen || (a && a.matches && a.matches('textarea,input'))) return; if (S.tab === 'fav' || S.tab === 'flist' || S.tab === 'home') keepScroll(render); else if (S.tab === 'lots') drawLots(true); });
window.addEventListener('obd-updated', () => { if (sheetOpen) { obdRedraw(); return; } const a = document.activeElement; if (S.dragging || (a && a.matches && a.matches('textarea,input'))) return; if (S.tab === 'fav' || S.tab === 'flist') keepScroll(render); else if (S.tab === 'lots') drawLots(true); });
window.addEventListener('sync-state', () => { if (S.f.quick === 'seven' && window.Sync && Sync.st.ready && !isMax()) { S.f.quick = ''; if (S.tab === 'lots' && !sheetOpen) render(); } if ((S.tab === 'more' || S.tab === 'lots') && !sheetOpen && S._maxSeen !== isMax()) { S._maxSeen = isMax(); render(); } else if (S.tab === 'more' && !sheetOpen) render(); });

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
    const tb = LS.get('tab', 'home'); S.tab = ['home', 'fav', 'flist', 'picks', 'lots', 'results', 'more'].includes(tb) ? tb : 'home';
    // возвращаемся туда, где были: фильтры, прокрутка, открытый лот
    const sv = LS.get('view-v1', null);
    const same = sv && !jump && sv.date === S.date;
    if (same) {
      if (sv.f) S.f = { ...S.f, ...sv.f, mk: Array.isArray(sv.f.mk) ? sv.f.mk : [], md: Array.isArray(sv.f.md) ? sv.f.md : [] }; if (!QUICK.some(q => q[0] === S.f.quick)) S.f.quick = '';
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
    await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789', tessedit_pageseg_mode: '7' });
    return w;
  })().catch(e => { OCR = null; throw e; });
  return OCR;
}
// прогрев: сканер готов мгновенно, когда его открывают
function warmScanner() {
  const go = () => { scanWorker(); if (LS.get('scan-used', false)) ocrWorker().catch(() => {}); };
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 4000 }); else setTimeout(go, 2500);
}

// камера между открытиями сканера не выключается сразу: браузер не спрашивает разрешение снова.
// Поток «паркуется» (кадры не идут) и закрывается через 3 минуты или когда приложение свернули.
let camKeep = null, camTimer = 0;
function camRelease() { clearTimeout(camTimer); if (camKeep) camKeep.getTracks().forEach(t => t.stop()); camKeep = null; }
function camPark(st) { if (camKeep && camKeep !== st) camRelease(); camKeep = st; st.getTracks().forEach(t => { try { if (t.getSettings && t.getSettings().torch) t.applyConstraints({ advanced: [{ torch: false }] }); } catch (e) {} t.enabled = false; }); clearTimeout(camTimer); camTimer = setTimeout(camRelease, 180000); }
function camTake() {
  const st = camKeep; clearTimeout(camTimer); camKeep = null;
  if (!st || !st.getVideoTracks().some(t => t.readyState === 'live')) { if (st) st.getTracks().forEach(t => t.stop()); return null; }
  st.getTracks().forEach(t => { t.enabled = true; }); return st;
}
document.addEventListener('visibilitychange', () => { if (document.hidden && !$('#scan')) camRelease(); });
async function openScan() {
  LS.set('scan-used', true);
  const el = document.createElement('div'); el.className = 'scan'; el.id = 'scan';
  el.innerHTML = '<div class="bar"><button data-act="scan-close">' + T('Закрыть') + '</button><button data-act="torch" id="torch" hidden>' + T('Фонарик') + '</button></div><video playsinline muted autoplay></video><div class="frame"></div><canvas id="scanLine" class="scan-line" hidden></canvas>'
    + '<p class="hint" id="scanHint">' + T('Наведите полосу на строку VIN или штрихкод.') + '</p><div class="res" id="scanRes" hidden></div>'
    + '<form id="scanForm"><input id="vinIn" placeholder="' + T('VIN или последние 6 символов') + '" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="search" aria-label="VIN"><button>' + T('Найти') + '</button></form>';
  document.body.appendChild(el); document.body.style.overflow = 'hidden';
  try { history.pushState({ scan: 1 }, ''); } catch (e) {}
  el.querySelector('#scanForm').onsubmit = e => { e.preventDefault(); handleVin($('#vinIn').value, false); };
  const video = el.querySelector('video'), hint = $('#scanHint');
  let stream, alive = true, raf = 0;
  scanStop = () => { alive = false; cancelAnimationFrame(raf); swCb = null; if (stream) camPark(stream); };
  const wP = scanWorker(), oP = ocrWorker().catch(() => null);   // грузятся параллельно с камерой
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { hint.textContent = T('Камера недоступна в этом браузере. Введите VIN вручную.'); return; }
  try { stream = camTake() || await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); }
  catch (e) { hint.textContent = T('Нет доступа к камере. Разрешите камеру в настройках браузера или введите VIN вручную.'); return; }
  if (!alive) { camPark(stream); return; }
  video.srcObject = stream; try { await video.play(); } catch (e) {}
  const track = stream.getVideoTracks()[0];
  try { const cap = track.getCapabilities && track.getCapabilities(); if (cap && cap.torch) { const tb = $('#torch'); tb.hidden = false; let on = false; tb.onclick = () => { on = !on; track.applyConstraints({ advanced: [{ torch: on }] }); }; } if (cap && cap.focusMode && cap.focusMode.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}

  const W = await wP; if (!alive) return;
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  const lc = document.createElement('canvas'), lx = lc.getContext('2d', { willReadFrequently: true });
  const pv = el.querySelector('#scanLine'), px = pv.getContext('2d'), frameEl = el.querySelector('.frame');
  let zBusy = false, oBusy = false, n = 0, done = false, seen = {}, last = '', ocr = null;
  oP.then(w => { ocr = w; });
  // где рамка на экране в координатах кадра камеры (видео растянуто object-fit: cover)
  const slot = (vw, vh, grow) => {
    const vr = video.getBoundingClientRect(), fr = frameEl.getBoundingClientRect(), k = Math.max(vr.width / vw, vr.height / vh);
    const ox = (vr.width - vw * k) / 2, oy = (vr.height - vh * k) / 2;
    let x = (fr.left - vr.left - ox) / k, y = (fr.top - vr.top - oy) / k, w = fr.width / k, h = fr.height / k;
    const g = h * (grow - 1) / 2; y -= g; h += 2 * g;
    x = Math.max(0, x); y = Math.max(0, y); w = Math.min(vw - x, w); h = Math.min(vh - y, h);
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  };
  const accept = async (vin, how) => {
    if (done || !alive) return; $('#vinIn').value = vin;
    if (how === 'unknown') { if (vin === last) return; last = vin; const res = $('#scanRes'); res.hidden = false; res.innerHTML = T('Прочитал VIN ') + '<b class="vin">' + E(vin) + '</b>' + T('. Сверьте с надписью: если есть ошибка, исправьте в поле внизу. Этой машины нет в каталогах приложения.') + '<br><button class="btn" data-act="copy" data-v="' + E(vin) + '">' + T('Скопировать VIN') + '</button>'; if (navigator.vibrate) navigator.vibrate(60); return; }
    done = true; await handleVin(vin, false); done = !!$('#scan') ? false : true;
  };
  const readLines = async lines => {
    const texts = [];
    for (const l of lines) {
      if (!alive) return;
      const im = new ImageData(new Uint8ClampedArray(l.buf), l.w, l.h);
      lc.width = l.w; lc.height = l.h; lx.putImageData(im, 0, 0);
      if (!texts.length) { pv.width = l.w; pv.height = l.h; px.putImageData(im, 0, 0); pv.hidden = false; }
      try { const r = await ocr.recognize(lc); texts.push(r.data.text.trim()); } catch (e) {}
    }
    if (alive) W.postMessage({ type: 'text', text: texts.join('\n') }); else oBusy = false;
  };
  swCb = m => {
    if (m.type === 'code') { zBusy = false; if (m.vin) accept(m.vin, m.known ? 'known' : 'unknown'); }
    else if (m.type === 'lines') { if (!m.lines.length) { oBusy = false; hint.textContent = T('Наведите полосу на строку VIN.'); } else readLines(m.lines); }
    else if (m.type === 'ocr') {
      oBusy = false; const r = m.res; if (!r || !alive) return;
      if (r.raw) { hint.textContent = T('Читаю надпись: ') + r.raw + '…'; return; }
      seen[r.vin] = (seen[r.vin] || 0) + 1;
      if (r.unknown ? seen[r.vin] >= 2 : (r.exact || r.d <= 2 || seen[r.vin] >= 2)) accept(r.vin, r.unknown ? 'unknown' : 'known');
      else hint.textContent = T('Читаю надпись: ') + (r.read || r.vin) + '…';
    }
  };
  const loop = () => {
    if (!alive) return;
    const vw = video.videoWidth, vh = video.videoHeight;
    if (vw) {
      if (ocr && !oBusy) {   // надпись: полоса рамки → фоновый поток ищет строку букв
        const b = slot(vw, vh, 1.3), k = Math.min(2, 1000 / b.w);
        if (b.w > 20 && b.h > 10) {
          oBusy = true; cx.canvas.width = Math.round(b.w * k); cx.canvas.height = Math.round(b.h * k);
          cx.drawImage(video, b.x, b.y, b.w, b.h, 0, 0, cx.canvas.width, cx.canvas.height);
          const img = cx.getImageData(0, 0, cx.canvas.width, cx.canvas.height);
          W.postMessage({ type: 'line', w: img.width, h: img.height, buf: img.data.buffer }, [img.data.buffer]);
        }
      }
      if (!zBusy) {   // штрихкод: та же полоса пошире, в полном разрешении; каждый третий кадр — вертикальный
        const rot = n++ % 3 === 2;
        const b = rot ? { x: Math.round(vw * .3), y: 0, w: Math.round(vw * .4), h: vh } : slot(vw, vh, 2.4);
        const k = Math.min(1, 1400 / Math.max(b.w, b.h));
        const zc = document.createElement('canvas'); zc.width = Math.round(b.w * k); zc.height = Math.round(b.h * k);
        const zx = zc.getContext('2d', { willReadFrequently: true }); zx.drawImage(video, b.x, b.y, b.w, b.h, 0, 0, zc.width, zc.height);
        const img = zx.getImageData(0, 0, zc.width, zc.height);
        zBusy = true; W.postMessage({ type: 'frame', w: img.width, h: img.height, buf: img.data.buffer, rot }, [img.data.buffer]);
      }
    }
    raf = requestAnimationFrame(loop);
  };
  hint.textContent = T('Наведите полосу на строку VIN или штрихкод.');
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
