"""Пометки аукциона (announcements EDGE) для всех аукционов: перевод и влияние на решение.
Строка файла tools/<auc>_ann_<дата>.txt: run|announcements через «; »|продавец
    from ann import load, apply
"""
import re

RU = [
    (r'\(A\)\s*', ''), (r'Parts Only', 'только на запчасти'), (r'Total Loss', 'тотал (страховая потеря)'), (r'Salvage', 'salvage'),
    (r'Rebuilt', 'восстановлена после тотала (rebuilt)'), (r'Bonded Title', 'бондовый тайтл (bonded)'), (r'No Title', 'нет тайтла'),
    (r'Bill Of Sale Only', 'только bill of sale'), (r'Theft Recovery', 'найдена после угона'), (r'Theft', 'угон в истории'),
    (r'Structural Alter', 'переделка кузова/рамы'), (r'Structural Damage', 'повреждение кузова/рамы'), (r'Prior Rental', 'бывшая прокатная'),
    (r'^Rental$', 'прокатная'), (r'Lemon', 'лимон (заводской брак, выкуп производителем)'), (r'Canadian Import', 'из Канады'),
    (r'True Miles Unkn', 'пробег не подтверждён'), (r'Odometer In Kilometers', 'одометр в километрах'), (r'Odometer Inoperable', 'одометр не работает'),
    (r'Water Intrusion', 'была вода в салоне'), (r'Airbags Deployed', 'подушки раскрыты'), (r'Non-Runner', 'не на ходу'),
    (r'Title Present', 'тайтл на месте'), (r'Green Light 7 ?Day Gty', 'зелёный свет: 7 дней гарантии на двигатель и коробку'),
    (r'Yellow Light 7 ?Day Ltd Gty', 'жёлтый свет: ограниченная гарантия 7 дней'), (r'^Green Light$', 'зелёный свет'),
    (r'Flood', 'утопленник'), (r'Hail', 'град'), (r'Frame Damage', 'повреждение рамы'), (r'Repo', 'изъята за долги'), (r'Fleet', 'корпоративная (была в автопарке компании)'),
]
def ru(a):
    out = []
    for t in [x.strip() for x in re.split(r';\s*', a or '') if x.strip()]:
        r = t
        for p, q in RU:
            r = re.sub(p, q, r, flags=re.I) if p.startswith('^') else re.sub(p, q, r, flags=re.I)
        out.append(r)
    return '; '.join(out)

def load(path):
    D = {}
    try:
        for line in open(path):
            q = line.rstrip('\n').split('|')
            if len(q) >= 2: D[q[0]] = (q[1], q[2] if len(q) > 2 else '')
    except FileNotFoundError:
        pass
    return D

# что пометка значит для покупки: (регулярка, исключить из подборки, множитель цены продажи, класс, флаг)
RULES = [
    (r'Parts Only|Total Loss|Salvage|Rebuilt|Bonded|No Title|Bill Of Sale', 'тотал/salvage или проблемный тайтл', None, 'salvage'),
    (r'Lemon', 'лимон (заводской брак) в истории', None, 'hist'),
    (r'True Miles Unkn|Odometer Inoperable|Not Actual', 'пробег не подтверждён', None, 'hist'),
    (r'Water Intrusion|Flood', 'была вода/утопленник', None, 'hist'),
    (r'Airbags Deployed', 'подушки раскрыты', None, 'hist'),
    (r'Non-Runner', 'не на ходу', None, 'noinop'),
    (r'Structural|Frame Damage', None, 0.85, 'hist'),
    (r'Theft', None, 0.92, 'hist'),
    (r'Canadian Import|Kilometers', None, 0.90, 'hist'),
    (r'Rental', None, 0.97, None),
]
def apply(lot, a, cons=''):
    """Возвращает причину исключения из подборки или ''. Меняет lot: a, ar, cls/hist, свет, тайтл, продавец, множитель цены."""
    if cons and not lot.get('cons'): lot['cons'] = cons
    if not a: return ''
    lot['a'] = a; lot['ar'] = ru(a)
    if re.search(r'Title Present', a, re.I): lot['t'] = 'At Auction'
    if re.search(r'Green Light', a, re.I): lot['l'] = 'Green'
    elif re.search(r'Yellow Light', a, re.I) and lot.get('l') != 'Red': lot['l'] = 'Yellow'
    why, k = '', 1.0
    for rx, ex, mult, cls in RULES:
        if not re.search(rx, a, re.I): continue
        if cls == 'salvage': lot['cls'] = 'salvage'; lot['ttl'] = ru(a).split('; ')[0]; lot['ttlbad'] = True
        elif cls == 'noinop': lot['cls'] = 'noinop'
        elif cls == 'hist' and lot.get('cls') == 'clean': lot['cls'] = 'hist'
        if cls == 'hist': lot['hist'] = True
        if ex and not why: why = 'пометка аукциона: ' + ex
        if mult: k *= mult
    lot['_annk'] = k
    return why
