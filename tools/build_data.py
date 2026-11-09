#!/usr/bin/env python3
"""Собирает данные приложения из дэшборда (hubN.html с `const DATA={...}`) или из JSON.

Использование:
    python3 tools/build_data.py /mnt/project-files/hub9.html [--out data]

Пишет data/index.json (список дат и версия) и data/<дата>.json (лоты одной даты).
Лоты одной даты объединяются из all/core/flip/seven по ключу (аукцион, лот):
берутся самые подробные поля, а принадлежность к подборкам пишется в флаги.
"""
import argparse, datetime, hashlib, json, os, sys

PREF = ['core', 'flip', 'seven', 'all']  # чьи поля важнее при совпадении ключа


def load(path):
    s = open(path, encoding='utf-8').read()
    if path.endswith('.json'):
        return json.loads(s)
    i = s.find('const DATA=')
    if i < 0:
        sys.exit('В файле нет const DATA=')
    obj, _ = json.JSONDecoder().raw_decode(s, i + len('const DATA='))
    return obj


def key(r):
    return '%s|%s' % (r.get('auc', ''), r.get('run', ''))


def build_date(d):
    lots, order = {}, []
    for src in reversed(PREF):  # all -> seven -> flip -> core, поздние перекрывают
        for r in d.get(src) or []:
            k = key(r)
            if k not in lots:
                lots[k] = {}
                order.append(k)
            base = lots[k]
            for f, v in r.items():
                if v not in (None, '', False) or f not in base:
                    base[f] = v
    for src, flag in (('core', 'C'), ('flip', 'F'), ('seven', 'S')):
        for r in d.get(src) or []:
            lots[key(r)][flag] = 1
    # факт продажи из итогов, если в лоте его нет
    res = d.get('results') or []
    rmap = {key(r): r for r in res}
    for k, l in lots.items():
        r = rmap.get(k)
        if r:
            for f in ('fact', 'ss', 'rr', 'bnf'):
                if l.get(f) in (None, '') and r.get(f) not in (None, ''):
                    l[f] = r[f]
    out = {
        'id': d['id'], 'label': d.get('label', d['id']), 'title': d.get('title', ''),
        'lead': d.get('lead', ''), 'how': d.get('how', ''),
        'lots': [lots[k] for k in order],
        'core': [key(r) for r in d.get('core') or []],
        'flip': [key(r) for r in d.get('flip') or []],
    }
    if res:
        out['results'] = res
        out['stats'] = d.get('stats') or {}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'data'))
    a = ap.parse_args()
    data = load(a.src)
    os.makedirs(a.out, exist_ok=True)
    idx, h = [], hashlib.sha1()
    for d in data['dates']:
        b = build_date(d)
        txt = json.dumps(b, ensure_ascii=False, separators=(',', ':'))
        h.update(txt.encode())
        open(os.path.join(a.out, d['id'] + '.json'), 'w', encoding='utf-8').write(txt)
        idx.append({'id': b['id'], 'label': b['label'], 'title': b['title'], 'n': len(b['lots']),
                    'core': len(b['core']), 'flip': len(b['flip']), 'results': bool(b.get('results'))})
    now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
    index = {'version': h.hexdigest()[:10], 'updated': now.isoformat(), 'dates': idx}
    keep = {d['id'] + '.json' for d in data['dates']} | {'index.json'}
    for f in os.listdir(a.out):
        if f.endswith('.json') and f not in keep:
            os.remove(os.path.join(a.out, f))
    json.dump(index, open(os.path.join(a.out, 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('Готово:', len(idx), 'дат, версия', index['version'])


if __name__ == '__main__':
    main()
