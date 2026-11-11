/* Поиск строки VIN в кадре: выделяем буквы (светлые на тёмном или тёмные на светлом),
   находим самую длинную ровную цепочку букв одинаковой высоты, выпрямляем её и отдаём
   чистую картинку «чёрный текст на белом» для распознавания. Работает в фоновом потоке. */
(function (G) {
  function gray(px, n) { const L = new Uint8Array(n); for (let i = 0, j = 0; i < n; i++, j += 4) L[i] = (px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8; return L; }
  // интегральное изображение для среднего по окну
  function integral(L, w, h) { const I = new Float64Array((w + 1) * (h + 1)); for (let y = 0; y < h; y++) { let s = 0; const r = (y + 1) * (w + 1), p = y * (w + 1); for (let x = 0; x < w; x++) { s += L[y * w + x]; I[r + x + 1] = I[p + x + 1] + s; } } return I; }
  // бинаризация: пиксель «буква», если он ярче (bright) или темнее (dark) среднего вокруг на T
  function binar(L, I, w, h, r, T, bright) {
    const B = new Uint8Array(w * h), W1 = w + 1;
    for (let y = 0; y < h; y++) {
      const y0 = y - r < 0 ? 0 : y - r, y1 = y + r + 1 > h ? h : y + r + 1;
      for (let x = 0; x < w; x++) {
        const x0 = x - r < 0 ? 0 : x - r, x1 = x + r + 1 > w ? w : x + r + 1;
        const m = (I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0]) / ((y1 - y0) * (x1 - x0));
        const d = bright ? L[y * w + x] - m : m - L[y * w + x];
        if (d > T) B[y * w + x] = 1;
      }
    }
    return B;
  }
  // связные области (8-связность), с ограничением на размер
  function comps(B, w, h, maxN) {
    const lab = new Int32Array(w * h), st = new Int32Array(w * h), out = [];
    let id = 0;
    for (let s = 0; s < w * h; s++) {
      if (!B[s] || lab[s]) continue;
      id++; let sp = 0; st[sp++] = s; lab[s] = id;
      let x0 = w, y0 = h, x1 = 0, y1 = 0, a = 0;
      while (sp) {
        const p = st[--sp], py = (p / w) | 0, pxx = p - py * w; a++;
        if (pxx < x0) x0 = pxx; if (pxx > x1) x1 = pxx; if (py < y0) y0 = py; if (py > y1) y1 = py;
        for (let dy = -1; dy <= 1; dy++) { const yy = py + dy; if (yy < 0 || yy >= h) continue; for (let dx = -1; dx <= 1; dx++) { const xx = pxx + dx; if (xx < 0 || xx >= w) continue; const q = yy * w + xx; if (B[q] && !lab[q]) { lab[q] = id; st[sp++] = q; } } }
      }
      out.push({ id, x0, y0, x1, y1, a, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
      if (out.length > maxN) break;
    }
    return { lab, cs: out };
  }
  // слипшиеся буквы (размытие, капли): режем широкую область по провалам в столбцах
  function splitWide(cs, lab, w, H) {
    const out = [];
    for (const k of cs) {
      if (!(k.w > k.h * 1.3 && k.h >= 9 && k.h <= H * 0.8 && k.w <= k.h * 16)) { out.push(k); continue; }
      const col = new Int32Array(k.w), top = new Int32Array(k.w).fill(1e9), bot = new Int32Array(k.w).fill(-1);
      for (let y = k.y0; y <= k.y1; y++) for (let x = k.x0; x <= k.x1; x++) if (lab[y * w + x] === k.id) { const i = x - k.x0; col[i]++; if (y < top[i]) top[i] = y; if (y > bot[i]) bot[i] = y; }
      const cw = k.h * 0.66, nC = Math.max(2, Math.round(k.w / cw)), step = k.w / nC, cuts = [0];
      for (let c = 1; c < nC; c++) { const c0 = Math.round(c * step - step * 0.35), c1 = Math.round(c * step + step * 0.35); let bi = Math.round(c * step), bv = 1e9; for (let i = Math.max(1, c0); i <= Math.min(k.w - 2, c1); i++) if (col[i] < bv) { bv = col[i]; bi = i; } cuts.push(bi); }
      cuts.push(k.w);
      for (let c = 0; c + 1 < cuts.length; c++) {
        let y0 = 1e9, y1 = -1, a = 0; for (let i = cuts[c]; i < cuts[c + 1]; i++) { if (col[i]) { a += col[i]; if (top[i] < y0) y0 = top[i]; if (bot[i] > y1) y1 = bot[i]; } }
        if (y1 < 0) continue;
        const x0 = k.x0 + cuts[c], x1 = k.x0 + cuts[c + 1] - 1;
        out.push({ id: k.id, x0, y0, x1, y1, a, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, split: 1 });
      }
    }
    return out;
  }
  // самая длинная цепочка букв на одной прямой
  function withFragments(line, cs) {
    const x0 = Math.min(...line.cs.map(k => k.x0)) - line.h * 0.3, x1 = Math.max(...line.cs.map(k => k.x1)) + line.h * 0.3, have = new Set(line.cs.map(k => k.id)), extra = [];
    for (const k of cs) {
      if (have.has(k.id) || k.a < 4 || k.h > line.h * 1.25 || k.w > line.h * 1.5) continue;
      if (k.cx < x0 || k.cx > x1) continue;
      const yl = line.ay + line.sl * (k.cx - line.ax);
      if (k.y0 >= yl - line.h * 0.62 && k.y1 <= yl + line.h * 0.62) extra.push(k);
    }
    return Object.assign({}, line, { all: line.cs.concat(extra) });
  }
  function bestLine(cs, H) {
    const c = cs.filter(k => k.h >= H * 0.06 && k.h <= H * 0.8 && k.w <= k.h * 1.3 && k.w >= 1 && k.a >= k.w * k.h * 0.12 && k.h >= 9);
    if (c.length < 8) return null;
    c.sort((a, b) => a.cx - b.cx);
    const cands = [];
    const n = c.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const A = c[i], Bq = c[j], dx = Bq.cx - A.cx;
      if (dx < A.h * 2) continue;
      if (Math.abs(A.h - Bq.h) > 0.3 * Math.max(A.h, Bq.h)) continue;
      const sl = (Bq.cy - A.cy) / dx; if (Math.abs(sl) > 0.25) continue;
      const hh = (A.h + Bq.h) / 2; let cnt = 0, inl = [];
      for (let k = 0; k < n; k++) { const C = c[k]; if (Math.abs(C.h - hh) > 0.3 * hh) continue; const yl = A.cy + sl * (C.cx - A.cx); if (Math.abs(C.cy - yl) < 0.3 * hh) { cnt++; inl.push(C); } }
      // буквы VIN идут плотно: выкидываем хвосты с большими разрывами
      if (cnt < 8) continue;
      const run = densest(inl, hh);
      // штрихкод под VIN: тонкие палочки одной высоты тоже выстраиваются в «строку»; у букв средняя ширина ≥ 0.35 высоты
      const asp = run.map(k => k.w / k.h).sort((a, b) => a - b);
      if (asp[asp.length >> 1] < 0.35) continue;
      const sc = scoreRun(run.length);
      const myr = run.reduce((t, k) => t + k.cy, 0) / run.length;
      if (run.length >= 8) cands.push({ cs: run, h: hh, sl, ax: A.cx, ay: A.cy, score: sc - Math.abs(myr - H / 2) / H * 30, my: run.reduce((t, k) => t + k.cy, 0) / run.length, mx: run.reduce((t, k) => t + k.cx, 0) / run.length });
    }
    cands.sort((a, b) => b.score - a.score);
    const pick = [];
    for (const L of cands) { if (pick.every(P => Math.abs(P.my - L.my) > 0.8 * Math.min(P.h, L.h) || Math.abs(P.mx - L.mx) > 6 * L.h)) pick.push(L); if (pick.length >= 4) break; }
    return pick;
  }
  function scoreRun(k) { return k >= 15 && k <= 19 ? 100 + k : k > 19 ? 60 - (k - 19) : k; }
  function densest(inl, hh) {
    inl.sort((a, b) => a.cx - b.cx);
    let bestR = [], cur = [inl[0]];
    for (let i = 1; i < inl.length; i++) { if (inl[i].x0 - inl[i - 1].x1 > hh * 2.2) { if (scoreRun(cur.length) > scoreRun(bestR.length)) bestR = cur; cur = []; } cur.push(inl[i]); }
    if (scoreRun(cur.length) > scoreRun(bestR.length)) bestR = cur;
    return bestR;
  }
  // чистая выпрямленная строка: только пиксели найденных букв, высота букв ~th пикселей
  function render(line, lab, w, h, th, G, bright, band, GT) {
    let g0 = 0, gk = 1;
    if (G) { // растяжка контраста: средняя яркость букв → 0, фона вокруг → 255
      let si = 0, ni = 0, so = 0, no = 0; const lx0 = Math.min(...line.cs.map(k => k.x0)), lx1 = Math.max(...line.cs.map(k => k.x1));
      const idz = new Set(line.cs.map(k => k.id));
      for (const k of line.cs) for (let y = k.y0; y <= k.y1; y++) for (let x = k.x0; x <= k.x1; x++) { const v = G[y * w + x]; if (idz.has(lab[y * w + x])) { si += v; ni++; } else { so += v; no++; } }
      const fi = si / Math.max(1, ni), fo = so / Math.max(1, no); g0 = fi; gk = 255 / ((fo - fi) || 1);
      if (bright) { g0 = fo; gk = 255 / ((fi - fo) || 1); }
    }
    const ids = new Set((line.all || line.cs).map(k => k.id));
    const x0 = Math.min(...line.cs.map(k => k.x0)), x1 = Math.max(...line.cs.map(k => k.x1));
    const ang = Math.atan(line.sl), ca = Math.cos(ang), sa = Math.sin(ang);
    const s = th / line.h, pad = Math.round(th * 0.6);
    const A0 = line.cs[0], yRef = A0.cy - line.sl * A0.cx;   // y линии при x=0
    const OW = Math.round((x1 - x0 + 1) * s / ca) + pad * 2, OH = Math.round(th * 1.6) + pad * 2;
    const out = new Uint8ClampedArray(OW * OH * 4).fill(255), lim2 = (line.h * (band || 0.75)) ** 2, bx = line.h * 0.4;
    // обратное отображение: для каждого пикселя результата ищем исходный
    for (let oy = 0; oy < OH; oy++) for (let ox = 0; ox < OW; ox++) {
      const u = (ox - pad) / s, v = (oy - OH / 2) / s;   // u вдоль строки от x0, v поперёк
      const sx = x0 + u * ca - v * sa, sy = yRef + line.sl * x0 + u * sa + v * ca;
      const ix = Math.round(sx), iy = Math.round(sy);
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) continue;
      if (G) { if (v * v > lim2 || u < -bx || u > x1 - x0 + bx) continue; const j = (oy * OW + ox) * 4; let gv = (G[iy * w + ix] - g0) * gk; if (bright) gv = 255 - gv;  out[j] = out[j + 1] = out[j + 2] = gv; }
      else if (ids.has(lab[iy * w + ix])) { const j = (oy * OW + ox) * 4; out[j] = out[j + 1] = out[j + 2] = 0; }
    }
    if (G) { // свет по наклейке неровный: растягиваем контраст по столбцам (окно ~ширина буквы)
      const lo = new Float32Array(OW).fill(255), hi = new Float32Array(OW), R = Math.round(th * 0.8);
      for (let x = 0; x < OW; x++) for (let y = 0; y < OH; y++) { const v = out[(y * OW + x) * 4]; if (v < lo[x]) lo[x] = v; if (v > hi[x]) hi[x] = v; }
      const L2 = new Float32Array(OW), H2 = new Float32Array(OW);
      for (let x = 0; x < OW; x++) { let a = 255, b = 0; for (let i = Math.max(0, x - R); i <= Math.min(OW - 1, x + R); i++) { if (lo[i] < a) a = lo[i]; if (hi[i] > b) b = hi[i]; } L2[x] = a; H2[x] = b; }
      for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) { const j = (y * OW + x) * 4, d = H2[x] - L2[x]; if (d < 30) continue; const v = (out[j] - L2[x]) * 255 / d; out[j] = out[j + 1] = out[j + 2] = GT ? (v < GT ? 0 : 255) : v; }
    }
    return { w: OW, h: OH, data: out, n: line.cs.length };
  }
  // главный вход: RGBA кадр → до двух вариантов строки (светлый и тёмный текст)
  function findVinLines(px, w, h, opt) {
    opt = opt || {};
    const L = gray(px, w * h), I = integral(L, w, h), out = [];
    for (const bright of opt.pol || [true, false]) {
      for (const [rf, T] of opt.RT || [[0.06, 14], [0.12, 22]]) {
        const r = Math.max(5, Math.round(h * rf));
        const B = binar(L, I, w, h, r, T, bright);
        const C = comps(B, w, h, 4000), lab = C.lab, cs = splitWide(C.cs, lab, w, h);
        if (opt.debug) { const H = h; opt.debug.push({ T, rf, bright, n: cs.length, cand: cs.filter(k => k.h >= H * 0.06 && k.h <= H * 0.8 && k.w <= k.h * 1.3 && k.a >= k.w * k.h * 0.12 && k.h >= 9).map(k => [k.x0, k.y0, k.w, k.h]).slice(0, 60) }); }
        for (let line of bestLine(cs, h) || []) {
          if (line.cs.length < 10) continue;
          if (out.some(o => o.bright === bright && Math.abs(o.my - line.my) < 0.8 * line.h && Math.abs(o.mx - line.mx) < 6 * line.h)) continue;
          line = withFragments(line, cs);
          const g = render(line, lab, w, h, opt.th || 34, L, bright, opt.band, opt.gt);
          out.push(Object.assign(render(line, lab, w, h, opt.th || 34), { gw: g.w, gh: g.h, gdata: g.data, bright, T, score: line.score, my: line.my, mx: line.mx }));
        }
      }
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }
  G.findVinLines = findVinLines;
})(typeof self !== 'undefined' ? self : this);
