# Как не затереть данные 11 ноября

После любой пересборки data/2026-11-11.json (build_data.py из hubN.html) обязательно повторить:

    python3 tools/edge_past.py tools/edge_dump_2026-11-11.txt 2026-11-11   # история по пост-сейлу/No-Sale EDGE
    python3 tools/apply_photos.py 2026-11-11                                # фото лотов с EDGE

Иначе пропадут правильная история (продана / ушла на оффер) и фото.
