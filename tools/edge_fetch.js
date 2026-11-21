// Пре-сейл EDGE + отчёты по каждой машине. Запуск во вкладке edgepipeline.com (без await):
//   eval(await (await fetch(B+'tools/edge_fetch.js',{cache:'no-store'})).text()); __edgeFetch('houstonaa','2026/11/18'); 'started'
// Готово, когда window._done — число. Затем __edgeShow('raw'|'detail'|'ann'|'ph', i) кладёт кусок i (по 40 000 знаков)
// в <pre> между E<k><i> и ENDE; get_page_text, склеить в tools/<pfx>_<k>_<дата>.txt.
window.__edgeFetch = (slug, ymd) => { window._done = null; window._err = null; (async () => {
  const XH = { headers: { 'X-Requested-With': 'XMLHttpRequest' } }, out = [];
  for (const sl of [slug + '-all', slug]) {
    for (let p = 1; p < 12; p++) {
      const h = await (await fetch('/components/report/presale/ajax/' + sl + '/' + ymd + '?per_page=250&page=' + p, XH)).text();
      const d = new DOMParser().parseFromString(h, 'text/html'); const v = [...d.querySelectorAll('div.vehicle')];
      for (const x of v) {
        const t = x.innerText.replace(/\s+/g, ' ').trim(), H = x.outerHTML; const g = re => { const m = t.match(re); return m ? m[1].trim() : ''; };
        const run = g(/([A-Z0-9]+ ?-\d{4})\s+\w{3}, \d\d\/\d\d\/\d\d/);
        out.push([run.replace(' ', ''), g(/^(\d{4} .*?) CR:/), g(/\b([A-HJ-NPR-Z0-9]{17})\b/), g(/([A-Z ]+)\(ext\)/), g(/Odo:([\d,]+)/).replace(/,/g, ''),
          g(/Grade:([\d.]+|--)/).replace('--', ''), g(/Light\(s\): (Green|Yellow|Red|Blue|--)/).replace('--', ''), g(/MMR:\$([\d,]+)/).replace(/,/g, ''),
          g(/PMR:\$([\d,]+)/).replace(/,/g, ''), g(/Title Status:(.*?) AutoCheck/), g(/Stock #:(\S+)/), (H.match(/autolookout\.net\/(\d+\/\d+\/\d+)\//) || [])[1] || '',
          g(/CR: (Yes|No)/), g(/Consignor:(.*?) [A-Z0-9]+ ?-\d{4}/)].join('|'));
      }
      if (v.length < 250) break;
    }
    if (out.length) break;
  }
  window._all = out;
  const J = { headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' } }, det = [], ann = [], phs = [];
  const one = async s => { const q = s.split('|'), run = q[0], st = q[10], cons = q[13];
    try {
      const j = await (await fetch('/components/vehicle/vdp_api_details/' + slug + '/' + st, J)).json(); const a = j.vehicle;
      let ci = []; try { ci = (await (await fetch('/components/vehicle/vdp_api_condition_report_data/' + slug + '/' + st, J)).json()).condition_report.condition_items || []; } catch (e) {}
      phs.push(run + '|' + (a.vehicle_photos || []).map(u => { const m = String(u).match(/autolookout\.net\/(\d+\/\d+\/\d+)\/[^\/]*\/(\w+)/); return m ? m[1] + '/' + m[2] : ''; }).filter(Boolean).join(','));
      const o = a.overview || {}, dc = a.declarations || {}, sl = a.sale_listing || {};
      const bad = ci.filter(c => /Severe|Replace|Torn|Broken|Crack|Missing|Rust|Frame|Airbag|Inop|Leak|Smoke|Noise|Check Engine|Warning/i.test((c.location || '') + ' ' + (c.severity || '')))
        .map(c => (c.location || '').replace(/ - /, ': ') + (c.severity && !/^\d+$/.test(c.severity) ? ' (' + c.severity + ')' : '')).slice(0, 4);
      det.push([run, dc.drivable || '', dc.frame || '', dc.title_status || '', Math.round(+sl.floor_price || 0), Math.round(+sl.book_value || 0), o.sold_label || '', o.sold_price || '', o.pmr_average || '', ci.length, bad.join('; ')].join('|'));
      const an = a.announcements || (JSON.stringify(j).match(/"announcements":"((?:[^"\\]|\\.)*)"/) || [])[1] || '';
      ann.push(run + '|' + String(an).replace(/\s+/g, ' ').replace(/\|/g, '/') + '|' + (cons || ''));
    } catch (e) { det.push(run + '|ERR ' + e.message); }
  };
  for (let i = 0; i < out.length; i += 8) await Promise.all(out.slice(i, i + 8).map(one));
  window._dl = det; window._an = ann; window._ph = phs; window._done = out.length;
})().catch(e => { window._err = String(e); }); };
window.__edgeShow = (k, i) => { const a = { raw: window._all, detail: window._dl, ann: window._an, ph: window._ph }[k].join('\n'); const c = a.slice(i * 40000, (i + 1) * 40000);
  document.body.innerHTML = '<article><pre id=d>E' + k + i + '\n' + c + '\nENDE</pre></article>'; return Math.ceil(a.length / 40000); };
