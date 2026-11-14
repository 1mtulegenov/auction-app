"""CarMax: итоги и floor price по данным carmaxauctions.com.
  tools/cmx_status_<дата>.txt  run|stock|vin|floor|sold(1/0/пусто)  -> ss sold/none, floor, results, stats
  tools/cmx_floor_<дата>.txt   run|stock|floor                      -> только floor (торги ещё впереди)
CarMax не публикует цены продажи, поэтому fact нет: только «продана / не продана».
Floor больше $200 000 считаем опечаткой CarMax и не ставим."""
import json, sys
date = sys.argv[1]
path = 'data/%s.json' % date
D = json.load(open(path))
lots = [l for l in D['lots'] if l['auc'] == 'CMX']
ok = lambda f: f.isdigit() and 0 < int(f) < 200000
try:
    st = {}
    for line in open('tools/cmx_status_%s.txt' % date):
        run, stock, vin, fl, sold = (line.strip().split('|') + [''] * 5)[:5]
        st[vin] = (int(fl) if ok(fl) else None, sold)
    res, m = [], 0
    for l in lots:
        fl, sold = st.get(l.get('vin'), (None, ''))
        if l.get('vin') in st: m += 1
        if fl: l['floor'] = fl
        l.pop('fact', None); l.pop('bnf', None)
        l['ss'] = 'sold' if sold == '1' else 'none'
        d = ' '.join(str(v) for v in (l.get('y'), l.get('mk'), l.get('md'), l.get('st')) if v)
        res.append({'run': l['run'], 'auc': 'CMX', 'd': d, 'o': l.get('o'), 'g': '', 'fact': None, 'mmr': None, 'w': l.get('w'),
                    'r': l.get('r'), 't': l.get('t') or '', 'c': l.get('c') or '', 'vin10': (l.get('vin') or '')[:10], 'ss': l['ss'],
                    **({'est': 1} if l.get('est') else {})})
    D['results'] = res
    D['stats'] = {'n': sum(r['ss'] == 'sold' for r in res), 'u': sum(r['ss'] == 'none' for r in res), 'off': 0, 'w': None, 'wn': 0,
                  'noprice': 1}
    print('status: matched', m, 'of', len(lots), D['stats'])
except FileNotFoundError:
    fl = {}
    for line in open('tools/cmx_floor_%s.txt' % date):
        run, stock, f = line.strip().split('|')
        if ok(f): fl[run] = int(f)
    n = 0
    for l in lots:
        if l['run'] in fl: l['floor'] = fl[l['run']]; n += 1
    print('floor:', n, 'of', len(lots))
json.dump(D, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
