// Разбор записи двигателя CarMax прямо в браузере (вкладка carmaxauctions.com).
// __eaRun(stocks, skipSec) -> window.__eaOut: строки stock|dur|rms|fire|reg|jit|kurt|kmax|hf|cent
//  fire  — частота вспышек по огибающей, Гц (холостой: 4 цил ~23, 6 цил ~35, 8 цил ~47)
//  reg   — сила периодичности огибающей 0..1 (ровный холостой — высокая)
//  jit   — разброс частоты вспышек между окнами 1 с, % (плавающие обороты, пропуски)
//  kurt  — медианный эксцесс верхних частот в окнах 50 мс (стук/тиканье — высокий)
//  kmax  — 90-й перцентиль того же
//  hf    — доля энергии выше 2 кГц, %;  cent — спектральный центроид, Гц
(() => {
  const SR = 16000;
  async function audioUrl(stock) {
    const j = await (await fetch('/api/media/subject/' + stock)).json();
    const a = (j.items || []).find(x => x.type === 'audio');
    return a ? a.fullSizeUrl : null;
  }
  // автокорреляция огибающей без медленного тренда; берём самый высокий локальный пик в диапазоне
  function autocorr(x, lo, hi) {
    const n = x.length, H = 25, pre = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + x[i];
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) { const a = Math.max(0, i - H), b = Math.min(n, i + H + 1); y[i] = x[i] - (pre[b] - pre[a]) / (b - a); }
    let e = 0; for (const v of y) e += v * v; if (!e) return [0, 0];
    const r = new Float64Array(hi + 2);
    for (let L = 1; L <= hi + 1; L++) { let s = 0; for (let i = 0; i + L < n; i++) s += y[i] * y[i + L]; r[L] = s / e; }
    let best = 0, bl = 0;
    for (let L = Math.max(2, lo); L <= hi; L++) if (r[L] > r[L - 1] && r[L] >= r[L + 1] && r[L] > best) { best = r[L]; bl = L; }
    return [bl, best];
  }
  function features(sig, skip) {
    const x = sig.subarray(Math.min(sig.length - SR * 2, Math.round(skip * SR)));
    const dur = x.length / SR;
    let rms = 0; for (const v of x) rms += v * v; rms = Math.sqrt(rms / x.length);
    // огибающая 2 мс
    const F = 32, env = []; for (let i = 0; i + F <= x.length; i += F) { let s = 0; for (let k = 0; k < F; k++) s += Math.abs(x[i + k]); env.push(s / F); }
    const ER = SR / F; // 500 Гц
    const lo = Math.round(ER / 70), hi = Math.round(ER / 15);
    const [L, reg] = autocorr(env, lo, hi);
    const fire = L ? ER / L : 0;
    const fr = []; for (let i = 0; i + ER <= env.length; i += ER) { const [l2, r2] = autocorr(env.slice(i, i + ER), lo, hi); if (l2 && r2 > 0.2) fr.push(ER / l2); }
    const fm = fr.reduce((a, b) => a + b, 0) / (fr.length || 1);
    const jit = fr.length > 2 ? Math.sqrt(fr.reduce((a, b) => a + (b - fm) ** 2, 0) / fr.length) / fm * 100 : -1;
    // верхние частоты: разность, эксцесс в окнах 50 мс
    const W = SR / 20, ks = [];
    for (let i = 1; i + W < x.length; i += W) { let m2 = 0, m4 = 0; for (let k = 0; k < W; k++) { const d = x[i + k] - x[i + k - 1]; m2 += d * d; m4 += d ** 4; } m2 /= W; m4 /= W; if (m2 > 0) ks.push(m4 / (m2 * m2)); }
    ks.sort((a, b) => a - b);
    const kurt = ks[ks.length >> 1] || 0, kmax = ks[Math.floor(ks.length * 0.9)] || 0;
    // спектр: средний по кадрам 1024 (DFT через простой FFT)
    const N = 1024, spec = new Float64Array(N / 2);
    const re = new Float64Array(N), im = new Float64Array(N);
    let frames = 0;
    for (let i = 0; i + N <= x.length && frames < 200; i += N * 2, frames++) {
      for (let k = 0; k < N; k++) { re[k] = x[i + k] * (0.5 - 0.5 * Math.cos(2 * Math.PI * k / N)); im[k] = 0; }
      fft(re, im); for (let k = 0; k < N / 2; k++) spec[k] += re[k] * re[k] + im[k] * im[k];
    }
    let tot = 0, hfE = 0, cs = 0; for (let k = 1; k < N / 2; k++) { const f = k * SR / N; tot += spec[k]; cs += spec[k] * f; if (f > 2000) hfE += spec[k]; }
    return [dur.toFixed(0), (rms * 1000).toFixed(1), fire.toFixed(1), reg.toFixed(2), jit.toFixed(1), kurt.toFixed(1), kmax.toFixed(1), (hfE / tot * 100).toFixed(1), (cs / tot).toFixed(0)];
  }
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) {
      const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
    }
  }
  async function one(stock, skip) {
    try {
      const u = await audioUrl(stock); if (!u) return stock + '|none';
      const buf = await (await fetch(u)).arrayBuffer();
      const ctx = new OfflineAudioContext(1, 1, SR);
      const ab = await ctx.decodeAudioData(buf);
      const sig = ab.getChannelData(0);
      if (sig.length < SR * (skip + 2)) return stock + '|short|' + (sig.length / SR).toFixed(0);
      return stock + '|' + features(sig, skip).join('|');
    } catch (e) { return stock + '|err|' + String(e).slice(0, 60); }
  }
  window.__eaRun = async (stocks, skip = 10, conc = 4) => {
    window.__eaOut = null; const out = new Array(stocks.length); let i = 0; window.__eaDone = 0;
    await Promise.all(Array.from({ length: conc }, async () => { while (i < stocks.length) { const k = i++; out[k] = await one(stocks[k], skip); window.__eaDone++; } }));
    window.__eaOut = out.join('\n'); return out.length;
  };
})();
