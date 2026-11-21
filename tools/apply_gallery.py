#!/usr/bin/env python3
"""Все фото лота (галерея) из tools/<pfx>_ph_<дата>.txt: строки run|путь/кадр,путь/кадр…
Поле pp в data/<дата>.json: кадры; если первые два сегмента пути совпадают с ph — хранится только «id/кадр».
Запуск: python3 tools/apply_gallery.py <дата> <файл> [<файл>…]"""
import json, os, sys
T = os.path.dirname(os.path.abspath(__file__))
date = sys.argv[1]
m = {}
for fn in sys.argv[2:]:
    for line in open(fn, encoding='utf-8'):
        q = line.rstrip('\n').split('|')
        if len(q) < 2 or not q[1] or q[1] == 'ERR':
            continue
        m[q[0].replace(' ', '')] = [s for s in q[1].split(',') if s]
path = os.path.join(T, '..', 'data', date + '.json')
d = json.load(open(path, encoding='utf-8'))
n = 0
for l in d['lots']:
    ph = m.get(str(l.get('run', '')).replace(' ', ''))
    if not ph:
        continue
    pre = '/'.join(ph[0].split('/')[:2]) + '/'
    l['ph'] = ph[0]  # первый кадр — обложка
    if len(ph) > 1:
        l['pp'] = [s[len(pre):] if s.startswith(pre) else s for s in ph[1:]]
    n += 1
json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('галерея:', n, 'лотов')
