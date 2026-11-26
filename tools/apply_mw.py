"""MMR Manheim по VIN с пробегом в лоты дня (поля mw, mr) и сводка: расчётный MMR против Manheim и против постсейла.
    python3 tools/apply_mw.py 2026-11-25 выгрузка.txt
Выгрузка: записи через ';' вида ключ|MMR с поправкой|ретейл|вариантов; ключ = индекс лота среди лотов с VIN (или aN = AAA 1-000N)."""
import re,json,sys
m=open(sys.argv[2]).read().strip()
p='data/%s.json' % sys.argv[1]; D=json.load(open(p))
L=[l for l in D['lots'] if l.get('vin') and len(l['vin'])==17]
byrun={l['run']:l for l in D['lots'] if l['auc']=='AAA'}
n=0;miss=[]
for l in D['lots']: l.pop('mw',None); l.pop('mr',None)
for e in m.split(';'):
    k,w,r,c=e.split('|')
    lot=byrun.get('1-%04d'%int(k[1:])) if k.startswith('a') else L[int(k)]
    if lot is None: miss.append(k); continue
    if w: lot['mw']=int(w); n+=1
    if r: lot['mr']=int(r)
print('set',n,'miss',miss)
json.dump(D,open(p,'w'),ensure_ascii=False,separators=(',',':'))
import statistics as st
def med(a): return round(100*st.median(a)) if a else None
for auc in ['AAA','H1C','AAH',None]:
  S=[l for l in D['lots'] if l.get('mw') and l.get('w') and .3<l['w']/l['mw']<3 and (auc is None or l['auc']==auc)]
  so=[l for l in S if l.get('ss')=='sold' and l.get('fact') and .4<l['fact']/l['mw']<2]
  print(auc,len(S),'calc/man',med([l['w']/l['mw'] for l in S]),'|dev|',med([abs(l['w']/l['mw']-1) for l in S]),
   'sold',len(so),'fact/man',med([l['fact']/l['mw'] for l in so]),'fact/calc',med([l['fact']/l['w'] for l in so]),
   'errM',med([abs(l['mw']-l['fact'])/l['fact'] for l in so]),'errC',med([abs(l['w']-l['fact'])/l['fact'] for l in so]),
   'closerM',sum(abs(l['mw']-l['fact'])<abs(l['w']-l['fact']) for l in so))
  for tag,f in (('edge',lambda l: not l.get('est')),('est',lambda l: l.get('est'))):
    g=[l for l in S if f(l)]
    if g: print('   ',tag,len(g),'|dev|',med([abs(l['w']/l['mw']-1) for l in g]),'calc/man',med([l['w']/l['mw'] for l in g]))
