#!/usr/bin/env python3
"""Исправляет статусы прошлых торгов по итоговому пост-сейлу EDGE (только реальные продажи, If:No).
Цена из вечерней выгрузки, которой нет в итоговом пост-сейле, это ставка без продажи: ставим 'offer' (bnf).
    python3 tools/fix_final.py tools/postsale_final.txt
Строки файла: '<AUC><день> run:price:S ...', напр. 'AAH5 T-0025:1100:S'."""
import json, statistics, sys
from collections import defaultdict
FIN = defaultdict(dict)  # date -> {(auc,run): price}
for line in open(sys.argv[1]):
    p = line.split()
    if not p: continue
    auc, day = p[0][:3], int(p[0][3:])
    for t in p[1:]:
        run, price, _ = t.rsplit(':', 2)
        FIN['2026-11-%02d' % day][(auc, run)] = int(price)
def ratio(rs): return round(100 * statistics.median(rs)) if rs else None
def fix(o, fin, aucs):
    if o.get('auc') not in aucs: return
    k = (o['auc'], o['run'])
    if k in fin:
        o['fact'] = fin[k]; o['ss'] = 'sold'; o.pop('bnf', None)
    elif o.get('fact'):
        o['bnf'] = o['fact']; o['fact'] = None; o['ss'] = 'offer'
    elif not o.get('ss') or o['ss'] == 'sold':
        o['ss'] = 'none'
for date, fin in sorted(FIN.items()):
    path = 'data/%s.json' % date
    D = json.load(open(path))
    aucs = {a for a, _ in fin}
    for l in D['lots']: fix(l, fin, aucs)
    for r in D.get('results') or []: fix(r, fin, aucs)
    have = {(r['auc'], r['run']) for r in D['results']}
    for k, price in fin.items():
        if k not in have:
            D['results'].append({'run': k[1], 'auc': k[0], 'd': '(нет в каталоге)', 'o': None, 'g': '', 'fact': price, 'mmr': None,
                                 'w': None, 'r': None, 't': '', 'c': '', 'vin10': '', 'ss': 'sold'})
    res, lots = D['results'], D['lots']
    real = [l for l in lots if l.get('fact') and l.get('w') and not l.get('est')]
    gv = lambda l: float(l['g']) if l.get('g') not in (None, '') else None
    def grp(f):
        a = [l for l in real if f(l)]
        return {'n': len(a), 'r': ratio([l['fact'] / l['w'] for l in a])}
    core = set(D.get('core') or []) | set(D.get('flip') or [])
    picks = [l for l in lots if l.get('C') or (l['auc'] + '|' + l['run']) in core]
    S = D.setdefault('stats', {})
    sold = [r for r in res if r['ss'] == 'sold']
    S.update({'n': len(sold), 'u': sum(1 for r in res if r['ss'] == 'none'),
              'off': sum(1 for r in res if r['ss'] == 'offer'),
              'a': sum(1 for r in sold if r['auc'] != 'H1C'), 'h': sum(1 for r in sold if r['auc'] == 'H1C'),
              'w': ratio([l['fact'] / l['w'] for l in real]), 'wn': len(real), 'aall': ratio([l['fact'] / l['w'] for l in real]),
              'g4': grp(lambda l: gv(l) is not None and gv(l) >= 4), 'g3': grp(lambda l: gv(l) is not None and 3 <= gv(l) < 4),
              'g2': grp(lambda l: gv(l) is not None and gv(l) < 3), 'gn': grp(lambda l: gv(l) is None),
              'pn': len(picks), 'ps': sum(1 for l in picks if l.get('fact')),
              'pw': sum(1 for l in picks if l.get('fact') and l.get('max') and l['max'] >= l['fact']),
              'po': sum(1 for l in picks if l.get('ss') == 'offer')})
    miss = [k for k in fin if not any((r['auc'], r['run']) == k for r in res)]
    json.dump(D, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(date, {k: S[k] for k in ('n', 'u', 'off', 'w', 'wn', 'ps', 'po')}, 'нет в results:', len(miss), miss[:5])
