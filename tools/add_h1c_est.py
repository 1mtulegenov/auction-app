#!/usr/bin/env python3
"""Добавляет новые лоты H1C из пре-сейла EDGE (tools/h1c_new_<дата>.txt) в data/<дата>.json.
MMR, ретейл и цена продажи оцениваются по похожим лотам из прошлых дат (без Manheim):
та же марка и модель, год ±3, ближе по пробегу и комплектации; поправка на год и пробег.

    python3 tools/add_h1c_est.py 2026-11-11
"""
import glob, json, math, re, sys

date = sys.argv[1]
src = 'tools/h1c_new_%s.txt' % date
out_path = 'data/%s.json' % date
D = json.load(open(out_path))

MK_ALIAS = {'mercedes-benz': 'mercedes-benz', 'mercedes': 'mercedes-benz', 'infiniti': 'infiniti'}
def nmk(s): s = (s or '').lower(); return MK_ALIAS.get(s, s)
def nmd(s): return re.sub(r'[^a-z0-9]', '', (s or '').lower())

# база сравнения: все лоты всех дат с MMR, кроме оценённых этим же скриптом
base = []
for f in sorted(glob.glob('data/2026-*.json')):
    for l in json.load(open(f))['lots']:
        if l.get('w') and l.get('y') and l.get('est') is None and l.get('cls') in ('clean', 'hist', None) and not re.search(r'Commercial|Police|PPV|Pursuit', str(l.get('st')) + str(l.get('tr')), re.I):
            base.append(dict(l, _f=f[5:15]))
models = {}
for l in base:
    models.setdefault(nmk(l['mk']), set()).add(l['md'])

MAKES = ['Mercedes-Benz', 'INFINITI', 'Land Rover', 'Alfa Romeo']
def split(title):
    for m in MAKES:
        if title.startswith(m + ' '): mk, rest = m, title[len(m) + 1:]; break
    else:
        mk, rest = title.split(' ', 1)
    md = None
    for cand in sorted(models.get(nmk(mk), ()), key=len, reverse=True):
        if rest.lower().startswith(cand.lower() + ' ') or rest.lower() == cand.lower():
            md = cand; break
    if not md:
        md = rest.split(' ')[0]
    after = rest[len(md):].strip()
    st = re.split(r'\b(FWD|RWD|AWD|4WD|2WD)\b', after)[0].strip()
    return mk, md, st, rest

def words(s): return set(re.findall(r'[a-z0-9]+', (s or '').lower()))

def estimate(y, mk, md, st, o):
    m1 = lambda l: nmd(l['md']) == nmd(md)
    m2 = lambda l: nmd(l['md']).startswith(nmd(md)) or nmd(md).startswith(nmd(l['md'])) or nmd(l['md'])[:4] == nmd(md)[:4] and len(nmd(md)) >= 4
    cands = []
    for match, yr in ((m1, 3), (m2, 3), (m1, 5), (m2, 5)):
        cands = [l for l in base if nmk(l['mk']) == nmk(mk) and match(l) and abs(int(l['y']) - y) <= yr]
        if cands: break
    if not cands: return None
    sw = words(st)
    rows = []
    for l in cands:
        dy = y - int(l['y']); lo = int(l.get('o') or 0)
        do = (o - lo) if (o and lo) else 0
        wt = math.exp(-abs(dy) / 1.2) * math.exp(-abs(do) / 45000)
        if sw and words(l.get('st')) & sw: wt *= 2.2
        k = (1.10 ** dy) * max(0.6, min(1.4, 1 - 0.22 * do / 100000))
        rows.append((wt, k, l))
    rows.sort(key=lambda r: -r[0])
    rows = rows[:6]
    def wmed(vals):
        vals = sorted(vals); tot = sum(w for _, w in vals); acc = 0
        for v, w in vals:
            acc += w
            if acc >= tot / 2: return v
    w = wmed([(r[2]['w'] * r[1], r[0]) for r in rows])
    rv = [(r[2]['r'] * r[1], r[0]) for r in rows if r[2].get('r')]
    sv = [(r[2]['sale'] / r[2]['w'], r[0]) for r in rows if r[2].get('sale')]
    ret = wmed(rv) if rv else w * 1.75
    sale = w * (wmed(sv) if sv else 1.08)
    conf = sum(r[0] for r in rows)
    return round(w / 25) * 25, round(ret / 50) * 50, round(sale / 50) * 50, rows, conf

IDS = dict(x.split(':') for x in open('tools/h1c_ids_%s.txt' % date).read().split())
have = {l['run'] for l in D['lots'] if l['auc'] == 'H1C'}
added, noest = [], []
for line in open(src):
    p = line.rstrip('\n').split('|')
    if len(p) < 7 or p[0] in have: continue
    run, y, title, vin, col, odo, ph = p[:7]
    y = int(y); o = int(odo or 0)
    mk, md, st, tr = split(title)
    e = re.search(r'(\d+\.\d) ', tr + ' ')
    lot = {'run': run, 'auc': 'H1C', 'y': y, 'mk': mk, 'md': md, 'st': st, 'c': col, 'o': o, 'l': '', 'g': '',
           't': 'Title Absent', 'a': '', 'ar': '', 's': '', 'vin': vin, 'bn': None, 'tr': tr,
           'eng': (e.group(1) + 'L') if e else '', 'cls': 'clean', 'prior': None, 'w': None, 'r': None,
           'stat': None, 'whyn': '', 'ss': None, 'new': 1, 'est': 1}
    if ph: lot['ph'] = ph
    if run in IDS: lot['u'] = 'https://www.edgepipeline.com/components/vehicle/detail/houstonsfcaa/' + IDS[run]
    r = estimate(y, mk, md, st, o)
    if r:
        w, ret, sale, rows, conf = r
        n = len(rows)
        ex = ', '.join('%s %s %s%s — $%s' % (l['y'], l['md'], (l.get('st') or '').split(' ')[0],
                       (' %dk mi' % round(int(l['o']) / 1000)) if l.get('o') else '', format(int(l['w']), ',')) for _, _, l in rows[:3])
        lot.update({'w': w, 'r': ret, 'sale': sale, 'margin': 1000 if w < 5000 else 1500, 'prof': sale - w - 700, 'max': 0,
                    'src': 'оценка по %d похожим лотам, без Manheim (%s)' % (n, ex)})
        if conf < 0.5 or min(abs(y - int(l['y'])) for _, _, l in rows) >= 3:
            lot['src'] += '; похожих мало, оценка грубая'
            for f in ('sale', 'prof', 'max', 'margin'): lot.pop(f, None)
    else:
        lot['src'] = 'похожих лотов нет, MMR не оценён'
        noest.append(run)
    D['lots'].append(lot); added.append(run)

json.dump(D, open(out_path, 'w'), ensure_ascii=False, separators=(',', ':'))
print('added', len(added), 'no estimate', len(noest), noest)
