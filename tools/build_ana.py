#!/usr/bin/env python3
"""Каталог AutoNation AA - Houston из пре-сейла EDGE (tools/ana_raw_<дата>.txt) -> data/<дата>.json.
MMR берётся из пре-сейла EDGE (поле MMR), ретейл = MMR x отношение ретейла к MMR у похожих машин прошлых дат.
Где MMR на EDGE нет, как у AAA Houston: оценка по похожим лотам или PMR.
Строка входа: run|год и описание|VIN|цвет|пробег|оценка|свет|MMR|PMR|тайтл|сток|фото (аккаунт/a/b)|CR
    python3 tools/build_ana.py 2026-11-13
---- ниже описание исходного скрипта AAA Houston ----
MMR и ретейл без Manheim: по похожим лотам прошлых дат (та же модель, год, пробег, комплектация),
если похожих нет, берётся PMR со страницы EDGE. Продажа = ретейл x 0,64 (-3% дороже $5 000 со сбором).

Строка входа: run|год и описание|VIN|цвет|пробег|оценка|свет R/G|PMR|A=тайтл на месте|сток|фото|CR
    python3 tools/build_aah.py 2026-11-12
"""
import glob, json, math, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ann import load as ann_load, apply as ann_apply

date = sys.argv[1]
FEE, CAP = 700, 13500
AN = {'AAA': 'AAA Central', 'H1C': 'H1C', 'AAH': 'AAA Houston', 'ANA': 'AutoNation', 'CMX': 'CarMax Conroe'}
MK_ALIAS = {'mercedes': 'mercedes-benz'}
def nmk(s): s = (s or '').lower(); return MK_ALIAS.get(s, s)
def nmd(s): return re.sub(r'[^a-z0-9]', '', (s or '').lower())
def words(s): return set(re.findall(r'[a-z0-9]+', (s or '').lower()))

files = sorted(f for f in glob.glob('data/2026-*.json') if not f.endswith(date + '.json'))
base, prof_by_model, dated = [], {}, {}
for f in files:
    dd = json.load(open(f)); dated[f[5:15]] = dd
    for l in dd['lots']:
        if l.get('risk'): prof_by_model[(nmk(l['mk']), nmd(l['md']))] = l
        if l.get('w') and l.get('y') and not l.get('est') and l.get('cls') in ('clean', 'hist', None) \
                and not re.search(r'Commercial|Police|PPV|Pursuit', str(l.get('st')) + str(l.get('tr')), re.I):
            base.append(l)
models = {}
for l in base: models.setdefault(nmk(l['mk']), set()).add(l['md'])
for (mk, md), l in prof_by_model.items(): models.setdefault(mk, set()).add(l['md'])

MAKES = ['Mercedes-Benz', 'INFINITI', 'Land Rover', 'Alfa Romeo', 'Aston Martin', 'Rolls-Royce', 'HARLEY-DAVIDSON', 'SPORTS TRAILER']
def split(title):
    for m in MAKES:
        if title.lower().startswith(m.lower() + ' '): mk, rest = m, title[len(m) + 1:]; break
    else:
        mk, rest = (title.split(' ', 1) + [''])[:2]
    md = None
    for cand in sorted(models.get(nmk(mk), ()), key=len, reverse=True):
        if rest.lower().startswith(cand.lower() + ' ') or rest.lower() == cand.lower(): md = cand; break
    if not md: md = rest.split(' ')[0]
    after = rest[len(md):].strip()
    st = re.split(r'\b(FWD|RWD|AWD|4WD|2WD)\b', after)[0].strip()
    return mk, md, st, rest

def estimate(y, mk, md, st, o):
    m1 = lambda l: nmd(l['md']) == nmd(md)
    m2 = lambda l: nmd(l['md']).startswith(nmd(md)) or nmd(md).startswith(nmd(l['md'])) or (nmd(l['md'])[:4] == nmd(md)[:4] and len(nmd(md)) >= 4)
    cands = []
    for match, yr in ((m1, 3), (m2, 3), (m1, 5), (m2, 5)):
        cands = [l for l in base if nmk(l['mk']) == nmk(mk) and match(l) and abs(int(l['y']) - y) <= yr]
        if cands: break
    if not cands: return None
    sw, rows = words(st), []
    for l in cands:
        dy = y - int(l['y']); lo = int(l.get('o') or 0)
        do = (o - lo) if (o > 1 and lo > 1) else 0
        wt = math.exp(-abs(dy) / 1.2) * math.exp(-abs(do) / 45000)
        if sw and words(l.get('st')) & sw: wt *= 2.2
        k = (1.10 ** dy) * max(0.6, min(1.4, 1 - 0.22 * do / 100000))
        rows.append((wt, k, l))
    rows.sort(key=lambda r: -r[0]); rows = rows[:6]
    def wmed(vals):
        vals = sorted(vals); tot = sum(w for _, w in vals); acc = 0
        for v, w in vals:
            acc += w
            if acc >= tot / 2: return v
    w = wmed([(r[2]['w'] * r[1], r[0]) for r in rows])
    rv = [(r[2]['r'] / r[2]['w'], r[0]) for r in rows if r[2].get('r')]
    return w, w * (wmed(rv) if rv else 1.9), rows, sum(r[0] for r in rows)

BAND = [(1000, 3.35), (3000, 2.38), (5000, 1.97), (7000, 1.69), (9000, 1.58), (11000, 1.47), (13000, 1.37), (15000, 1.34), (17000, 1.21), (40000, 1.15)]
def band(m):
    if m <= BAND[0][0]: return BAND[0][1]
    for (a, x), (b, y) in zip(BAND, BAND[1:]):
        if m <= b: return x + (y - x) * (m - a) / (b - a)
    return BAND[-1][1]

SEVEN = re.compile(r'^(Toyota|Honda|Hyundai|BMW|Volkswagen|Kia|Mercedes)', re.I)
def allowed(mk, md, st):
    m, d = nmk(mk), nmd(md)
    if m in ('toyota', 'honda', 'hyundai', 'bmw', 'volkswagen', 'kia', 'mercedes-benz', 'jeep', 'dodge', 'chrysler', 'nissan'): return True
    if m == 'lexus': return d[:2] in ('nx', 'rx')
    if m == 'chevrolet': return d == 'camaro'
    if m == 'ford': return d in ('escape', 'explorer')
    if m == 'audi': return d in ('q5', 'q7') or d.startswith('s')
    return False

vins = json.load(open('data/vins.json'))
def past(vin):
    out = []
    for d, k in vins.get(vin, []):
        if d == date or d not in dated: continue
        l = next((x for x in dated[d]['lots'] if x['auc'] + '|' + x['run'] == k), None)
        if not l or not dated[d].get('results'): continue
        s = l.get('ss') or ('sold' if l.get('fact') else 'none')
        if s == 'none': continue
        out.append({'d': d, 'a': AN.get(l['auc'], l['auc']), 'run': l['run'], 'p': l.get('fact') or l.get('bnf'), 's': s})
    return out

ANN = ann_load('tools/ana_ann_%s.txt' % date)
DET = {}
try:
    for line in open('tools/ana_detail_%s.txt' % date):
        q = line.rstrip('\n').split('|')
        if len(q) >= 11: DET[q[0]] = q
except FileNotFoundError:
    pass
TR = [('Front Bumper / Cover', 'передний бампер'), ('Rear Bumper / Cover', 'задний бампер'), ('Front Bumper', 'передний бампер'), ('Rear Bumper', 'задний бампер'),
      ('Windshield', 'лобовое'), ('Warning Light: Engine - On', 'горит Check Engine'), ('Warning Light: Abs - On', 'горит ABS'), ('Warning Light: Air Bag - On', 'горит Airbag'),
      ('Engine: Noise', 'шум двигателя'), ('Keys: Missing', 'нет ключа'), ('Air Conditioner: Inoperable', 'не работает кондиционер'),
      ('Tire: Worn', 'шина изношена'), ('Severe Damage', 'сильное повреждение'), ('Broken', 'разбит'), ('Cracked', 'трещина'),
      ('Missing', 'нет'), ('Torn', 'порвано'), ('Rust', 'ржавчина'), ('Replaced (Substandard Repair)', 'заменена, ремонт плохой'),
      ('Hood', 'капот'), ('Lift Gate', 'дверь багажника'), ('Liftgate', 'дверь багажника'), ('Deck Lid', 'крышка багажника'),
      ('Quarter Panel', 'заднее крыло'), ('Front Fender', 'переднее крыло'), ('Left ', 'лев. '), ('Right ', 'прав. '), ('Front ', 'перед. '), ('Rear ', 'зад. ')]
def ru(item):
    item = re.sub(r' \((Replacement|Repair) Required\)| \(Unacceptable\)', '', item)
    for e, r in TR: item = item.replace(e, r)
    return item.replace(': ', ' ')

lots, core, flip = [], [], []
for line in open('tools/ana_raw_%s.txt' % date):
    p = line.rstrip('\n').split('|')
    if len(p) < 13: continue
    run, title, vin, col, odo, g, li, mmr, pmr, tt, stock, ph, cr = p[:13]
    mmr = int(mmr) if mmr else None
    if not title[:4].isdigit(): continue
    y = int(title[:4]); title = title[5:]
    title = re.sub(r'(\d)c\b', r'\1cyl.', title)
    mk, md, st, tr = split(title)
    o = int(odo or 0); pmr = int(pmr) if pmr else None
    e = re.search(r'(\d+\.\d) ', tr + ' ')
    lot = {'run': run, 'auc': 'ANA', 'y': y, 'mk': mk, 'md': md, 'st': st, 'c': col, 'o': o,
           'l': li, 'g': g if g and g != '0.0' else '', 't': tt or 'Title Absent',
           'a': '', 'ar': '', 's': '', 'vin': vin, 'bn': None, 'tr': tr, 'eng': (e.group(1) + 'L') if e else '',
           'cls': 'clean', 'prior': None, 'w': None, 'r': None, 'stat': 'Нет', 'whyn': '', 'ss': None, 'est': 1,
           'u': 'https://www.edgepipeline.com/components/vehicle/detail/anaahouston/' + stock}
    if pmr: lot['pmr'] = pmr
    if ph: lot['ph'] = ph
    pr = prof_by_model.get((nmk(mk), nmd(md)))
    if pr:
        for f in ('risk', 'demand', 'sell'): lot[f] = pr.get(f)
    P = past(vin)
    if P: lot['past'] = P
    r = estimate(y, mk, md, st, o)
    rough = False
    if r:
        w, ret, rows, conf = r
        ex = ', '.join('%s %s %s%s — $%s' % (l['y'], l['md'], (l.get('st') or '').split(' ')[0],
                       (' %dk mi' % round(int(l['o']) / 1000)) if (l.get('o') or 0) > 1 else '', format(int(l['w']), ',')) for _, _, l in rows[:3])
        lot['src'] = 'оценка по %d похожим лотам, без Manheim (%s)' % (len(rows), ex)
        rough = conf < 0.5 or min(abs(y - int(l['y'])) for _, _, l in rows) >= 3
        if rough and pmr:
            w, ret = pmr, pmr * (ret / w)
            lot['src'] = 'похожих мало, взят PMR EDGE $%s; ретейл по похожим' % format(pmr, ',')
            rough = False
        elif rough:
            lot['src'] += '; похожих мало, оценка грубая'
    elif pmr:
        w, ret = pmr, pmr * 1.9
        lot['src'] = 'похожих лотов нет, взят PMR EDGE $%s; ретейл MMR × 1,9' % format(pmr, ',')
        rough = True
    else:
        w = ret = None
        lot['src'] = 'похожих лотов нет и PMR нет, MMR не оценён'
    if w and pmr and lot['src'].startswith('оценка') and not 0.67 <= w / pmr <= 1.5:
        k = (w + pmr) / 2 / w; w *= k; ret *= k
        lot['src'] += '; оценка и PMR EDGE $%s сильно расходятся, взято среднее' % format(pmr, ',')
    if mmr:
        # ретейл/MMR сильно зависит от цены (дешёвые машины: ретейл в 3 раза выше MMR, дорогие: в 1,2).
        # Берём типичное отношение для этой цены и поправку модели по похожим машинам (не больше ±15%).
        adj = 1.0
        if r:
            vals = sorted(((l['r'] / l['w']) / band(l['w']), wt) for wt, _, l in r[2] if l.get('r'))
            if vals:
                tot, acc = sum(x for _, x in vals), 0
                for v, x in vals:
                    acc += x
                    if acc >= tot / 2: adj = max(0.85, min(1.15, v)); break
        w, ret, rough = mmr, mmr * band(mmr) * adj, False
        lot.pop('est', None)
        lot['src'] = 'MMR из пре-сейла EDGE; ретейл по отношению ретейл/MMR для этой цены' + (' с поправкой модели %+d%%' % round(100 * (adj - 1)) if abs(adj - 1) >= 0.02 else '')
    if w:
        w = round(w / 25) * 25; ret = round(ret / 50) * 50
        lot['w'], lot['r'] = w, ret
        if pmr and 'PMR' not in lot['src'] and 'расходятся' not in lot['src']: lot['src'] += '; PMR EDGE $%s' % format(pmr, ',')
        if not rough:
            sale = ret * 0.64 * (0.97 if w + FEE > 5000 else 1)
            sale = round(sale / 50) * 50
            margin = 1000 if w + FEE <= 5000 else 1500
            lot.update({'sale': sale, 'prof': sale - w - FEE, 'margin': margin,
                        'max': max(0, min(sale - FEE - margin, (CAP if margin >= 1500 else 5000) - FEE))})
    q = DET.get(run)
    flag = ''
    if q:
        _, drv, frame, _, floor, book, sold_l, sold_p, _, ncr, bad = q[:11]
        if int(floor or 0): lot['floor'] = int(floor)
        if int(book or 0): lot['book'] = int(book)
        items = [ru(b) for b in bad.split('; ') if b]
        txt = 'Отчёт: ' + ('не на ходу' if drv == 'No' else 'на ходу' if drv == 'Yes' else 'ход не указан')
        if frame: txt += ', рама ' + ('повреждена' if frame == 'Damaged' else 'Good' if frame == 'Good' else frame)
        txt += ', отметок о повреждениях %s' % ncr
        if not drv and ncr == '0': txt = 'Отчёта о состоянии нет'
        if items: txt += '. Главное: ' + '; '.join(items)
        if lot.get('floor'): txt += '. Floor price $' + format(lot['floor'], ',')
        if lot.get('book'): txt += ', book value $' + format(lot['book'], ',')
        if sold_l: txt += '. EDGE: ' + sold_l + (' $' + format(int(sold_p), ',') if sold_p else '')
        lot['cr'] = txt + '.'
        if drv == 'No': lot['cls'] = 'noinop'; flag = 'не на ходу по отчёту'
        elif re.search(r'Engine: Noise', bad): flag = 'шум двигателя по отчёту'
        elif re.search(r'Keys: Missing', bad): flag = 'нет ключа по отчёту'
        elif re.search(r'Substandard', bad): flag = 'некачественный ремонт кузова по отчёту'
        if frame == 'Damaged':
            lot['cls'] = 'hist'; lot['hist'] = True
            if 'sale' in lot:
                lot['sale'] = round(lot['sale'] * 0.85 / 50) * 50; lot['prof'] = lot['sale'] - lot['w'] - FEE
                lot['max'] = max(0, min(lot['sale'] - FEE - lot['margin'], (CAP if lot['margin'] >= 1500 else 5000) - FEE))
        if sold_l: flag = flag or ('уже продана до торгов (' + sold_l + ')')
    A = ANN.get(run)
    if A:
        aw = ann_apply(lot, A[0], A[1]); k = lot.pop('_annk', 1.0)
        if k < 1 and 'sale' in lot:
            lot['sale'] = round(lot['sale'] * k / 50) * 50; lot['prof'] = lot['sale'] - lot['w'] - FEE
            lot['max'] = max(0, min(lot['sale'] - FEE - lot['margin'], (CAP if lot['margin'] >= 1500 else 5000) - FEE))
        if aw: flag = flag or aw
    # отбор
    why = ''
    if run.split('-')[0] == 'T': lot['cls'] = 'noinop'; flag = flag or 'не на ходу (линия T)'
    if lot['o'] <= 1 and not flag: flag = 'пробег не показан'
    if flag: why = flag
    if why: pass
    elif not allowed(mk, md, st): why = 'марка вне списка'
    elif not w: why = 'нет MMR и нет аналогов'
    elif 'sale' not in lot: why = 'мало похожих, оценка грубая'
    elif o <= 1: why = 'пробег не показан'
    elif g and float(g) < 2: why = 'оценка ниже 2'
    elif w + FEE > CAP: why = 'выше $13 500 со сбором'
    elif w + FEE < 1500: why = 'дешевле $1 500 со сбором'
    elif lot['prof'] < 500: why = 'прибыль ниже $500'
    lot['whyn'] = why
    k = 'ANA|' + run
    if not why:
        if lot['margin'] == 1000: lot['stat'] = 'Флип'; lot['flip'] = True; lot['F'] = 1; flip.append(k)
        else: lot['stat'] = 'Основная'; lot['flip'] = False; lot['C'] = 1; core.append(k)
    elif why.startswith('выше'): lot['stat'] = 'Дорого'
    if SEVEN.match(mk): lot['S'] = 1
    lots.append(lot)

n_est = sum(1 for l in lots if l['src'].startswith('оценка')); n_pmr = sum(1 for l in lots if l['w'] and not l['src'].startswith('оценка'))
n_cr = sum(1 for l in lots if (l.get('cr') or '').startswith('Отчёт:') and l['stat'] in ('Основная', 'Флип'))
n_fl = sum(1 for l in lots if l.get('floor') and l.get('max') is not None and l['floor'] > l['max'] and l['stat'] in ('Основная', 'Флип'))
n_mmr = sum(1 for l in lots if l['src'].startswith('MMR из'))
lead = ('AutoNation AA - Houston, пятница 13 ноября, 9:15. Каталог EDGE снят вечером 12 ноября: %d машин. '
        'MMR взят из пре-сейла EDGE у %d машин, у остальных оценён по похожим. В подборке %d машин.') % (len(lots), n_mmr, len(core) + len(flip))
how = ('<ul><li><b>Цена покупки.</b> MMR из пре-сейла EDGE (там показан Manheim MMR): %d машин. '
       'Где MMR нет, он оценён по похожим лотам прошлых торгов (та же модель, год ±3, пробег, комплектация) или взят PMR EDGE: %d машин, они помечены «≈».</li>'
       '<li><b>Ретейл и продажа.</b> Ретейл = MMR × отношение ретейла к MMR у похожих машин с прошлых торгов. Продажа = ретейл × 0,64, дороже $5 000 со сбором ещё −3%%, рама повреждена по отчёту ещё −15%%.</li>'
       '<li><b>Сбор.</b> $700 на машину. Прибыль: продажа − MMR − $700.</li>'
       '<li><b>Максимальная ставка.</b> Прибыль $1 000 при покупке до $5 000 со сбором, $1 500 при более дорогой. Потолок $13 500 со сбором.</li>'
       '<li><b>Марки.</b> Toyota, Honda, Hyundai, BMW, Volkswagen, Kia, Mercedes, Jeep, Dodge, Chrysler, Nissan, Lexus NX и RX, Chevrolet Camaro, Ford Escape и Explorer, Audi Q5, Q7 и S.</li>'
       '<li><b>Линия T</b> на этом аукционе неходячие: в подборку не попадают.</li>'
       '<li><b>Отчёты.</b> У машин подборки сняты отчёты EDGE (%d с отчётом): ход, рама, повреждения, floor price и book value. '
       'Убраны: не на ходу, шум двигателя, нет ключа, плохой ремонт кузова. Горящий Check Engine указан в карточке, но машина осталась.</li>'
       '<li><b>Floor price.</b> У %d машин подборки floor price выше нашей макс. ставки: дешевле floor price их, скорее всего, не отдадут.</li>'
       '<li><b>Чего я не проверил.</b> Carfax и AutoCheck не открывал. Свет и оценки утром могут измениться.</li></ul>') % (n_mmr, len(lots) - n_mmr, n_cr, n_fl)
out = {'id': date, 'label': '13 ноября', 'title': 'AutoNation AA Houston, пятница 13 ноября, 9:15', 'lead': lead, 'how': how,
       'lots': lots, 'core': core, 'flip': flip}
json.dump(out, open('data/%s.json' % date, 'w'), ensure_ascii=False, separators=(',', ':'))
import collections
print(len(lots), 'core', len(core), 'flip', len(flip), collections.Counter(l['whyn'] for l in lots).most_common(),
      'с w', sum(1 for l in lots if l['w']), 'PMR', sum(1 for l in lots if 'PMR EDGE $' in l['src'] and l['src'].startswith('пох')), 'past', sum(1 for l in lots if l.get('past')))
