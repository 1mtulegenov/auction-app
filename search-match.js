/* Сохранённые поиски: проверка, подходит ли лот под критерии. Общий код для приложения и для рассылки пушей (tools/notify.mjs).
   Поиск q: {
     cars: [{ mk, md, y1, y2 }]   — несколько машин; пустой список = любая марка. md пустой = любая модель марки.
     y1, y2      — годы для всех машин (если у машины свои годы не заданы)
     o2          — пробег до, миль
     w1, w2      — MMR от / до
     prof1       — прибыль по MMR от
     auc: []     — аукционы (коды AAA, AAH, ANA, CMX, H1C, ANH); пусто = все
     clean       — только чистый тайтл без пометок аукциона о тотале/пробеге/воде
     noInop      — без неходячих
     green       — только зелёный свет
     awd         — только 4x4 / AWD
     txt         — слова в названии, комплектации или моторе
   } */
(function (root) {
  const INOP_LANES = { AAA: ['7'], AAH: ['T'], ANA: ['T'] };
  const n = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9а-яё]/g, '');
  const lane = x => String(x.run || '').split('-')[0].trim();
  const isInop = x => x.cls === 'noinop' || (INOP_LANES[x.auc] || []).includes(lane(x));
  const BAD_ANN = /salvage|rebuilt|total loss|flood|not actual|tmu|exempt|frame|structural|lemon|airbag|title absent/i;
  function carOk(x, c, q) {
    if (c.mk && n(c.mk) !== n(x.mk)) return false;
    if (c.md && n(c.md) !== n(x.md) && !n(x.md).startsWith(n(c.md))) return false;
    const y1 = +c.y1 || +q.y1 || 0, y2 = +c.y2 || +q.y2 || 0, y = +x.y || 0;
    if (y1 && y < y1) return false;
    if (y2 && y > y2) return false;
    return true;
  }
  function match(x, q) {
    if (!x || !q) return false;
    const cars = (q.cars || []).filter(c => c && (c.mk || c.md));
    if (cars.length) { if (!cars.some(c => carOk(x, c, q))) return false; }
    else if (!carOk(x, {}, q)) return false;
    if (+q.o2 && !(+x.o > 0 && +x.o <= +q.o2)) return false;
    if (+q.w1 && !(x.w != null && x.w >= +q.w1)) return false;
    if (+q.w2 && !(x.w != null && x.w <= +q.w2)) return false;
    if (q.prof1 !== '' && q.prof1 != null && !isNaN(+q.prof1) && String(q.prof1).trim() !== '' && !(x.prof != null && x.prof >= +q.prof1)) return false;
    if (q.auc && q.auc.length && !q.auc.includes(x.auc)) return false;
    if (q.clean && (x.cls !== 'clean' || x.ttlbad || x.hist || BAD_ANN.test(x.a || ''))) return false;
    if (q.noInop && isInop(x)) return false;
    if (q.green && !/green/i.test(x.l || '')) return false;
    if (q.awd && !/4x4|4wd|awd|4matic|quattro|xdrive|all/i.test([x.drv, x.tr, x.st].join(' '))) return false;
    if (q.txt) { const hay = [x.y, x.mk, x.md, x.st, x.tr, x.eng].join(' ').toLowerCase(); if (!String(q.txt).toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false; }
    return true;
  }
  // короткое описание поиска для списка и пуша
  function describe(q) {
    const p = [];
    const cars = (q.cars || []).filter(c => c && (c.mk || c.md));
    if (cars.length) p.push(cars.map(c => [c.mk, c.md].filter(Boolean).join(' ') + (c.y1 || c.y2 ? ' ' + (c.y1 || '…') + '–' + (c.y2 || '…') : '')).join(', '));
    if (q.y1 || q.y2) p.push((q.y1 || '…') + '–' + (q.y2 || '…') + ' г.');
    if (+q.o2) p.push('до ' + Math.round(q.o2 / 1000) + 'k mi');
    if (+q.w1 || +q.w2) p.push('MMR ' + (+q.w1 ? '$' + (+q.w1).toLocaleString('en-US') : '') + '–' + (+q.w2 ? '$' + (+q.w2).toLocaleString('en-US') : ''));
    if (q.prof1 !== '' && q.prof1 != null && String(q.prof1).trim() !== '') p.push('прибыль от $' + (+q.prof1).toLocaleString('en-US'));
    if (q.auc && q.auc.length) p.push(q.auc.join(', '));
    if (q.clean) p.push('чистый тайтл');
    if (q.noInop) p.push('без неходячих');
    if (q.green) p.push('зелёный свет');
    if (q.awd) p.push('4x4/AWD');
    if (q.txt) p.push('«' + q.txt + '»');
    return p.join(' · ') || 'все машины';
  }
  const api = { match, describe, isInop };
  root.SearchMatch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
