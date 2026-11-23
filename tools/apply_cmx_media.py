#!/usr/bin/env python3
"""Фото и звук двигателя CarMax в data/<дата>.json.

Вход: tools/cmx_media_<дата>.txt   stock|audio-uuid|имена фото через запятую (FP3Q первым)
      tools/engine_audio_<дата>.txt stock|dur|rms|fire|reg|jit|kurt|kmax|hf|cent (engine_audio.js, без первых 10 с)
Пишет в лоты CarMax: pp — остальные фото (без FP3Q, оно уже в img), au — id записи, auk — оценка звука:
  -1 запись короткая, 0 ровно, 1 лёгкое тиканье, 2 стук сильнее, чем у 9 из 10 машин аукциона.
Запуск: python3 tools/apply_cmx_media.py 2026-11-24
"""
import json, re, sys

d = sys.argv[1]
media = {}
for l in open(f'tools/cmx_media_{d}.txt'):
    p = l.rstrip('\n').split('|')
    if len(p) >= 3:
        media[p[0]] = (p[1], [n for n in p[2].split(',') if n])
snd = {}
try:
    for l in open(f'tools/engine_audio_{d}.txt'):
        p = l.rstrip('\n').split('|')
        if len(p) == 10:
            snd[p[0]] = float(p[7]) if float(p[1]) >= 10 else None
        elif len(p) >= 2 and p[1] == 'short':
            snd[p[0]] = None
except FileNotFoundError:
    pass
vals = sorted(v for v in snd.values() if v is not None)
hi = vals[int(len(vals) * .9)] if vals else 99   # 90-й перцентиль по аукциону
hi = max(hi, 5.0)
mid = max(vals[int(len(vals) * .75)] if vals else 99, 4.2)

D = json.load(open(f'data/{d}.json'))
nph = nau = 0
for x in D['lots']:
    if x.get('auc') != 'CMX':
        continue
    m = re.search(r'/assets/(\d+)/', x.get('img') or '')
    if not m or m.group(1) not in media:
        continue
    st = m.group(1)
    au, names = media[st]
    main = re.search(r'/image/([^/?]+)\.jpg', x['img'])
    main = main.group(1) if main else 'FP3Q'
    pp = [n for n in names if n != main and n != 'hero']
    if pp:
        x['pp'] = pp; nph += 1
    for k in ('au', 'auk'):
        x.pop(k, None)
    if au:
        x['au'] = au; nau += 1
        km = snd.get(st, 'na')
        if km == 'na':
            pass
        elif km is None:
            x['auk'] = -1
        else:
            x['auk'] = 2 if km >= hi else 1 if km >= mid else 0
json.dump(D, open(f'data/{d}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
c = {}
for x in D['lots']:
    if 'auk' in x:
        c[x['auk']] = c.get(x['auk'], 0) + 1
print(f'фото: {nph} лотов, звук: {nau}, оценки {c}, пороги стук>={hi} тиканье>={mid}')
