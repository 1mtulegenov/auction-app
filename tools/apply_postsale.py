#!/usr/bin/env python3
"""Итоги торгов из пост-сейла EDGE: tools/postsale_<дата>.txt (+ _extra_ с описаниями лотов вне каталога).
Пишет fact/ss/bnf в лоты, results и stats в data/<дата>.json, выгрузку /mnt/project-files/sales_<дата>.xlsx и .csv.

    python3 tools/apply_postsale.py 2026-11-11
"""
import csv, json, statistics, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

date = sys.argv[1]
path = 'data/%s.json' % date
D = json.load(open(path))
PFX = {'H': 'H1C', 'A': 'AAA'}
LOC = {'H1C': "Houston's 1st Choice", 'AAA': 'AAA - Central Houston', 'AAH': 'AAA - Houston'}

ps = {}
for line in open('tools/postsale_%s.txt' % date):
    p = line.split()
    if not p: continue
    auc = PFX.get(p[0], p[0])
    for t in p[1:]:
        run, price, s = t.rsplit(':', 2)
        ps[(auc, run)] = (int(price), 'offer' if s == 'I' else 'sold')

extra = {}
try:
    for line in open('tools/postsale_extra_%s.txt' % date):
        a, run, y, mk, md, st, col, odo, g = (line.rstrip('\n').split('|') + [''] * 9)[:9]
        extra[(PFX[a], run)] = {'y': y, 'mk': mk, 'md': md, 'st': st, 'c': col, 'o': int(odo or 0), 'g': g}
except FileNotFoundError:
    pass

def ratio(rs):
    return round(100 * statistics.median(rs)) if rs else None

res, rows = [], []
core = set(D.get('core') or [])
for l in D['lots']:
    k = (l['auc'], l['run'])
    l.pop('fact', None); l.pop('bnf', None)
    if k in ps:
        price, s = ps[k]
        l['ss'] = s
        if s == 'sold': l['fact'] = price
        else: l['bnf'] = price
    else:
        l['ss'] = 'none'
    d = ' '.join(str(v) for v in (l.get('y'), l.get('mk'), l.get('md'), l.get('st')) if v)
    res.append({'run': l['run'], 'auc': l['auc'], 'd': d, 'o': l.get('o'), 'g': l.get('g') or '', 'fact': l.get('fact'),
                'mmr': None, 'w': l.get('w'), 'r': l.get('r'), 't': l.get('t') or '', 'c': l.get('c') or '',
                'vin10': (l.get('vin') or '')[:10], 'ss': l['ss'], **({'bnf': l['bnf']} if l.get('bnf') else {}),
                **({'est': 1} if l.get('est') else {})})
    rows.append((l['auc'], l['run'], d, l.get('vin') or '', l.get('c') or '', l.get('o'), l.get('g') or '', l.get('t') or '',
                 l.get('w'), l.get('r'), 'оценка' if l.get('est') else ('EDGE' if l.get('w') else ''), ps.get(k)))
seen = {(l['auc'], l['run']) for l in D['lots']}
for k, (price, s) in ps.items():
    if k in seen: continue
    e = extra.get(k, {})
    d = ' '.join(v for v in (e.get('y'), e.get('mk'), e.get('md'), e.get('st')) if v) or '(нет в каталоге)'
    res.append({'run': k[1], 'auc': k[0], 'd': d, 'o': e.get('o') or None, 'g': e.get('g') or '', 'fact': price if s == 'sold' else None,
                'mmr': None, 'w': None, 'r': None, 't': '', 'c': e.get('c') or '', 'vin10': '', 'ss': s,
                **({'bnf': price} if s == 'offer' else {})})
    rows.append((k[0], k[1], d, '', e.get('c') or '', e.get('o') or None, e.get('g') or '', '', None, None, '', (price, s)))

lots = D['lots']
sold = [l for l in lots if l.get('fact')]
real = [l for l in sold if l.get('w') and not l.get('est')]
def grp(f):
    a = [l for l in real if f(l)]
    return {'n': len(a), 'r': ratio([l['fact'] / l['w'] for l in a])}
gv = lambda l: float(l['g']) if l.get('g') not in (None, '') else None
picks = [l for l in lots if l.get('C') or (l['auc'] + '|' + l['run']) in core]
D['results'] = res
D['stats'] = {
    'n': sum(1 for r in res if r['ss'] == 'sold'), 'u': sum(1 for r in res if r['ss'] == 'none'),
    'off': sum(1 for r in res if r['ss'] == 'offer'),
    'w': ratio([l['fact'] / l['w'] for l in real]), 'wn': len(real),
    'g4': grp(lambda l: gv(l) is not None and gv(l) >= 4), 'g3': grp(lambda l: gv(l) is not None and 3 <= gv(l) < 4),
    'g2': grp(lambda l: gv(l) is not None and gv(l) < 3), 'gn': grp(lambda l: gv(l) is None),
    'pn': len(picks), 'ps': sum(1 for l in picks if l.get('fact')),
    'pw': sum(1 for l in picks if l.get('fact') and l.get('max') and l['max'] >= l['fact']),
    'po': sum(1 for l in picks if l.get('ss') == 'offer'),
}
json.dump(D, open(path, 'w'), ensure_ascii=False, separators=(',', ':'))

# выгрузка
def rk(r):
    a, b = (r[1].split('-') + ['0'])[:2]
    return (r[0], a.zfill(3), int(b) if b.isdigit() else 0)
rows.sort(key=rk)
H = ['Аукцион', 'Дата', 'Лот', 'Описание', 'VIN', 'Цвет', 'Пробег, mi', 'Оценка', 'Тайтл', 'MMR', 'Ретейл', 'Источник MMR',
     'Цена продажи, $', 'Статус', 'Цена к MMR, %']
ST = {'sold': 'продана', 'offer': 'на оффере', None: 'не продана'}
out = []
for auc, run, d, vin, col, o, g, t, w, r, src, p in rows:
    price, s = p if p else (None, None)
    out.append([LOC.get(auc, auc), date, run, d, vin, col, o, g, t, w, r, src, price, ST[s],
                round(100 * price / w) if price and w and s == 'sold' else None])
wb = Workbook(); ws = wb.active; ws.title = 'Пост-сейл ' + date[5:]
ws.append(H)
for c in ws[1]: c.font = Font(bold=True, color='FFFFFF'); c.fill = PatternFill('solid', fgColor='1F4E79'); c.alignment = Alignment(wrap_text=True, vertical='center')
fills = {'продана': 'E2F0D9', 'на оффере': 'FFF2CC'}
for row in out:
    ws.append(row)
    f = fills.get(row[13])
    if f:
        for c in ws[ws.max_row][12:14]: c.fill = PatternFill('solid', fgColor=f)
for col, wdt in zip('ABCDEFGHIJKLMNO', (30, 11, 9, 46, 19, 10, 11, 8, 13, 9, 9, 12, 14, 12, 11)):
    ws.column_dimensions[col].width = wdt
for c in ('G', 'J', 'K', 'M'):
    for cell in ws[c][1:]: cell.number_format = '#,##0'
ws.freeze_panes = 'A2'; ws.auto_filter.ref = ws.dimensions
s2 = wb.create_sheet('Сводка')
s2.append(['Аукцион', 'Продана', 'На оффере', 'Не продана', 'Всего'])
for auc in sorted({r[0] for r in out}):
    a = [r for r in out if r[0] == auc]
    s2.append([auc] + [sum(1 for r in a if r[13] == x) for x in ('продана', 'на оффере', 'не продана')] + [len(a)])
for c in s2[1]: c.font = Font(bold=True)
s2.column_dimensions['A'].width = 34
base = '/mnt/project-files/sales_%s' % date
wb.save(base + '.xlsx')
with open(base + '.csv', 'w', newline='') as f:
    wr = csv.writer(f)
    wr.writerow(['auction', 'location', 'sale_date', 'run_number', 'description', 'vin', 'color', 'odometer_mi', 'grade', 'title_status',
                 'mmr', 'retail', 'mmr_source', 'sale_price_usd', 'status', 'source'])
    for r in out:
        wr.writerow([r[0], 'Houston, TX', date, r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12], r[13],
                     'edgepipeline_postsale_' + date.replace('-', '')])
print(D['stats'], len(res))
