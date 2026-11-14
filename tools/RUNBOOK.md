# Еженедельное расписание и автозагрузка

Аукционы повторяются каждую неделю. Запуск каждый вечер в ~19:00 по Хьюстону (вс–пт).

| Вечер (CT) | Пост-сейл за сегодня | Каталог на завтра |
|---|---|---|
| Пн | — | CarMax Conroe (вт 8:00): tools/build_cmx.py, API carmaxauctions.com, MMR оценка по похожим (Manheim не нужен); AAA North Houston (вт 12:15, Conroe): пре-сейл EDGE aaanorthhouston, код аукциона ANH, сборка по образцу build_ana.py |
| Вт | AAA North Houston (EDGE postsale aaanorthhouston); CarMax: итоги без цен (см. ниже) | AAA Central Houston (AAA, ср 11:45) + Houston's 1st Choice (H1C, ср 16:30): пре-сейл EDGE houstonaa, houstonsfcaa |
| Ср | AAA + H1C (EDGE postsale houstonaa, houstonsfcaa). H1C идёт с 16:30: если к 19:00 пост-сейл неполный, догрузить в чт вечером | AAA Houston (AAH), чт: пре-сейл EDGE aaahouston, tools/build_aah.py |
| Чт | AAH (EDGE postsale aaahouston) | AutoNation (ANA), пт: пре-сейл EDGE anaahouston, tools/build_ana.py |
| Пт | ANA (EDGE postsale anaahouston) | — |
| Вс | Еженедельно: перепроверить пост-сейлы прошлой недели (офферы, которые потом продались) и обновить data/<дата>.json | — |

Пост-сейл: JS в вкладке EDGE, `/components/report/postsale/ajax/<slug>/<y>/<m>/<d>?per_page=250&page=N`, строка `run:цена:S|I` → tools/postsale_<дата>.txt → `python3 tools/apply_postsale.py <дата>`.
Каталог EDGE: пре-сейл + vdp_api_details (floor, book, announcements, consignor) → tools/<auc>_raw/ann/detail_<дата>.txt → build_*.py.
После: data/index.json (version = sha1 data/20*.json, updated), запись в data/changelog.json, sw.js VERSION, commit, push, сообщение Максату.
Неходячие линии: AAA линия 7, AAH линия T, ANA линия T; CarMax — по пометке NO RUNNER.
Нужен вход в EDGE в Chrome Максата. Если не вошёл — попросить войти.
Время: CRON_TZ=America/Chicago, 18:47.

## CarMax: итоги и floor price
CarMax цены продажи не публикует. В открытой вкладке carmaxauctions.com:
- floor: GET /api/auction-event/v1/auction-events/{eventId}/run-list-items (eventId — из performance entries на странице vehicledetail любого лота) -> floorPrice.amount, runNumber, lane, StockNum.
- продана или нет: GET /api/shopping/auctions/vehicle?stockNum=N -> isSold.
Накануне торгов: tools/cmx_floor_<дата>.txt (run|stock|floor), после торгов: tools/cmx_status_<дата>.txt (run|stock|vin|floor|1/0), затем python3 tools/apply_cmx.py <дата>.

## Заметки перекупа/мастера
База по поколениям: tools/pro_notes.py. Сборщики (build_cmx/aah/ana) сами вызывают tools/apply_pro.py <дата>; для любой другой сборки запусти его вручную. Нет модели в базе — допиши запись E(...) в pro_notes.py.

## Пуши
- Новый аукцион и пост-сейл: .github/workflows/notify.yml сам при пуше data/index.json.
- «Скоро аукцион» за ~45 мин до начала: .github/workflows/soon.yml по расписанию SCHED в tools/notify.mjs. Поменялось время или аукцион — поправь SCHED.
