/* Сборы для покупателя «всё включено»: один процент от цены машины, в который входят
   сбор аукциона, оформление и документы, комиссия дилера и наша прибыль.
   Процент плавно снижается с ценой (между опорными точками — по прямой), поэтому скачков на границах нет,
   и итог всегда растёт вместе с ценой. Плюс минимальная сумма для дешёвых машин.
   Черновик: точки правит администратор (Ещё → Покупатели), хранятся в Firestore config/fees {grid, min}. */
const FEE_DEFAULT = { min: 800, grid: [{ at: 2000, pct: 40 }, { at: 5000, pct: 30 }, { at: 10000, pct: 22 }, { at: 15000, pct: 17 }, { at: 25000, pct: 12 }, { at: 40000, pct: 9 }] };
function feeCfg(c) {
  const g = c && Array.isArray(c.grid) ? c.grid.filter(r => r && r.at > 0 && r.pct >= 0).sort((a, b) => a.at - b.at) : [];
  return g.length ? { min: +c.min || 0, grid: g } : FEE_DEFAULT;
}
// процент для цены: по прямой между соседними точками, за краями — крайние значения
function feePct(price, c) {
  const g = feeCfg(c).grid;
  if (price <= g[0].at) return g[0].pct;
  for (let i = 1; i < g.length; i++) if (price <= g[i].at) { const a = g[i - 1], b = g[i]; return a.pct + (b.pct - a.pct) * (price - a.at) / (b.at - a.at); }
  return g[g.length - 1].pct;
}
// цена машины → сборы и итог
function feeFor(price, c) {
  const cf = feeCfg(c); price = Math.max(0, Math.round(+price || 0));
  const pct = feePct(price, cf), fee = price ? Math.max(cf.min, Math.round(price * pct / 100)) : 0;
  return { price, fee, pct: price ? Math.round(fee / price * 1000) / 10 : 0, total: price + fee };
}
// бюджет → самая дорогая машина, которая с учётом сборов укладывается в бюджет (итог растёт с ценой — ищем делением пополам)
function carFromBudget(budget, c) {
  budget = Math.max(0, +budget || 0); let lo = 0, hi = Math.ceil(budget);
  while (lo < hi) { const m = Math.ceil((lo + hi) / 2); if (feeFor(m, c).total <= budget) lo = m; else hi = m - 1; }
  return feeFor(lo, c);
}
