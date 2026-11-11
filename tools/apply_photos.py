#!/usr/bin/env python3
"""Проставляет поле ph (фото EDGE) лотам даты из tools/photos_<дата>.txt (+ tools/photos_<дата>_fix.txt)."""
import json, os, sys
T = os.path.dirname(__file__)
date = sys.argv[1]
m = {}
for fn in ('photos_%s.txt' % date, 'photos_%s_fix.txt' % date):
    p = os.path.join(T, fn)
    if os.path.exists(p):
        for s in open(p).read().strip().split(';'):
            k, v = s.split('=')
            a, run = k.split(':', 1)
            key = ('H1C' if a == 'H' else 'AAA', run)
            if v.startswith('/'):
                m[key] = m.get(key, '') + v  # суффикс кадра, например /01
            else:
                m[key] = v
path = os.path.join(T, '..', 'data', date + '.json')
d = json.load(open(path))
n = 0
for l in d['lots']:
    v = m.get((l['auc'], l['run']))
    if v and not v.startswith('/'):
        l['ph'] = v
        n += 1
json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('фото:', n)
