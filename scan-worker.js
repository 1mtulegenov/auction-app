/* Фоновый поток сканера: штрихкод (ZXing) и сверка прочитанного текста с VIN из каталогов. Главный поток не тормозит. */
importScripts('vendor/zxing.min.js', 'vinline.js');
const Z = self.ZXing, hints = new Map();
hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.DATA_MATRIX, Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.PDF_417]);
hints.set(Z.DecodeHintType.TRY_HARDER, true);
const reader = new Z.MultiFormatReader(); reader.setHints(hints);
let IDX = {}, KEYS = [];
const VIN_RE = /[A-HJ-NPR-Z0-9]{17}/;
const VW = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
function checkOk(v) { const w = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < 17; i++) { const c = v[i]; s += (c >= '0' && c <= '9' ? +c : VW[c] || 0) * w[i]; } const r = s % 11; return v[8] === (r === 10 ? 'X' : String(r)); }
function cleanVin(t) { const s = String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); const m = s.match(VIN_RE); return m ? m[0] : ''; }
function decode(lum, w, h) {
  try { return reader.decodeWithState(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(lum, w, h)))).getText(); }
  catch (e) { return null; } finally { reader.reset(); }
}
// DataMatrix на лобовом стекле (GM и др.): маленький квадрат светлых точек на тёмном стекле рядом с VIN.
// Общий проход ZXing его не видит: ищем квадратные пятна с резкими перепадами яркости, вырезаем,
// увеличиваем, бинаризуем по Отсу и пробуем обе полярности с белым полем вокруг.
const dmReader = new Z.DataMatrixReader();
function otsu(a) { const hist = new Array(256).fill(0); for (let i = 0; i < a.length; i++) hist[a[i]]++; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = -1, th = 128; for (let i = 0; i < 256; i++) { wB += hist[i]; if (!wB) continue; const wF = a.length - wB; if (!wF) break; sB += i * hist[i]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; th = i; } } return th; }
function dmSpots(lum, w, h) {
  const B = Math.max(4, Math.round(Math.min(w, h) / 90)), bw = Math.floor(w / B), bh = Math.floor(h / B), busy = new Uint8Array(bw * bh);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) { let lo = 255, hi = 0;
    for (let y = by * B; y < by * B + B; y++) for (let x = bx * B, i = y * w + x; x < bx * B + B; x++, i++) { const v = lum[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    busy[by * bw + bx] = hi - lo > 55 ? 1 : 0; }
  const seen = new Uint8Array(bw * bh), out = [];
  for (let s = 0; s < busy.length; s++) { if (!busy[s] || seen[s]) continue;
    const st = [s]; seen[s] = 1; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, cnt = 0;
    while (st.length) { const c = st.pop(), cx = c % bw, cy = (c - cx) / bw; cnt++; if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue; const nn = ny * bw + nx; if (busy[nn] && !seen[nn]) { seen[nn] = 1; st.push(nn); } } }
    const W = x1 - x0 + 1, H = y1 - y0 + 1, ar = W / H;
    if (W >= 4 && H >= 4 && W * B <= .7 * h + .3 * w && ar > .6 && ar < 1.65 && cnt / (W * H) > .55) out.push({ x: x0 * B, y: y0 * B, w: W * B, h: H * B, a: cnt }); }
  return out.sort((p, q) => q.a - p.a).slice(0, 4);
}

// размытый или повёрнутый снимок: ZXing не находит углы сам. Берём самое большое связное пятно цвета модулей
// (рамка L + данные), его углы: левый верхний, левый нижний, правый нижний; правый верхний достраиваем
// параллелограммом. Накладываем сетку N×N (стандартные размеры DataMatrix), читаем центр каждого модуля
// и отдаём ZXing чистую картинку. Ответ принимаем, только если в нём VIN с верной контрольной цифрой.
const DM_N = [10, 12, 14, 16, 18, 20, 22, 24, 26, 32, 36, 40, 44];
function dmGrid(g, W, H, th) {
  const pd = new Map(); pd.set(Z.DecodeHintType.PURE_BARCODE, true);
  for (const fg of [1, 0]) {
    const bin = new Uint8Array(W * H); for (let i = 0; i < bin.length; i++) bin[i] = (g[i] > th ? 1 : 0) === fg ? 1 : 0;
    // самое большое пятно
    const lab = new Int32Array(W * H); let best = 0, bestN = 0, id = 0;
    for (let s = 0; s < bin.length; s++) { if (!bin[s] || lab[s]) continue; id++; let n = 0; const st = [s]; lab[s] = id;
      while (st.length) { const c = st.pop(); n++; const x = c % W; if (x > 0 && bin[c - 1] && !lab[c - 1]) { lab[c - 1] = id; st.push(c - 1); } if (x < W - 1 && bin[c + 1] && !lab[c + 1]) { lab[c + 1] = id; st.push(c + 1); }
        if (c >= W && bin[c - W] && !lab[c - W]) { lab[c - W] = id; st.push(c - W); } if (c < bin.length - W && bin[c + W] && !lab[c + W]) { lab[c + W] = id; st.push(c + W); } }
      if (n > bestN) { bestN = n; best = id; } }
    if (bestN < W * H * .08) continue;
    let tl = [0, 0, 1e9], br = [0, 0, -1e9], bl = [0, 0, 1e9];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (lab[y * W + x] !== best) continue;
      if (x + y < tl[2]) tl = [x, y, x + y]; if (x + y > br[2]) br = [x, y, x + y]; if (x - y < bl[2]) bl = [x, y, x - y]; }
    const TL = [tl[0], tl[1]], BR = [br[0] + 1, br[1] + 1], BL = [bl[0], bl[1] + 1], TR = [TL[0] + BR[0] - BL[0], TL[1] + BR[1] - BL[1]];
    const at = (u, v) => [TL[0] + u * (TR[0] - TL[0]) + v * (BL[0] - TL[0]), TL[1] + u * (TR[1] - TL[1]) + v * (BL[1] - TL[1])];
    for (const N of DM_N) {
      const mod = Math.hypot(BR[0] - BL[0], BR[1] - BL[1]) / N; if (mod < 2.5) break;
      const S = 8, Q = 2 * S, side = N * S + 2 * Q, out = new Uint8ClampedArray(side * side).fill(255);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const [px, py] = at((i + .5) / N, (j + .5) / N); let s = 0, c = 0; const r = Math.max(1, Math.round(mod * .2));
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const yy = Math.round(py) + dy, xx = Math.round(px) + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) { s += bin[yy * W + xx]; c++; } }
        if (s * 2 <= c) continue;   // модуль цвета рамки = «чёрный» модуль кода
        for (let yy = 0; yy < S; yy++) out.fill(0, (Q + j * S + yy) * side + Q + i * S, (Q + j * S + yy) * side + Q + i * S + S);
      }
      try { return dmReader.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.RGBLuminanceSource(out, side, side))), pd).getText(); } catch (e) {}
    }
  }
  return null;
}
function dmDecode(lum, w, h) {
  for (const s of dmSpots(lum, w, h)) for (const mf of [.15, .3]) {
    const m = Math.round(Math.max(s.w, s.h) * mf), x0 = Math.max(0, s.x - m), y0 = Math.max(0, s.y - m), x1 = Math.min(w, s.x + s.w + m), y1 = Math.min(h, s.y + s.h + m);
    const cw = x1 - x0, ch = y1 - y0; if (cw < 8 || ch < 8) continue;
    const k = Math.max(1, 420 / Math.max(cw, ch)), W = Math.round(cw * k), H = Math.round(ch * k);
    const g = new Uint8ClampedArray(W * H);   // увеличение с билинейной интерполяцией
    for (let y = 0; y < H; y++) { const fy = y / k + y0, iy = Math.min(h - 2, Math.floor(fy)), ty = fy - iy;
      for (let x = 0; x < W; x++) { const fx = x / k + x0, ix = Math.min(w - 2, Math.floor(fx)), tx = fx - ix, i = iy * w + ix;
        g[y * W + x] = (lum[i] * (1 - tx) + lum[i + 1] * tx) * (1 - ty) + (lum[i + w] * (1 - tx) + lum[i + w + 1] * tx) * ty; } }
    const t0 = otsu(g);
    for (const th of [t0, t0 + 20, t0 - 20]) { const r = dmGrid(g, W, H, th); if (r) return r; }
  }
  return null;
}

function candidates(text) {
  const out = [], seen = new Set(), add = (v, t) => { if (!seen.has(v)) { seen.add(v); out.push({ v, t }); } };
  String(text || '').toUpperCase().split(/\n/).forEach(line => {
    const t = line.replace(/[^A-Z0-9]/g, '').replace(/O|Q/g, '0').replace(/I/g, '1');
    if (t.length === 17) add(t, 'line');
    if (t.length === 18 || t.length === 19) for (let i = 0; i < t.length; i++) { const d = t.slice(0, i) + t.slice(i + 1); if (d.length === 17) add(d, 'del'); else for (let j = 0; j < d.length; j++) add(d.slice(0, j) + d.slice(j + 1), 'del'); }
    for (let i = 0; i + 17 <= t.length; i++) add(t.slice(i, i + 17), 'win');
  });
  return out;
}
function near(v) {
  let best = null, bd = 9, tie = false;
  for (let n = 0; n < KEYS.length; n++) { const k = KEYS[n]; let d = 0; for (let i = 0; i < 17 && d <= 2; i++) if (k.charCodeAt(i) !== v.charCodeAt(i)) d++; if (d < bd) { bd = d; best = k; tie = false; } else if (d === bd && k !== best) tie = true; }
  return bd <= 2 && !tie ? { vin: best, d: bd } : null;
}
// расстояние Левенштейна с отсечкой: сколько букв надо поправить, вставить или убрать
// буквы, которые OCR часто путает: замена между ними стоит полшага
const CONF = new Set(['T7', '7T', 'Z2', '2Z', 'S5', '5S', 'B8', '8B', 'G6', '6G', 'D0', '0D', '1L', 'L1', '1T', 'T1', 'U0', '0U', 'V4', 'A4', '4A', 'M8', 'N4', 'J3', '3J', 'E3', 'Y7', '17', '71']);
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = new Array(b.length + 1), cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i; let lo = cur[0];
    for (let j = 1; j <= b.length; j++) { const x = a[i - 1], y = b[j - 1], c = x === y ? 0 : CONF.has(x + y) ? 0.5 : 1; cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c); if (cur[j] < lo) lo = cur[j]; }
    if (lo > max) return max + 1;
    const t = prev; prev = cur; cur = t;
  }
  return prev[b.length];
}
// строка, прочитанная с ошибками (лишняя или пропущенная буква): ищем ближайший VIN из каталогов
function nearLev(t) {
  if (t.length < 14 || t.length > 20 || !KEYS.length) return null;
  const max = t.length >= 15 ? 3.5 : 3;
  let best = null, bd = max + 1, tie = false;
  for (let n = 0; n < KEYS.length; n++) { const d = lev(t, KEYS[n], bd); if (d < bd) { bd = d; best = KEYS[n]; tie = false; } else if (d === bd && KEYS[n] !== best) tie = true; }
  return best && !tie && bd <= max ? { vin: best, d: bd } : null;
}
function matchText(text) {
  const cs = candidates(text);
  for (const c of cs) if (IDX[c.v]) return { vin: c.v, exact: true };
  for (const c of cs) { const n = near(c.v); if (n) return { vin: n.vin, read: c.v, d: n.d }; }
  for (const line of String(text || '').toUpperCase().split(/\n/)) { const t = line.replace(/[^A-Z0-9]/g, '').replace(/O|Q/g, '0').replace(/I/g, '1'); const n = nearLev(t); if (n) return { vin: n.vin, read: t, d: n.d }; }
  // VIN не из каталогов: только с верной контрольной цифрой и цифрами в конце (у всех VIN последние знаки — цифры)
  for (const c of cs) if (c.t !== 'win' && checkOk(c.v) && /\d{4}$/.test(c.v) && /^[1-9A-HJ-NPR-Z]/.test(c.v)) return { vin: c.v, unknown: true };
  const raw = String(text || '').replace(/[^A-Z0-9\n]/gi, '').split('\n').sort((a, b) => b.length - a.length)[0];
  return raw && raw.length >= 10 ? { raw } : null;
}
let lineN = 0;
onmessage = e => {
  const m = e.data;
  if (m.type === 'idx') { IDX = m.idx || {}; KEYS = Object.keys(IDX); return; }
  if (m.type === 'line') {   // кадр полосы → чистые строки текста для распознавания
    const t0 = Date.now();
    // каждая найденная строка в двух видах: чистые контуры букв и выпрямленная серая картинка
    // (серая спасает буквы, у которых край слился с рамкой наклейки или бликом)
    const lines = [];
    // размер букв для распознавания меняем от кадра к кадру: где OCR ошибся на одном, другой обычно читает
    const th = [34, 28, 42][lineN++ % 3];
    for (const l of findVinLines(new Uint8ClampedArray(m.buf), m.w, m.h, { th }).slice(0, 2)) lines.push({ w: l.w, h: l.h, buf: l.data.buffer }, { w: l.gw, h: l.gh, buf: l.gdata.buffer });
    lines.length = Math.min(lines.length, 3);
    postMessage({ type: 'lines', ms: Date.now() - t0, lines }, lines.map(l => l.buf));
    return;
  }
  if (m.type === 'text') { postMessage({ type: 'ocr', res: matchText(m.text) }); return; }
  if (m.type === 'frame') {
    const px = new Uint8ClampedArray(m.buf), w = m.w, h = m.h, n = w * h;
    let lum = new Uint8ClampedArray(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) lum[i] = (px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8;
    let W = w, H = h;
    if (m.rot) { const r = new Uint8ClampedArray(n); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) r[x * h + (h - 1 - y)] = lum[y * w + x]; lum = r; W = h; H = w; }
    let txt = decode(lum, W, H), vin = txt ? cleanVin(txt) : '';
    if (!vin && !m.rot) { const t2 = dmDecode(lum, W, H), v2 = t2 ? cleanVin(t2) : ''; if (v2 && (checkOk(v2) || IDX[v2])) vin = v2; }
    postMessage({ type: 'code', vin: vin || null, known: !!(vin && IDX[vin]) });
  }
};
postMessage({ type: 'ready' });
