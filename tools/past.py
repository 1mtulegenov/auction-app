#!/usr/bin/env python3
"""ВНИМАНИЕ: для H1C и AAA Central точнее tools/edge_past.py (пост-сейл + No-Sale EDGE); запускать его после этого скрипта.
Пересчитывает историю машины на прошлых торгах (поле past) для всех дат в data/.

Источники:
  * каталоги прошлых дат в data/<дата>.json (полный VIN) + их итоги (пост-сейл, по аукциону и лоту);
  * старые пост-сейлы /mnt/project-files/auction-prices/sales.csv и sales_*.csv
    (только проданные, VIN обрезан до 10 знаков: сверяем ещё и пробег).
Совпадение только по 10 знакам VIN + пробегу (не больше 3000 миль разницы) помечается q=1 (вероятно та же машина).
Статусы: sold (продана, p = цена), offer (в пост-сейле нет: ушла на оффер и не отдали;
p = сумма оффера, если известна), gone (снята), cat (итогов этой площадки нет).
"""
import csv, glob, json, os, sys

D = os.path.join(os.path.dirname(__file__), '..', 'data')
PF = '/mnt/project-files/'
NAME = {'AAA': 'AAA Central', 'H1C': 'H1C', 'AAH': 'AAA Houston', 'ANA': 'AutoNation', 'CMX': 'CarMax',
        'AAA - Central Houston': 'AAA Central', 'AAA - Houston': 'AAA Houston', 'AAA - North Houston': 'AAA North',
        "Houston's 1st Choice": 'H1C', 'AutoNation AA - Houston': 'AutoNation'}


def num(v):
    try:
        return int(float(str(v).replace(',', '')))
    except Exception:
        return None


def main():
    idx = json.load(open(os.path.join(D, 'index.json')))
    dates = sorted(d['id'] for d in idx['dates'])
    days = {d: json.load(open(os.path.join(D, d + '.json'))) for d in dates}

    # 1) появления в каталогах прошлых дат
    seen = {}  # vin17 -> [entry]
    near = {}  # vin10 -> [entry] для VIN с опечаткой
    for d in dates:
        x = days[d]
        res = {}
        for r in x.get('results') or []:
            res['%s|%s' % (r.get('auc'), r.get('run'))] = r
        has_res = bool(res)
        for l in x['lots']:
            v = (l.get('vin') or '').upper()
            if len(v) != 17:
                continue
            r = res.get('%s|%s' % (l.get('auc'), l.get('run')))
            if r and r.get('vin10') and r['vin10'].upper() != v[:10]:
                r = None
            ss = (r or {}).get('ss') or l.get('ss')
            price = (r or {}).get('fact') or l.get('fact')
            if ss == 'gone':
                e = {'s': 'gone', 'p': None}
            elif ss == 'offer':
                e = {'s': 'offer', 'p': (r or {}).get('bnf') or l.get('bnf')}
            elif price and ss in (None, 'sold'):
                e = {'s': 'sold', 'p': price}
            elif has_res:
                e = {'s': 'offer', 'p': (r or {}).get('bnf') or l.get('bnf')}
            else:
                e = {'s': 'cat', 'p': None}
            e.update({'d': d, 'a': NAME.get(l.get('auc'), l.get('auc')), 'run': l.get('run'), 'o': l.get('o')})
            seen.setdefault(v, []).append(e)
            near.setdefault(v[:10], []).append(dict(e, v=v, q=1))

    # 2) старые пост-сейлы (только проданные)
    old = {}  # vin10 -> [entry]
    rows = []
    p = PF + 'auction-prices/sales.csv'
    if os.path.exists(p):
        for r in csv.DictReader(open(p, encoding='utf-8')):
            rows.append(((r.get('vin') or '')[:10], r))
    for f in sorted(glob.glob(PF + 'sales_*.csv')):
        for r in csv.DictReader(open(f, encoding='utf-8')):
            rows.append(((r.get('vin_prefix') or '')[:10], r))
    have = set()
    for v10, r in rows:
        v10 = v10.upper()
        if len(v10) != 10 or '*' in v10:
            continue
        k = (v10, r['sale_date'], r['run_number'])
        if k in have:
            continue
        have.add(k)
        old.setdefault(v10, []).append({'d': r['sale_date'], 'a': NAME.get(r['auction'], r['auction']), 'run': r['run_number'],
                                        'p': num(r.get('sale_price_usd')), 's': 'sold', 'o': num(r.get('odometer_mi')),
                                        'c': (r.get('color') or '').upper(), 'q': 1})

    stat = {}
    for d in dates:
        x = days[d]
        for l in x['lots']:
            v = (l.get('vin') or '').upper()
            if len(v) != 17:
                l.pop('past', None)
                continue
            odo = num(l.get('o'))
            P = [dict(e) for e in seen.get(v, []) if e['d'] < d]
            got = {(e['d'], e['run']) for e in P}
            for e in [q for q in near.get(v[:10], []) if q['v'] != v] + old.get(v[:10], []):
                if e['d'] >= d or (e['d'], e['run']) in got:
                    continue
                if any(q['d'] == e['d'] for q in P):
                    continue  # в этот день машина уже есть из каталога
                # VIN обрезан: та же машина, если пробег не больше нынешнего и разница небольшая
                lim = 500 if 'v' in e else 3000  # опечатка в полном VIN — пробег почти тот же
                if not (odo and e['o'] and 0 <= odo - num(e['o']) <= lim):
                    continue
                P.append(dict(e))
                got.add((e['d'], e['run']))
            P.sort(key=lambda e: e['d'])
            for e in P:
                e.pop('o', None)
                e.pop('c', None)
                e.pop('v', None)
            if P:
                l['past'] = P
                if d == dates[-1]:
                    for e in P:
                        stat[e['s']] = stat.get(e['s'], 0) + 1
            else:
                l.pop('past', None)
        json.dump(x, open(os.path.join(D, d + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    last = days[dates[-1]]
    print(dates[-1], 'машин с историей:', sum(1 for l in last['lots'] if l.get('past')), stat)


if __name__ == '__main__':
    main()
