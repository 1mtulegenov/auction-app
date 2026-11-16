"""Влить каталог второго аукциона в день: python3 tools/merge_day.py <дата> tools/<auc>_out_<дата>.json "Заголовок дня"
Лоты этого аукциона в data/<дата>.json заменяются, core/flip/lead/how дописываются."""
import json, sys
date, src = sys.argv[1], sys.argv[2]
title = sys.argv[3] if len(sys.argv) > 3 else None
p = 'data/%s.json' % date
D, N = json.load(open(p)), json.load(open(src))
auc = N['lots'][0]['auc']
D['lots'] = [l for l in D['lots'] if l['auc'] != auc] + N['lots']
for k in ('core', 'flip'):
    D[k] = [x for x in D.get(k, []) if not str(x).startswith(auc + '|')] + N.get(k, [])
mark = '<!--' + auc + '-->'
key = N['lead'][:25]
D['lead'] = (D['lead'].split(' ' + key)[0] if key in D['lead'] else D['lead']) + ' ' + N['lead']
D['how'] = D['how'].split(mark)[0] + mark + '<p><b>' + N['title'] + '</b></p>' + N['how']
if title: D['title'] = title
json.dump(D, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
print(p, len(D['lots']), 'core', len(D['core']), 'flip', len(D['flip']))
