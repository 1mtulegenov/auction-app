/* Ретейл-цены в Хьюстоне с cars.com. Выполняется во вкладке www.cars.com (Claude in Chrome, javascript_tool).
   Вход: window.__rtGroups = [[key, make, model, year], ...]  (key = "год|марка|модель" как в data/<дата>.json)
   Выход: window.__rtOut — строки key|n|med|p25|p75|медиана_миль|наклон_$/1000миль|id,id,...
   Читать кусками: __rtShow(i) кладёт i-й кусок (40 000 знаков) в <pre id=d> для get_page_text.
   Радиус 50 миль от центра Хьюстона (ZIP 77002), только подержанные. Рекламные объявления других годов и моделей отбрасываются. */
(() => {
  const n = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const mkSlug = mk => ({ 'mercedes-benz': 'mercedes_benz', mercedes: 'mercedes_benz', 'land rover': 'land_rover', 'alfa romeo': 'alfa_romeo' })[String(mk).toLowerCase()] || String(mk).toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const slugCache = {};
  async function slugs(make) {
    if (slugCache[make]) return slugCache[make];
    const h = await (await fetch('/shopping/results/?makes[]=' + make + '&stock_type=used&zip=77002&maximum_distance=50')).text();
    return (slugCache[make] = [...new Set((h.match(new RegExp(make + '-[a-z0-9_]+', 'g')) || []))]);
  }
  // BMW «3-Series» → все 3xx модели; Mercedes «C300» → c_class, «E63 AMG» → amg_e_63
  function special(list, make, md) {
    let m = make === 'bmw' && /^(\d)[- ]?series$/i.exec(md);
    if (m) { const r = list.filter(s => new RegExp('^bmw-' + m[1] + '\\d\\de?$').test(s)); return r.length ? r : null; }
    m = make === 'mercedes_benz' && /^([a-z]{1,3})\s?(\d{2,3})(\s?amg)?/i.exec(md);
    if (m) { const L = m[1].toLowerCase(), want = m[3] ? 'mercedes_benz-amg_' + L + '_' + m[2] : 'mercedes_benz-' + (L === 'ml' ? 'm' : L) + '_class'; return list.includes(want) ? [want] : null; }
    return null;
  }
  function pick(list, make, md) {
    const want = n(md).replace(/sd$|vans$|ds$/, ''), rows = list.map(s => [s, n(s.slice(make.length + 1))]);
    let r = rows.find(([, k]) => k === want); if (r) return r[0];
    r = rows.filter(([, k]) => want.startsWith(k) && k.length >= 2).sort((a, b) => b[1].length - a[1].length)[0]; if (r) return r[0];
    r = rows.filter(([, k]) => k.startsWith(want)).sort((a, b) => a[1].length - b[1].length)[0]; return r ? r[0] : null;
  }
  const q = (a, p) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y), i = (b.length - 1) * p, lo = Math.floor(i); return Math.round(b[lo] + (b[Math.ceil(i)] - b[lo]) * (i - lo)); };
  async function one([key, mk, md, y]) {
    const make = mkSlug(mk), list = await slugs(make), sp = special(list, make, md), one1 = sp ? null : pick(list, make, md), models = sp || (one1 ? [one1] : null);
    if (!models) return key + '|0|||||nomodel|';
    const tails = models.map(s => n(s.slice(make.length + 1)));
    const h = await (await fetch('/shopping/results/?makes[]=' + make + models.map(s => '&models[]=' + s).join('') + '&year_min=' + y + '&year_max=' + y + '&stock_type=used&zip=77002&maximum_distance=50&page_size=100')).text();
    const d = new DOMParser().parseFromString(h, 'text/html'), seen = new Map();
    d.querySelectorAll('[data-vehicle-details]').forEach(e => { try { const j = JSON.parse(e.getAttribute('data-vehicle-details')); const p = +j.price, m = +j.mileage; if (p > 500 && j.stockType !== 'New' && j.listingId && +j.year === +y && n(j.model).replace(/[^a-z0-9]/g, '') && !seen.has(j.listingId) && tails.some(t => n(j.model) === t || n(j.model).startsWith(t) || t.startsWith(n(j.model)) || (t.startsWith('amg') && n(j.model).replace(/^amg/, '').startsWith(t.slice(3))) || (t.endsWith('class') && n(j.model).startsWith(t.slice(0, -5)) && /^\d/.test(n(j.model).slice(t.length - 5))))) seen.set(j.listingId, [p, m]); } catch (x) {} });
    const v = [...seen.values()], P = v.map(a => a[0]), Mi = v.filter(a => a[1] > 0);
    let slope = '';
    if (Mi.length >= 5) { const mx = Mi.reduce((s, a) => s + a[1], 0) / Mi.length, my = Mi.reduce((s, a) => s + a[0], 0) / Mi.length; let sxy = 0, sxx = 0; Mi.forEach(([p, m]) => { sxy += (m - mx) * (p - my); sxx += (m - mx) ** 2; }); if (sxx) slope = Math.round(sxy / sxx * 1000); }
    const ids = [...seen.keys()].map(s => String(s).replace(/-/g, '').slice(-8)).join(',');
    return [key, v.length, q(P, .5) ?? '', q(P, .25) ?? '', q(P, .75) ?? '', q(Mi.map(a => a[1]), .5) ?? '', slope, ids].join('|');
  }
  window.__rtRun = async (groups, par = 4) => {
    const out = new Array(groups.length); let i = 0;
    await Promise.all(Array.from({ length: par }, async () => { while (i < groups.length) { const k = i++; try { out[k] = await one(groups[k]); } catch (e) { out[k] = groups[k][0] + '|0||||||err'; } await new Promise(r => setTimeout(r, 250)); } }));
    window.__rtOut = out.join('\n');
    return out.length + ' groups, ' + window.__rtOut.length + ' chars, chunks: ' + Math.ceil(window.__rtOut.length / 40000);
  };
  window.__rtShow = i => { document.body.innerHTML = '<article><pre id=d>RT' + i + '\n' + window.__rtOut.slice(i * 40000, (i + 1) * 40000) + '\nENDRT</pre></article>'; return 'ok'; };
})();
