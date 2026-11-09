/* Фоновый поток сканера: штрихкод (ZXing) и сверка прочитанного текста с VIN из каталогов. Главный поток не тормозит. */
importScripts('vendor/zxing.min.js');
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
function matchText(text) {
  const cs = candidates(text);
  for (const c of cs) if (IDX[c.v]) return { vin: c.v, exact: true };
  for (const c of cs) { const n = near(c.v); if (n) return { vin: n.vin, read: c.v, d: n.d }; }
  for (const c of cs) if (c.t !== 'win' && checkOk(c.v)) return { vin: c.v, unknown: true };
  const raw = String(text || '').replace(/[^A-Z0-9\n]/gi, '').split('\n').sort((a, b) => b.length - a.length)[0];
  return raw && raw.length >= 10 ? { raw } : null;
}
onmessage = e => {
  const m = e.data;
  if (m.type === 'idx') { IDX = m.idx || {}; KEYS = Object.keys(IDX); return; }
  if (m.type === 'text') { postMessage({ type: 'ocr', res: matchText(m.text) }); return; }
  if (m.type === 'frame') {
    const px = new Uint8ClampedArray(m.buf), w = m.w, h = m.h, n = w * h;
    let lum = new Uint8ClampedArray(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) lum[i] = (px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8;
    let W = w, H = h;
    if (m.rot) { const r = new Uint8ClampedArray(n); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) r[x * h + (h - 1 - y)] = lum[y * w + x]; lum = r; W = h; H = w; }
    const txt = decode(lum, W, H);
    const vin = txt ? cleanVin(txt) : '';
    postMessage({ type: 'code', vin: vin || null, known: !!(vin && IDX[vin]) });
  }
};
postMessage({ type: 'ready' });
