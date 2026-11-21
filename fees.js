/* Комиссия дилера (dealer fee) для покупателя: сетка «машина до N — X% от цены машины».
   Черновик: сетку правит администратор в основном приложении (Ещё → Покупатели), хранится в Firestore config/fees. */
const FEE_DEFAULT = [{ to: 5000, pct: 35 }, { to: 10000, pct: 25 }, { to: 15000, pct: 20 }, { to: 25000, pct: 15 }, { to: null, pct: 10 }];
function feeGrid(g) { return Array.isArray(g) && g.length ? g.slice().sort((a, b) => (a.to == null) - (b.to == null) || a.to - b.to) : FEE_DEFAULT; }
function feeRow(price, g) { g = feeGrid(g); return g.find(r => r.to == null || price < r.to) || g[g.length - 1]; }
// цена машины → комиссия и итог
function feeFor(price, g) { const r = feeRow(price, g); const fee = Math.round(price * r.pct / 100); return { price, fee, pct: r.pct, total: price + fee }; }
// бюджет → максимальная цена машины, при которой машина + комиссия укладываются в бюджет
function carFromBudget(budget, g) {
  g = feeGrid(g); let best = null, lo = 0;
  for (const r of g) {
    let p = Math.floor(budget / (1 + r.pct / 100));
    if (r.to != null) p = Math.min(p, r.to - 1);
    if (p >= lo && (!best || p > best.price)) best = feeFor(p, g);
    lo = r.to == null ? Infinity : r.to;
  }
  return best || feeFor(0, g);
}
