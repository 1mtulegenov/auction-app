#!/usr/bin/env python3
"""CarMax Auctions Conroe -> data/<дата>.json.
Каталог: tools/cmx_<дата>.txt (из API CarMax): run|vin|год|марка|модель|компл.|пробег|привод|объём|цвет|пометки;|Select|branding|title status|время|топливо|id страницы
MMR и ретейл: tools/cmx_mmr_<дата>.txt (vin|mmr|ретейл, Manheim по VIN с поправкой на пробег). Где их нет — оценка по похожим лотам (est=1).
    python3 tools/build_cmx.py 2026-11-17
"""
import glob, json, math, os, re, sys, collections
date = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, 'build_ana.py')).read()
exec(src[src.index('FEE, CAP'):src.index('ANN = ann_load')], globals())  #:src.index('ANN = ann_load')])   # estimate, band, allowed, past, SEVEN, FEE, CAP

MMR = {}
try:
    for line in open('tools/cmx_mmr_%s.txt' % date):
        q = line.strip().split('|')
        if len(q) >= 3 and q[1]: MMR[q[0]] = (int(q[1]), int(q[2] or 0), q[3] if len(q) > 3 else '')
except FileNotFoundError:
    pass

TRA = [('MAJOR ENGINE DEFECT', 'серьёзный дефект двигателя'), ('MAJOR TRANSMISSION DEFECT', 'серьёзный дефект коробки'),
       ('MAJOR TRANSFER CASE DEFECT', 'дефект раздатки'), ('MAJOR DIFFERENTIAL DEFECT', 'дефект дифференциала'),
       ('NO RUNNER', 'не на ходу'), ('STRUCTURAL DAMAGE DUE TO PERFORATED RUST', 'кузов/рама сгнили (structural)'),
       ('STRUCTURAL DAMAGE', 'повреждение кузова/рамы (structural)'), ('STRUCTURAL ALTERATIONS', 'переделка кузова/рамы'),
       ('HANDICAPPED ACCESSIBLE/STRUCTURAL ALTERATIONS', 'переделка для инвалидов'), ('HAIL DAMAGE', 'град'),
       ('NOT ACTUAL MILES', 'пробег не настоящий'), ('PRIOR THEFT HISTORY', 'угон в истории'), ('THEFT RECOVERY', 'найдена после угона'),
       ('MISSING OR DEPLOYED AIRBAG PER EVDH', 'подушки раскрыты или нет'), ('TOTAL LOSS HISTORY', 'тотал в истории'),
       ('SALVAGE HISTORY', 'salvage в истории'), ('REBUILT HISTORY', 'rebuilt в истории'), ('MAJOR DAMAGE HISTORY', 'серьёзное ДТП в истории'),
       ('PRIOR RENTAL', 'бывшая прокатная'), ('PRIOR FLEET', 'флотская'), ('REPO', 'изъята за долги'), ('TITLE ABSENT', 'тайтла нет на месте'),
       ('ARBX PLUS', 'ARBX Plus (расширенный арбитраж)'), ('AFTERMARKET MECHANICAL MODIFICATIONS', 'тюнинг механики'),
       ('ALTERED SUSPENSION', 'изменена подвеска'), ('MAJOR SUNROOF DEFECT', 'дефект люка'), ('MISSING CATALYTIC CONV', 'нет катализатора'),
       ("MAJOR MECH CONV'T TOP DEFECT", 'дефект крыши кабриолета'), ('LOGO / DECAL DISCREPANCY', 'шильдики не соответствуют'),
       ('VEHICLE WRAP', 'машина в плёнке')]
TRD = dict(TRA)
def ru(a): return '; '.join(TRD.get(t, t.lower()) for t in a)

lots, core, flip = [], [], []
for line in open('tools/cmx_%s.txt' % date):
    p = line.rstrip('\n').split('|')
    if len(p) < 17: continue
    run, vin, y, mk, md, trim, odo, drv, disp, col, ann, sel, brand, tstat, at, fuel, pid = p[:17]
    stock, nimg = (p[17], int(p[18] or 0)) if len(p) > 18 else ('', 0)
    y, o = int(y), int(odo or 0)
    A = [t for t in ann.split(';') if t]
    lot = {'run': run, 'auc': 'CMX', 'y': y, 'mk': mk, 'md': md, 'st': trim, 'c': (col or '').upper(), 'o': o, 'l': '', 'g': '',
           't': 'Title Absent' if 'TITLE ABSENT' in A else 'At Auction', 'a': '; '.join(A), 'ar': ru(A), 's': '', 'vin': vin, 'bn': None,
           'tr': ' '.join(x for x in (trim, drv if drv != 'N/A' else '', disp) if x), 'eng': disp, 'drv': drv if drv != 'N/A' else '',
           'cls': 'clean', 'hist': False, 'w': None, 'r': None, 'stat': 'Нет', 'whyn': '', 'cons': 'CarMax',
           'sel': sel == '1', 'arbx': 'ARBX PLUS' in A, 'ttl': 'Clean title' if brand == 'NONE' else '', 'ttlbad': False,
           'u': 'https://www.carmaxauctions.com/public-landing/' + pid}
    if stock and nimg: lot['img'] = 'https://img2.carmax.com/assets/%s/image/FP3Q.jpg?width=640' % stock
    if fuel and fuel != 'Gas': lot['eng'] = (disp + ' ' if disp and disp != '0.0L' else '') + {'Electric': 'электро', 'Diesel': 'дизель', 'Plug-in Hybrid': 'плагин-гибрид', 'Electric and Gas Hybrid': 'гибрид'}.get(fuel, fuel)
    pr = prof_by_model.get((nmk(mk), nmd(md)))
    if pr:
        for f in ('risk', 'demand', 'sell'): lot[f] = pr.get(f)
    P = past(vin)
    if P: lot['past'] = P
    prev = [d for d, kk in vins.get(vin, []) if d < date and kk.startswith('CMX|')]
    if prev: lot['seen'] = '%d ноября (CarMax)' % int(prev[-1][8:])
    # пометки CarMax
    mech = [t for t in A if re.search(r'ENGINE DEFECT|TRANSMISSION DEFECT|TRANSFER CASE DEFECT|DIFFERENTIAL DEFECT', t)]
    lot['mech'] = bool(mech)
    k, flag = 1.0, ''
    if any(re.search(r'SALVAGE|REBUILT|TOTAL LOSS', t) for t in A):
        lot['cls'] = 'salvage'; lot['ttl'] = 'Salvage/rebuilt/тотал в истории'; lot['ttlbad'] = True; flag = 'salvage, rebuilt или тотал'
    if 'NO RUNNER' in A: lot['cls'] = 'noinop'; flag = flag or 'не на ходу'
    if mech: flag = flag or 'объявлен дефект двигателя/КПП'
    if any(re.search(r'NOT ACTUAL MILES|AIRBAG', t) for t in A): lot['hist'] = True; flag = flag or ('пробег не настоящий' if 'NOT ACTUAL MILES' in A else 'подушки раскрыты')
    if any(re.search(r'STRUCTURAL|HAIL|MAJOR DAMAGE', t) for t in A): lot['hist'] = True; k *= 0.85
    if any('THEFT' in t for t in A): lot['hist'] = True; k *= 0.92
    if 'PRIOR RENTAL' in A: k *= 0.97
    if 'MISSING CATALYTIC CONV' in A: flag = flag or 'нет катализатора'
    if lot['hist'] and lot['cls'] == 'clean': lot['cls'] = 'hist'
    # цена
    rough = False
    if vin in MMR:
        w, ret, trm = MMR[vin]
        if not ret: ret = w * band(w)
        lot['src'] = 'Manheim MMR по VIN с поправкой на пробег' + (' (%s)' % trm if trm else '')
        if trm: lot['tr'] = trm
    else:
        r = estimate(y, mk, md, trim, o)
        if r:
            w, ret, rows, conf = r
            ex = ', '.join('%s %s %s — $%s' % (l['y'], l['md'], (l.get('st') or '').split(' ')[0], format(int(l['w']), ',')) for _, _, l in rows[:3])
            lot['src'] = 'оценка по %d похожим лотам, без Manheim (%s)' % (len(rows), ex)
            rough = conf < 0.5 or min(abs(y - int(l['y'])) for _, _, l in rows) >= 3
            if rough: lot['src'] += '; похожих мало, оценка грубая'
        else:
            w = ret = None; lot['src'] = 'похожих лотов нет, MMR не оценён'
        lot['est'] = 1
    if w:
        w = round(w / 25) * 25; ret = round(ret / 50) * 50
        lot['w'], lot['r'] = w, ret
        if not rough:
            sale = ret * 0.64 * (0.97 if w + FEE > 5000 else 1) * k
            sale = round(sale / 50) * 50
            margin = 1000 if w + FEE <= 5000 else 1500
            lot.update({'sale': sale, 'prof': sale - w - FEE, 'margin': margin,
                        'max': max(0, min(sale - FEE - margin, (CAP if margin >= 1500 else 5000) - FEE))})
    why = flag
    if why: pass
    elif not allowed(mk, md, trim): why = 'марка вне списка'
    elif not w: why = 'нет MMR и нет аналогов'
    elif 'sale' not in lot: why = 'мало похожих, оценка грубая'
    elif o <= 1: why = 'пробег не показан'
    elif w + FEE > CAP: why = 'выше $13 500 со сбором'
    elif w + FEE < 1500: why = 'дешевле $1 500 со сбором'
    elif lot['prof'] < 500: why = 'прибыль ниже $500'
    lot['whyn'] = why
    key = 'CMX|' + run
    if not why:
        if lot['margin'] == 1000: lot['stat'] = 'Флип'; lot['flip'] = True; lot['F'] = 1; flip.append(key)
        else: lot['stat'] = 'Основная'; lot['flip'] = False; lot['C'] = 1; core.append(key)
    elif why.startswith('выше'): lot['stat'] = 'Дорого'
    if SEVEN.match(mk): lot['S'] = 1
    lots.append(lot)

n_m = sum(1 for l in lots if not l.get('est') and l['w'])
lead = ('CarMax Auctions Conroe, вторник 17 ноября, 8:00 CT. Каталог снят 13 ноября: %d машин. '
        + ('MMR и ретейл Manheim по VIN у %d машин.' % n_m if n_m else 'MMR пока оценён по похожим лотам прошлых торгов (помечен «≈»), Manheim подтяну после входа.')
        + ' В подборке %d машин.') % (len(lots), len(core) + len(flip))
how = ('<ul><li><b>Аукцион.</b> CarMax Auctions, площадка Conroe, дорожки A и B, старт во вторник 17 ноября в 8:00 CT. Ставить можно заранее на сайте.</li>'
       '<li><b>Цена покупки.</b> ' + ('Adjusted MMR Manheim по VIN с поправкой на пробег.' if n_m else 'Оценка MMR по похожим лотам прошлых торгов (та же модель, год ±3, пробег); Manheim будет добавлен позже.') + '</li>'
       '<li><b>Продажа.</b> Ретейл × 0,64, дороже $5 000 со сбором ещё −3%. Structural, град, серьёзное ДТП −15%, угон −8%, прокат −3%. Сбор $700.</li>'
       '<li><b>Максимальная ставка.</b> Прибыль $1 000 при покупке до $5 000 со сбором, $1 500 при более дорогой. Потолок $13 500.</li>'
       '<li><b>Пометки CarMax.</b> Света и оценок нет, CarMax сам объявляет дефекты. Не в подборке: дефект двигателя, коробки, раздатки или дифференциала; не на ходу; salvage, rebuilt, тотал; ненастоящий пробег; раскрытые подушки. «Title absent» значит, что продать можно только после получения тайтла.</li>'
       '<li><b>Чего я не проверил.</b> AutoCheck и отзывы NHTSA по лотам не открывал, фото не разбирал.</li></ul>')
out = {'id': date, 'label': '17 ноября', 'title': 'CarMax Conroe, вторник 17 ноября, 8:00', 'lead': lead, 'how': how, 'lots': lots, 'core': core, 'flip': flip}
json.dump(out, open('data/%s.json' % date, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(lots), 'core', len(core), 'flip', len(flip), 'manheim', n_m, collections.Counter(l['whyn'] for l in lots).most_common(8))

import subprocess as _sp; _sp.run(['python3', 'tools/apply_pro.py', date])
