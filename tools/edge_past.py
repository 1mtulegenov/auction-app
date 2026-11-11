#!/usr/bin/env python3
"""История лотов по пост-сейлу и no-sale спискам EDGE (H1C и AAA Central).

Вход: дамп, снятый в браузере с EDGE:  AUC:RUN=S,a,date,run,price,I/N,a,date,run,odo;...
  S = есть в пост-сейле (продана), N = в списке No-Sale (не продали, ушла на оффер).
Сумма оффера берётся из вечерних выгрузок в день торгов (sales_*.csv, auction-prices/sales.csv),
где у непроданных машин стоит последняя ставка.
Использование: python3 tools/edge_past.py dump.txt 2026-11-11
"""
import csv, glob, json, os, sys

D = os.path.join(os.path.dirname(__file__), '..', 'data')
PF = '/mnt/project-files/'
AN = {'A': 'AAA Central', 'H': 'H1C'}
CSVA = {'AAA - Central Houston': 'A', "Houston's 1st Choice": 'H'}


def iso(d):
    y, m, dd = d.split('-')
    return '%s-%02d-%02d' % (y, int(m), int(dd))


def main(dump, date):
    bids = {}  # (A/H, date, run) -> цена из вечерней выгрузки
    files = sorted(glob.glob(PF + 'sales_*.csv')) + [PF + 'auction-prices/sales.csv']
    for f in files:
        if not os.path.exists(f):
            continue
        for r in csv.DictReader(open(f, encoding='utf-8')):
            a = CSVA.get(r.get('auction'))
            p = r.get('sale_price_usd')
            if a and p:
                try:
                    bids[(a, r['sale_date'], r['run_number'].replace(' ', ''))] = int(float(p))
                except ValueError:
                    pass
    m = {}
    for part in open(dump, encoding='utf-8').read().strip().split(';'):
        k, v = part.split('=', 1)
        ents = []
        for e in v.split('/'):
            f = e.split(',')
            t, a, d, run = f[0], f[1], iso(f[2]), f[3]
            if t == 'S':
                ents.append({'d': d, 'a': AN[a], 'run': run, 'p': int(f[4]) or None, 's': 'sold'})
            else:
                ents.append({'d': d, 'a': AN[a], 'run': run, 'p': bids.get((a, d, run)), 's': 'offer'})
        m[k] = ents
    path = os.path.join(D, date + '.json')
    x = json.load(open(path))
    st = {'sold': 0, 'offer': 0, 'offer_p': 0}
    for l in x['lots']:
        keep = [p for p in l.get('past') or [] if p['a'] not in ('AAA Central', 'H1C') and not p.get('q')]
        new = m.get('%s:%s' % (l['auc'], l['run']), [])
        P = sorted(keep + new, key=lambda p: p['d'])
        if P:
            l['past'] = P
        else:
            l.pop('past', None)
        for p in new:
            st[p['s']] += 1
            if p['s'] == 'offer' and p['p']:
                st['offer_p'] += 1
    json.dump(x, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(date, 'с историей:', sum(1 for l in x['lots'] if l.get('past')), st)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
