#!/bin/sh
# Пересобрать приложение: данные из последнего дэшборда + новая версия сервис-воркера.
# Использование: sh tools/build.sh /mnt/project-files/hubN.html
set -e
cd "$(dirname "$0")/.."
python3 tools/build_data.py "$1" --out data
V=$(cat index.html app.css app.js manifest.webmanifest | sha1sum | cut -c1-10)
sed -i "s/^const VERSION = .*/const VERSION = '$V';/" sw.js
echo "Оболочка: $V"
