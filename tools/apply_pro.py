"""Ставит заметку перекупа/мастера (tools/pro_notes.py) в поле risk всех лотов. python3 tools/apply_pro.py [дата ...]"""
import glob, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from pro_notes import note
fs = ['data/%s.json' % d for d in sys.argv[1:]] or sorted(glob.glob('data/20*.json'))
for f in fs:
    D = json.load(open(f)); n = 0
    for l in D['lots']:
        t = note(l)
        if t: l['risk'] = t; n += 1
        else: l.pop('risk', None)
    json.dump(D, open(f, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f, n, len(D['lots']))
