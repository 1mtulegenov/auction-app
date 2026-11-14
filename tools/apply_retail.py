"""Ретейл-цены Хьюстона (cars.com, 50 миль от центра) в лоты: python3 tools/apply_retail.py <дата>
Вход: tools/retail_<дата>.txt — строки key|n|med|p25|p75|медиана_миль|наклон_$/1000миль|id,id,...  (tools/retail_scrape.js)
В лот пишет rt = {n, med, lo, hi, est, mi, dom?}:
  est — цена такой же машины с пробегом этого лота (по наклону цена/пробег, если объявлений ≥5);
  dom — сколько дней в среднем висят объявления этой модели, пока не исчезнут (копится в tools/retail_hist.json)."""
import json, sys, statistics, datetime
date = sys.argv[1]
today = datetime.date.today().isoformat()
path = 'data/%s.json' % date
D = json.load(open(path))
rows = {}
for line in open('tools/retail_%s.txt' % date):
    p = line.rstrip('\n').split('|')
    if len(p) < 10: continue
    key = '|'.join(p[:3]); n, med, lo, hi, mi, slope, ids = p[3:10]
    rows[key] = dict(n=int(n or 0), med=int(med) if med else None, lo=int(lo) if lo else None, hi=int(hi) if hi else None,
                     mi=int(mi) if mi else None, slope=int(slope) if slope.lstrip('-').isdigit() else None, ids=[i for i in ids.split(',') if i])

# история объявлений: id -> [первый раз, последний раз, модель]; исчезнувшие = проданные/снятые
try: H = json.load(open('tools/retail_hist.json'))
except FileNotFoundError: H = {'ids': {}, 'gone': {}, 'runs': {}}
for key, r in rows.items():
    mk_md = key.split('|', 1)[1]
    prev = H['runs'].get(key)
    now = set(r['ids'])
    if prev:  # что было в прошлый раз и пропало — ушло
        for i in prev['ids']:
            if i not in now and i in H['ids']:
                f, l, _ = H['ids'].pop(i)
                d = (datetime.date.fromisoformat(l) - datetime.date.fromisoformat(f)).days
                H['gone'].setdefault(mk_md, []).append(max(1, d))
    for i in now:
        if i in H['ids']: H['ids'][i][1] = today
        else: H['ids'][i] = [today, today, mk_md]
    H['runs'][key] = {'at': today, 'ids': sorted(now)}
json.dump(H, open('tools/retail_hist.json', 'w'), separators=(',', ':'))

n = 0
for l in D['lots']:
    r = rows.get('%s|%s|%s' % (l.get('y'), l.get('mk'), l.get('md')))
    if not r or not r['n'] or not r['med']:
        l.pop('rt', None); continue
    est = r['med']
    if r['slope'] is not None and r['mi'] and l.get('o') and r['n'] >= 5 and r['slope'] < 0:
        est = int(round((r['med'] + r['slope'] * (l['o'] - r['mi']) / 1000) / 50) * 50)
        est = max(int(r['lo'] * .7) if r['lo'] else est, min(est, int(r['hi'] * 1.3) if r['hi'] else est))
    rt = {'n': r['n'], 'med': r['med'], 'lo': r['lo'], 'hi': r['hi'], 'mi': r['mi'], 'est': est, 'at': today}
    g = H['gone'].get('%s|%s' % (l.get('mk'), l.get('md')), [])
    if len(g) >= 3: rt['dom'] = int(statistics.median(g)); rt['domn'] = len(g)
    l['rt'] = rt; n += 1
json.dump(D, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))
print('rt:', n, 'of', len(D['lots']), 'groups', len(rows))
