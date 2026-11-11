/* Переводы интерфейса. Ключ — русский текст, значения: en, uk, es, kk. */
const LANGS = [['en','🇺🇸','English'],['ru','🇷🇺','Русский'],['uk','🇺🇦','Українська'],['es','🇪🇸','Español'],['kk','🇰🇿','Қазақша']];
const LANG = (() => { try { const v = JSON.parse(localStorage.getItem('lang') || 'null'); if (v) return v; if (localStorage.getItem('data-ver')) return 'ru'; } catch (e) {} const n = (navigator.language || 'ru').slice(0, 2).toLowerCase(); return ['en','ru','uk','es','kk'].includes(n) ? n : 'en'; })();
const LOCALE = { en: 'en-US', ru: 'ru-RU', uk: 'uk-UA', es: 'es-US', kk: 'kk-KZ' }[LANG];
const LI = { en: 0, uk: 1, es: 2, kk: 3 }[LANG];
document.documentElement.lang = LANG;
const I18N = {
"ретейл, оценка": ["retail, estimate", "ретейл, оцінка", "retail, estimado", "ретейл, бағалау"],
"MMR, оценка": ["MMR, estimate", "MMR, оцінка", "MMR, estimado", "MMR, бағалау"],
"Новый лот: Manheim ещё не смотрели. MMR и ретейл оценены по похожим машинам с прошлых торгов.": ["New lot: not checked on Manheim yet. MMR and retail are estimated from similar cars at past auctions.", "Новий лот: Manheim ще не дивилися. MMR і ретейл оцінені за схожими машинами з минулих торгів.", "Lote nuevo: aún no se revisó en Manheim. MMR y retail estimados según autos similares de subastas pasadas.", "Жаңа лот: Manheim әлі қаралмады. MMR мен ретейл өткен саудалардағы ұқсас көліктер бойынша бағаланды."],
"Заметка сохранена": ["Note saved", "Нотатку збережено", "Nota guardada", "Жазба сақталды"],
"Сохранить": ["Save", "Зберегти", "Guardar", "Сақтау"],
"Наведите полосу на строку VIN.": ["Point the strip at the VIN line.", "Наведіть смугу на рядок VIN.", "Apunte la franja a la línea del VIN.", "Жолақты VIN жолына бағыттаңыз."],
"Наведите полосу на строку VIN или штрихкод.": ["Point the strip at the VIN line or barcode.", "Наведіть смугу на рядок VIN або штрихкод.", "Apunte la franja a la línea del VIN o al código de barras.", "Жолақты VIN жолына немесе штрихкодқа бағыттаңыз."],
"турбо": ["turbo", "турбо", "turbo", "турбо"],
"дизель": ["diesel", "дизель", "diésel", "дизель"],
"электро": ["electric", "електро", "eléctrico", "электр"],
"Ретейл": ["Retail","Ритейл","Minorista","Ретейл"],
"Наверх": ["Back to top","Нагору","Arriba","Жоғарыға"],
"ушла на оффер за": ["went to offer at", "пішла на офер за", "fue a oferta por", "офферге кетті, бағасы"],
"Не отдали": ["Not sold", "Не віддали", "No la vendieron", "Берілмеді"],
"Неходячая: прибыль не считаем": ["Non-running: no profit calc", "Неходова: прибуток не рахуємо", "No arranca: sin cálculo de ganancia", "Жүрмейді: пайда есептелмейді"],
"Неходячая машина: прибыль, цену продажи и макс. ставку не считаем, только MMR.": ["Non-running car: no profit, resale price or max bid, MMR only.", "Неходова машина: прибуток, ціну продажу й макс. ставку не рахуємо, лише MMR.", "Auto que no arranca: sin ganancia, precio de venta ni puja máxima, solo MMR.", "Жүрмейтін көлік: пайда, сату бағасы мен макс. ставка есептелмейді, тек MMR."],
"Установить на компьютер": ["Install on computer", "Встановити на комп'ютер", "Instalar en la computadora", "Компьютерге орнату"],
"отдельное окно и иконка на рабочем столе": ["own window and a desktop icon", "окреме вікно та іконка на робочому столі", "ventana propia e icono en el escritorio", "жеке терезе және жұмыс үстеліндегі белгіше"],
"Windows и Mac, без магазина приложений": ["Windows and Mac, no app store", "Windows і Mac, без магазину застосунків", "Windows y Mac, sin tienda de apps", "Windows және Mac, қолданбалар дүкенінсіз"],
"Нажмите кнопку, и «Аукционы» откроются в отдельном окне, а иконка появится на рабочем столе и в меню «Пуск» или в Dock.": ["Press the button and Auctions will open in its own window, with an icon on the desktop and in the Start menu or Dock.", "Натисніть кнопку, і «Аукціони» відкриються в окремому вікні, а іконка з'явиться на робочому столі та в меню «Пуск» або в Dock.", "Pulse el botón y Subastas se abrirá en su propia ventana, con un icono en el escritorio y en el menú Inicio o el Dock.", "Батырманы басыңыз, «Аукциондар» жеке терезеде ашылады, белгіше жұмыс үстелінде және «Бастау» мәзірінде немесе Dock-та пайда болады."],
"Компьютер: Chrome или Edge": ["Computer: Chrome or Edge", "Комп'ютер: Chrome або Edge", "Computadora: Chrome o Edge", "Компьютер: Chrome немесе Edge"],
" или ": [" or ", " або ", " o ", " немесе "],
"Нажмите значок установки ⊕ справа в адресной строке.": ["Click the install icon ⊕ on the right of the address bar.", "Натисніть значок встановлення ⊕ праворуч в адресному рядку.", "Haga clic en el icono de instalar ⊕ a la derecha de la barra de direcciones.", "Мекенжай жолының оң жағындағы ⊕ орнату белгішесін басыңыз."],
"Если значка нет: меню ⋮ → «Трансляция, сохранение и отправка» → «Установить страницу как приложение». В Edge: ⋯ → «Приложения» → «Установить этот сайт как приложение».": ["No icon? Menu ⋮ → “Cast, save, and share” → “Install page as app”. In Edge: ⋯ → “Apps” → “Install this site as an app”.", "Немає значка: меню ⋮ → «Трансляція, збереження й надсилання» → «Установити сторінку як застосунок». В Edge: ⋯ → «Програми» → «Інсталювати цей сайт як програму».", "¿Sin icono? Menú ⋮ → «Enviar, guardar y compartir» → «Instalar página como aplicación». En Edge: ⋯ → «Aplicaciones» → «Instalar este sitio como aplicación».", "Белгіше жоқ болса: ⋮ мәзірі → «Трансляциялау, сақтау және бөлісу» → «Бетті қолданба ретінде орнату». Edge-де: ⋯ → «Қолданбалар» → «Бұл сайтты қолданба ретінде орнату»."],
"Меню «Файл» → «Добавить в Dock».": ["File menu → “Add to Dock”.", "Меню «Файл» → «Додати в Dock».", "Menú Archivo → «Añadir al Dock».", "«Файл» мәзірі → «Dock-қа қосу»."],
"чёрный": [
"black",
"чорний",
"negro",
"қара"
],
"белый": [
"white",
"білий",
"blanco",
"ақ"
],
"серый": [
"gray",
"сірий",
"gris",
"сұр"
],
"серебристый": [
"silver",
"сріблястий",
"plateado",
"күміс"
],
"красный": [
"red",
"червоний",
"rojo",
"қызыл"
],
"синий": [
"blue",
"синій",
"azul",
"көк"
],
"коричневый": [
"brown",
"коричневий",
"marrón",
"қоңыр"
],
"бежевый": [
"beige",
"бежевий",
"beige",
"бежевый"
],
"золотистый": [
"gold",
"золотистий",
"dorado",
"алтын түсті"
],
"зелёный": [
"green",
"зелений",
"verde",
"жасыл"
],
"фиолетовый": [
"purple",
"фіолетовий",
"morado",
"күлгін"
],
"бордовый": [
"burgundy",
"бордовий",
"burdeos",
"қою қызыл"
],
"оранжевый": [
"orange",
"помаранчевий",
"naranja",
"қызғылт сары"
],
"жёлтый": [
"yellow",
"жовтий",
"amarillo",
"сары"
],
"бирюзовый": [
"teal",
"бірюзовий",
"turquesa",
"көгілдір"
],
"Salvage, rebuilt или без тайтла": [
"Salvage, rebuilt or no title",
"Salvage, rebuilt або без тайтлу",
"Salvage, rebuilt o sin título",
"Salvage, rebuilt немесе тайтлсыз"
],
"Не на ходу или нет ключа": [
"Not running or no key",
"Не на ходу або немає ключа",
"No arranca o sin llave",
"Жүрмейді немесе кілт жоқ"
],
"Пометка на чистом тайтле": [
"Flag on a clean title",
"Позначка на чистому тайтлі",
"Aviso con título limpio",
"Таза тайтлдағы белгі"
],
"Без пометок": [
"No flags",
"Без позначок",
"Sin avisos",
"Белгісіз"
],
"Основная": [
"Main",
"Основна",
"Principal",
"Негізгі"
],
"Флип": [
"Flip",
"Фліп",
"Flip",
"Флип"
],
"Дорого": [
"Pricey",
"Дорого",
"Caro",
"Қымбат"
],
"Продана": [
"Sold",
"Продано",
"Vendido",
"Сатылды"
],
"Buy Now / оффер": [
"Buy Now / offer",
"Buy Now / офер",
"Buy Now / oferta",
"Buy Now / ұсыныс"
],
"Не продана": [
"Not sold",
"Не продано",
"No vendido",
"Сатылмады"
],
"Снята": [
"Withdrawn",
"Знято",
"Retirado",
"Алынып тасталды"
],
"Снова на торгах": [
"Back on auction",
"Знову на торгах",
"De nuevo en subasta",
"Қайтадан саудада"
],
"Данные обновлены:": [
"Data updated:",
"Дані оновлено:",
"Datos actualizados:",
"Деректер жаңартылды:"
],
"высокий": [
"high",
"високий",
"alta",
"жоғары"
],
"средний": [
"medium",
"середній",
"media",
"орташа"
],
"низкий": [
"low",
"низький",
"baja",
"төмен"
],
"Дефект двигателя/КПП": [
"Engine/transmission defect",
"Дефект двигуна/КПП",
"Defecto de motor/transmisión",
"Қозғалтқыш/беріліс ақауы"
],
"Зелёный свет": [
"Green light",
"Зелене світло",
"Luz verde",
"Жасыл жарық"
],
"Красный свет": [
"Red light",
"Червоне світло",
"Luz roja",
"Қызыл жарық"
],
"Жёлтый свет": [
"Yellow light",
"Жовте світло",
"Luz amarilla",
"Сары жарық"
],
"Salvage / без тайтла": [
"Salvage / no title",
"Salvage / без тайтлу",
"Salvage / sin título",
"Salvage / тайтлсыз"
],
"Продана за": [
"Sold for",
"Продано за",
"Vendido por",
"Сатылған бағасы"
],
"% от MMR": [
"% of MMR",
"% від MMR",
"% del MMR",
"% MMR-ден"
],
". Прибыль была бы": [
". Profit would have been",
". Прибуток був би",
". La ganancia habría sido",
". Пайда болар еді"
],
". Наша ставка брала.": [
". Our max bid would have won.",
". Наша ставка виграла б.",
". Nuestra puja máxima habría ganado.",
". Біздің мөлшерлеме жетер еді."
],
". Наша ставка не брала.": [
". Our max bid would not have won.",
". Наша ставка не виграла б.",
". Nuestra puja máxima no habría ganado.",
". Біздің мөлшерлеме жетпес еді."
],
", лот": [
", lot",
", лот",
", lote",
", лот"
],
"Брать": [
"Buy",
"Брати",
"Comprar",
"Алу"
],
"Тайтла нет на площадке": [
"Title not at auction",
"Тайтлу немає на майданчику",
"Título no está en la subasta",
"Тайтл алаңда жоқ"
],
"Не на ходу / нет ключа": [
"Not running / no key",
"Не на ходу / немає ключа",
"No arranca / sin llave",
"Жүрмейді / кілт жоқ"
],
"История:": [
"History:",
"Історія:",
"Historial:",
"Тарих:"
],
"Серьёзное ДТП в истории": [
"Serious accident in history",
"Серйозна ДТП в історії",
"Accidente grave en el historial",
"Тарихта ауыр жол апаты"
],
"Пометка в истории": [
"History flag",
"Позначка в історії",
"Aviso en el historial",
"Тарихтағы белгі"
],
"Оценка": [
"Grade",
"Оцінка",
"Grado",
"Баға"
],
"В избранное": [
"Add to favorites",
"В обране",
"A favoritos",
"Таңдаулыға"
],
"Макс. ставка": [
"Max bid",
"Макс. ставка",
"Puja máx.",
"Макс. мөлшерлеме"
],
"Прибыль": [
"Profit",
"Прибуток",
"Ganancia",
"Пайда"
],
"Все": [
"All",
"Усі",
"Todos",
"Барлығы"
],
"★ Избранное": [
"★ Favorites",
"★ Обране",
"★ Favoritos",
"★ Таңдаулы"
],
"Подборка": [
"Picks",
"Добірка",
"Selección",
"Іріктеме"
],
"7 марок": [
"7 brands",
"7 марок",
"7 marcas",
"7 марка"
],
"Тайтл на месте": [
"Title at auction",
"Тайтл на місці",
"Título en la subasta",
"Тайтл орнында"
],
"С заметкой": [
"With note",
"З нотаткою",
"Con nota",
"Жазбасы бар"
],
"Сначала подборка": [
"Picks first",
"Спершу добірка",
"Selección primero",
"Алдымен іріктеме"
],
"Прибыль больше": [
"Highest profit",
"Більший прибуток",
"Mayor ganancia",
"Пайда көбірек"
],
"MMR меньше": [
"Lowest MMR",
"MMR менше",
"MMR menor",
"MMR азырақ"
],
"MMR больше": [
"Highest MMR",
"MMR більше",
"MMR mayor",
"MMR көбірек"
],
"По номеру лота": [
"By lot number",
"За номером лоту",
"Por número de lote",
"Лот нөмірі бойынша"
],
"Новее": [
"Newest",
"Новіші",
"Más nuevos",
"Жаңалары"
],
"Пробег меньше": [
"Lowest mileage",
"Пробіг менше",
"Menor kilometraje",
"Жүрісі азырақ"
],
"Ретейл − MMR больше": [
"Retail − MMR highest",
"Ретейл − MMR більше",
"Retail − MMR mayor",
"Ретейл − MMR көбірек"
],
"Вне критериев": [
"Out of criteria",
"Поза критеріями",
"Fuera de criterios",
"Критерийден тыс"
],
"Нет": [
"No",
"Ні",
"No",
"Жоқ"
],
"Главное": [
"Home",
"Головне",
"Inicio",
"Басты"
],
"Все лоты": [
"All lots",
"Усі лоти",
"Todos los lotes",
"Барлық лоттар"
],
"Итоги": [
"Results",
"Підсумки",
"Resultados",
"Қорытынды"
],
"Ещё": [
"More",
"Ще",
"Más",
"Тағы"
],
"Установить на телефон": [
"Install on phone",
"Встановити на телефон",
"Instalar en el teléfono",
"Телефонға орнату"
],
"иконка на экране, работает без интернета": [
"home screen icon, works offline",
"іконка на екрані, працює без інтернету",
"icono en la pantalla, funciona sin internet",
"экрандағы белгіше, интернетсіз жұмыс істейді"
],
"Скрыть": [
"Hide",
"Сховати",
"Ocultar",
"Жасыру"
],
"лотов в каталоге": [
"lots in catalog",
"лотів у каталозі",
"lotes en el catálogo",
"каталогтағы лот"
],
"дороже $5 000 в подборке": [
"over $5,000 in picks",
"дорожче $5 000 у добірці",
"más de $5 000 en selección",
"іріктемеде $5 000-нан қымбат"
],
"для флипа до $5 000": [
"for flip under $5,000",
"для фліпу до $5 000",
"para flip hasta $5 000",
"$5 000-ға дейін флипке"
],
"в избранном": [
"in favorites",
"в обраному",
"en favoritos",
"таңдаулыда"
],
", заметок": [
", notes",
", нотаток",
", notas",
", жазба"
],
"Площадки": [
"Auctions",
"Майданчики",
"Subastas",
"Алаңдар"
],
"старт около": [
"starts around",
"старт близько",
"empieza hacia las",
"басталуы шамамен"
],
"лотов": [
"lots",
"лотів",
"lotes",
"лот"
],
"Лучшие по прибыли": [
"Top by profit",
"Найкращі за прибутком",
"Mejores por ganancia",
"Пайдасы ең көп"
],
"Вся подборка": [
"All picks",
"Уся добірка",
"Toda la selección",
"Бүкіл іріктеме"
],
"Данные обновлены": [
"Data updated",
"Дані оновлено",
"Datos actualizados",
"Деректер жаңартылды"
],
". Комиссия": [
". Fees",
". Витрати",
". Gastos",
". Шығындар"
],
"на машину.": [
"per car.",
"на машину.",
"por auto.",
"бір көлікке."
],
"★ Мои": [
"★ Mine",
"★ Мої",
"★ Míos",
"★ Менікі"
],
"Все площадки": [
"All auctions",
"Усі майданчики",
"Todas las subastas",
"Барлық алаңдар"
],
"Пока пусто. Нажмите ☆ на карточке машины, чтобы собрать свой список на торги.": [
"Empty for now. Tap ☆ on a car card to build your list for the auction.",
"Поки порожньо. Натисніть ☆ на картці машини, щоб зібрати свій список на торги.",
"Vacío por ahora. Toca ☆ en una tarjeta para armar tu lista para la subasta.",
"Әзірге бос. Саудаға тізім жинау үшін көлік карточкасындағы ☆ басыңыз."
],
"В подборке на эту дату машин нет.": [
"No picks for this date.",
"На цю дату машин у добірці немає.",
"No hay selección para esta fecha.",
"Бұл күнге іріктемеде көлік жоқ."
],
"Модель, лот или VIN": [
"Model, lot or VIN",
"Модель, лот або VIN",
"Modelo, lote o VIN",
"Модель, лот немесе VIN"
],
"Поиск": [
"Search",
"Пошук",
"Buscar",
"Іздеу"
],
"Фильтры": [
"Filters",
"Фільтри",
"Filtros",
"Сүзгілер"
],
"Сортировка": [
"Sort",
"Сортування",
"Ordenar",
"Сұрыптау"
],
"Найдено": [
"Found",
"Знайдено",
"Encontrados",
"Табылды"
],
"из": [
"of",
"з",
"de",
"/"
],
"Ничего не нашлось. Попробуйте убрать фильтры.": [
"Nothing found. Try removing filters.",
"Нічого не знайдено. Спробуйте прибрати фільтри.",
"No se encontró nada. Prueba quitar filtros.",
"Ештеңе табылмады. Сүзгілерді алып көріңіз."
],
"Показать ещё": [
"Show more",
"Показати ще",
"Mostrar más",
"Тағы көрсету"
],
"Марка": [
"Make",
"Марка",
"Marca",
"Марка"
],
"Все марки": [
"All makes",
"Усі марки",
"Todas las marcas",
"Барлық маркалар"
],
"Площадка": [
"Auction",
"Майданчик",
"Subasta",
"Алаң"
],
"История и тайтл": [
"History and title",
"Історія і тайтл",
"Historial y título",
"Тарих және тайтл"
],
"Любая": [
"Any",
"Будь-яка",
"Cualquiera",
"Кез келген"
],
"Пометки на чистом тайтле": [
"Flags on a clean title",
"Позначки на чистому тайтлі",
"Avisos con título limpio",
"Таза тайтлдағы белгілер"
],
"Не на ходу, нет ключа": [
"Not running, no key",
"Не на ходу, немає ключа",
"No arranca, sin llave",
"Жүрмейді, кілт жоқ"
],
"Salvage, rebuilt, без тайтла": [
"Salvage, rebuilt, no title",
"Salvage, rebuilt, без тайтлу",
"Salvage, rebuilt, sin título",
"Salvage, rebuilt, тайтлсыз"
],
"Решение": [
"Decision",
"Рішення",
"Decisión",
"Шешім"
],
"Любое": [
"Any",
"Будь-яке",
"Cualquiera",
"Кез келген"
],
"Год от": [
"Year from",
"Рік від",
"Año desde",
"Жылы бастап"
],
"Пробег до": [
"Mileage up to",
"Пробіг до",
"Millas hasta",
"Жүрісі дейін"
],
"MMR до": [
"MMR up to",
"MMR до",
"MMR hasta",
"MMR дейін"
],
"Сбросить": [
"Reset",
"Скинути",
"Restablecer",
"Тазалау"
],
"Показать": [
"Show",
"Показати",
"Mostrar",
"Көрсету"
],
"Итоги торгов": [
"Auction results",
"Підсумки торгів",
"Resultados de la subasta",
"Сауда қорытындысы"
],
"Сколько машины реально стоили относительно MMR.": [
"What cars actually sold for compared to MMR.",
"Скільки машини реально коштували відносно MMR.",
"Cuánto se vendieron realmente los autos frente al MMR.",
"Көліктер MMR-ге қарағанда нақты қаншаға сатылды."
],
"продано": [
"sold",
"продано",
"vendidos",
"сатылды"
],
", не продано": [
", not sold",
", не продано",
", no vendidos",
", сатылмады"
],
"медиана: цена к MMR": [
"median: price to MMR",
"медіана: ціна до MMR",
"mediana: precio vs MMR",
"медиана: баға / MMR"
],
"машин подборки продано": [
"picks sold",
"машин добірки продано",
"de la selección vendidos",
"іріктемеден сатылды"
],
"ушли не дороже нашей ставки": [
"went at or below our bid",
"пішли не дорожче нашої ставки",
"se vendieron por nuestra puja o menos",
"біздің мөлшерлемеден қымбат емес"
],
"По оценке": [
"By grade",
"За оцінкою",
"Por grado",
"Баға бойынша"
],
"Оценка 4+": [
"Grade 4+",
"Оцінка 4+",
"Grado 4+",
"Баға 4+"
],
"Оценка 3–3,9": [
"Grade 3–3.9",
"Оцінка 3–3,9",
"Grado 3–3,9",
"Баға 3–3,9"
],
"Ниже 3": [
"Below 3",
"Нижче 3",
"Menos de 3",
"3-тен төмен"
],
"Без оценки": [
"No grade",
"Без оцінки",
"Sin grado",
"Бағасыз"
],
"Все результаты": [
"All results",
"Усі результати",
"Todos los resultados",
"Барлық нәтижелер"
],
"Модель или лот": [
"Model or lot",
"Модель або лот",
"Modelo o lote",
"Модель немесе лот"
],
"Оффер": [
"Offer",
"Офер",
"Oferta",
"Ұсыныс"
],
"По лоту": [
"By lot",
"За лотом",
"Por lote",
"Лот бойынша"
],
"Дороже MMR": [
"Above MMR",
"Дорожче MMR",
"Por encima del MMR",
"MMR-ден қымбат"
],
"Дешевле MMR": [
"Below MMR",
"Дешевше MMR",
"Por debajo del MMR",
"MMR-ден арзан"
],
"Цена меньше": [
"Lowest price",
"Ціна менша",
"Precio menor",
"Бағасы төмен"
],
"Показано": [
"Showing",
"Показано",
"Mostrando",
"Көрсетілді"
],
"оценка": [
"grade",
"оцінка",
"grado",
"баға"
],
"Ничего не нашлось.": [
"Nothing found.",
"Нічого не знайдено.",
"No se encontró nada.",
"Ештеңе табылмады."
],
"Мои заметки": [
"My notes",
"Мої нотатки",
"Mis notas",
"Менің жазбаларым"
],
"шт., привязаны к VIN": [
"pcs, linked to VIN",
"шт., прив'язані до VIN",
"uds., vinculadas al VIN",
"дана, VIN-ге байланған"
],
"Пока нет. Пишутся в карточке машины.": [
"None yet. Write them on a car card.",
"Поки немає. Пишуться в картці машини.",
"Aún no hay. Se escriben en la tarjeta del auto.",
"Әзірге жоқ. Көлік карточкасында жазылады."
],
"Как считается прибыль": [
"How profit is calculated",
"Як рахується прибуток",
"Cómo se calcula la ganancia",
"Пайда қалай есептеледі"
],
"MMR, сбор, цена продажи, максимальная ставка": [
"MMR, fees, sale price, max bid",
"MMR, витрати, ціна продажу, макс. ставка",
"MMR, gastos, precio de venta, puja máx.",
"MMR, шығындар, сату бағасы, макс. мөлшерлеме"
],
"Уже установлено": [
"Already installed",
"Вже встановлено",
"Ya instalada",
"Орнатылған"
],
"iPhone и Android, без App Store": [
"iPhone and Android, no App Store",
"iPhone і Android, без App Store",
"iPhone y Android, sin App Store",
"iPhone және Android, App Store-сыз"
],
"Поделиться приложением": [
"Share the app",
"Поділитися застосунком",
"Compartir la app",
"Қосымшамен бөлісу"
],
"Отправить ссылку другу": [
"Send the link to a friend",
"Надіслати посилання другу",
"Enviar el enlace a un amigo",
"Сілтемені досыңызға жіберу"
],
"Проверить обновления": [
"Check for updates",
"Перевірити оновлення",
"Buscar actualizaciones",
"Жаңартуларды тексеру"
],
"Данные от": [
"Data from",
"Дані від",
"Datos del",
"Деректер күні"
],
"Тема оформления": [
"Theme",
"Тема оформлення",
"Tema",
"Тақырып"
],
"Светлая": [
"Light",
"Світла",
"Claro",
"Ашық"
],
"Тёмная": [
"Dark",
"Темна",
"Oscuro",
"Қараңғы"
],
"Как в системе": [
"System",
"Як у системі",
"Como el sistema",
"Жүйедегідей"
],
"Аукционы Хьюстона · версия данных": [
"Houston Auctions · data version",
"Аукціони Х'юстона · версія даних",
"Subastas de Houston · versión de datos",
"Хьюстон аукциондары · деректер нұсқасы"
],
"Цены ориентировочные: MMR и ретейл Manheim, без осмотра машины.": [
"Prices are estimates: Manheim MMR and retail, without inspecting the car.",
"Ціни орієнтовні: MMR і ретейл Manheim, без огляду машини.",
"Precios estimados: MMR y retail de Manheim, sin inspeccionar el auto.",
"Бағалар шамамен: Manheim MMR және ретейл, көлікті тексермей."
],
"Назад": [
"Back",
"Назад",
"Atrás",
"Артқа"
],
"Готово": [
"Done",
"Готово",
"Listo",
"Дайын"
],
"Шанс купить:": [
"Chance to win:",
"Шанс купити:",
"Probabilidad de ganar:",
"Сатып алу мүмкіндігі:"
],
"Пометка аукциона:": [
"Auction note:",
"Позначка аукціону:",
"Aviso de la subasta:",
"Аукцион белгісі:"
],
"Почему не в подборке:": [
"Why not in picks:",
"Чому не в добірці:",
"Por qué no está en la selección:",
"Неге іріктемеде жоқ:"
],
"Были на торгах": [
"Ran before",
"Були на торгах",
"Ya en subasta",
"Бұрын саудада"
],
"Была на торгах": [
"Ran at auction before",
"Була на торгах",
"Ya estuvo en subasta",
"Саудада болған"
],
"лот": [
"lot",
"лот",
"lote",
"лот"
],
"итог": [
"result",
"підсумок",
"resultado",
"нәтиже"
],
"не продана": [
"not sold",
"не продана",
"no vendido",
"сатылмады"
],
"снята": [
"withdrawn",
"знята",
"retirado",
"алынып тасталды"
],
"итога нет в базе": [
"no result in our data",
"підсумку немає в базі",
"sin resultado en nuestros datos",
"базада нәтиже жоқ"
],
"Последний итог намного ниже MMR: возможен скрытый дефект.": [
"Last result is far below MMR: possible hidden defect.",
"Останній підсумок набагато нижчий за MMR: можливий прихований дефект.",
"El último resultado está muy por debajo del MMR: posible defecto oculto.",
"Соңғы нәтиже MMR-ден әлдеқайда төмен: жасырын ақау болуы мүмкін."
],
"ушла на оффер": [
"went to offer",
"пішла на офер",
"pasó a oferta",
"офферге кетті"
],
"продана за": [
"sold for",
"продана за",
"vendido por",
"сатылды:"
],
"продана": [
"sold",
"продана",
"vendido",
"сатылды"
],
"на оффер": [
"to offer",
"на офер",
"a oferta",
"офферге"
],
"ушла на оффер, не отдали": [
"went to offer, not released",
"пішла на офер, не віддали",
"fue a oferta, no se liberó",
"офферге кетті, бермеді"
],
"сумму оффера пост-сейл не показывает": [
"post-sale doesn't show the offer amount",
"суму оферу пост-сейл не показує",
"el post-sale no muestra el monto de la oferta",
"пост-сейл оффер сомасын көрсетпейді"
],
"вероятно та же машина": [
"likely the same car",
"ймовірно та сама машина",
"probablemente el mismo auto",
"сірә, сол көлік"
],
"сумма неизвестна": [
"amount unknown",
"сума невідома",
"monto desconocido",
"сомасы белгісіз"
],
"Шрифт": [
"Font",
"Шрифт",
"Fuente",
"Қаріп"
],
"Размер текста": [
"Text size",
"Розмір тексту",
"Tamaño del texto",
"Мәтін өлшемі"
],
"Системный": [
"System",
"Системний",
"Del sistema",
"Жүйелік"
],
"Nunito, округлый": [
"Nunito, rounded",
"Nunito, округлий",
"Nunito, redondeada",
"Nunito, дөңгелек"
],
"PT Serif, с засечками": [
"PT Serif, serif",
"PT Serif, із зарубками",
"PT Serif, con serifa",
"PT Serif, серифті"
],
"IBM Plex Mono, моноширинный": [
"IBM Plex Mono, monospace",
"IBM Plex Mono, моноширинний",
"IBM Plex Mono, monoespaciada",
"IBM Plex Mono, бірдей енді"
],
"Мелкий": [
"Small",
"Дрібний",
"Pequeño",
"Кіші"
],
"Обычный": [
"Normal",
"Звичайний",
"Normal",
"Қалыпты"
],
"Крупный": [
"Large",
"Великий",
"Grande",
"Ірі"
],
"Очень крупный": [
"Extra large",
"Дуже великий",
"Muy grande",
"Өте ірі"
],
"Неходячие": [
"Non-running",
"Неходові",
"No arrancan",
"Жүрмейтіндер"
],
"Неходячая, линия": [
"Non-running, lane",
"Неходова, лінія",
"No arranca, línea",
"Жүрмейді, желі"
],
"По марке и модели": [
"By make and model",
"За маркою і моделлю",
"Por marca y modelo",
"Маркасы мен моделі бойынша"
],
"Аукцион и время": [
"Auction and time",
"Аукціон і час",
"Subasta y hora",
"Аукцион және уақыт"
],
"Марка, модель, год": [
"Make, model, year",
"Марка, модель, рік",
"Marca, modelo, año",
"Марка, модель, жыл"
],
"Год, марка, модель": [
"Year, make, model",
"Рік, марка, модель",
"Año, marca, modelo",
"Жыл, марка, модель"
],
"Номер лота": [
"Run number",
"Номер лота",
"Número de lote",
"Лот нөмірі"
],
"Недавно выставленные": [
"Recently listed",
"Нещодавно виставлені",
"Recién publicados",
"Жақында қойылғандар"
],
"Год новее": [
"Newest year",
"Новіший рік",
"Año más nuevo",
"Жылы жаңарақ"
],
"можно несколько": [
"you can pick several",
"можна кілька",
"puedes elegir varias",
"бірнешеуін таңдауға болады"
],
"Модель": [
"Model",
"Модель",
"Modelo",
"Модель"
],
"сначала выберите марку": [
"pick a make first",
"спочатку оберіть марку",
"primero elige la marca",
"алдымен марканы таңдаңыз"
],
"Run номер": [
"Run number",
"Run номер",
"Número de run",
"Run нөмірі"
],
"Уже была на торгах": [
"Already ran at auction",
"Вже була на торгах",
"Ya estuvo en subasta",
"Саудада болған"
],
"за": [
"for",
"за",
"por",
"бағасы"
],
"Это намного ниже MMR: возможен скрытый дефект.": [
"That is far below MMR: possible hidden defect.",
"Це набагато нижче MMR: можливий прихований дефект.",
"Muy por debajo del MMR: posible defecto oculto.",
"Бұл MMR-ден әлдеқайда төмен: жасырын ақау болуы мүмкін."
],
"Была в каталоге": [
"Was in the catalog",
"Була в каталозі",
"Estuvo en el catálogo",
"Каталогта болған"
],
": выставляется повторно.": [
": relisted.",
": виставляється повторно.",
": se vuelve a ofrecer.",
": қайта қойылды."
],
"История (AutoCheck):": [
"History (AutoCheck):",
"Історія (AutoCheck):",
"Historial (AutoCheck):",
"Тарих (AutoCheck):"
],
"Слабые места модели": [
"Model weak spots",
"Слабкі місця моделі",
"Puntos débiles del modelo",
"Модельдің әлсіз тұстары"
],
"(в прибыль не входят):": [
"(not included in profit):",
"(у прибуток не входять):",
"(no incluidos en la ganancia):",
"(пайдаға кірмейді):"
],
"Продавец:": [
"Seller:",
"Продавець:",
"Vendedor:",
"Сатушы:"
],
"MMR + сбор": [
"MMR + fees",
"MMR + витрати",
"MMR + gastos",
"MMR + шығындар"
],
"ретейл Manheim": [
"Manheim retail",
"ретейл Manheim",
"retail de Manheim",
"Manheim ретейл"
],
"цена продажи": [
"sale price",
"ціна продажу",
"precio de venta",
"сату бағасы"
],
"прибыль по MMR": [
"profit at MMR",
"прибуток за MMR",
"ganancia al MMR",
"MMR бойынша пайда"
],
"макс. ставка": [
"max bid",
"макс. ставка",
"puja máx.",
"макс. мөлшерлеме"
],
"(прибыль": [
"(profit",
"(прибуток",
"(ganancia",
"(пайда"
],
"Спрос": [
"Demand",
"Попит",
"Demanda",
"Сұраныс"
],
", продаётся за": [
", sells in",
", продається за",
", se vende en",
", сатылу мерзімі"
],
"Калькулятор ставки": [
"Bid calculator",
"Калькулятор ставки",
"Calculadora de puja",
"Мөлшерлеме калькуляторы"
],
"Ваша ставка, $": [
"Your bid, $",
"Ваша ставка, $",
"Tu puja, $",
"Сіздің мөлшерлемеңіз, $"
],
"Заметка после осмотра": [
"Inspection note",
"Нотатка після огляду",
"Nota de inspección",
"Тексеруден кейінгі жазба"
],
"(от": [
"(from",
"(від",
"(del",
"(күні"
],
"Что увидели: кузов, мотор, салон, запах, ошибки": [
"What you saw: body, engine, interior, smell, codes",
"Що побачили: кузов, мотор, салон, запах, помилки",
"Lo que viste: carrocería, motor, interior, olor, códigos",
"Не көрдіңіз: кузов, мотор, салон, иіс, қателер"
],
"Хранится на этом телефоне и привязана к VIN.": [
"Stored on this phone and linked to the VIN.",
"Зберігається на цьому телефоні та прив'язана до VIN.",
"Se guarda en este teléfono y se vincula al VIN.",
"Осы телефонда сақталады және VIN-ге байланған."
],
"нет": [
"none",
"немає",
"no hay",
"жоқ"
],
"★ В избранном": [
"★ In favorites",
"★ В обраному",
"★ En favoritos",
"★ Таңдаулыда"
],
"☆ В избранное": [
"☆ Add to favorites",
"☆ В обране",
"☆ A favoritos",
"☆ Таңдаулыға"
],
"Скопировать VIN": [
"Copy VIN",
"Скопіювати VIN",
"Copiar VIN",
"VIN көшіру"
],
"Открыть лот": [
"Open lot",
"Відкрити лот",
"Abrir lote",
"Лотты ашу"
],
"Поделиться": [
"Share",
"Поділитися",
"Compartir",
"Бөлісу"
],
"Лот": [
"Lot",
"Лот",
"Lote",
"Лот"
],
"С учётом сбора:": [
"With fees:",
"З витратами:",
"Con gastos:",
"Шығындармен:"
],
"Прибыль:": [
"Profit:",
"Прибуток:",
"Ganancia:",
"Пайда:"
],
"Сохранено": [
"Saved",
"Збережено",
"Guardado",
"Сақталды"
],
"· лот": [
"· lot",
"· лот",
"· lote",
"· лот"
],
"Отправить все заметки": [
"Send all notes",
"Надіслати всі нотатки",
"Enviar todas las notas",
"Барлық жазбаларды жіберу"
],
"Скопировать": [
"Copy",
"Скопіювати",
"Copiar",
"Көшіру"
],
"Отправьте заметки в чат с Claude, и он учтёт их в следующем анализе.": [
"Send the notes to the Claude chat and it will use them in the next analysis.",
"Надішліть нотатки в чат із Claude, і він врахує їх у наступному аналізі.",
"Envía las notas al chat con Claude y las tendrá en cuenta en el próximo análisis.",
"Жазбаларды Claude чатына жіберіңіз, ол келесі талдауда ескереді."
],
"Заметок пока нет. Откройте машину и напишите, что увидели на осмотре.": [
"No notes yet. Open a car and write what you saw at inspection.",
"Нотаток поки немає. Відкрийте машину й напишіть, що побачили на огляді.",
"Aún no hay notas. Abre un auto y escribe lo que viste en la inspección.",
"Әзірге жазба жоқ. Көлікті ашып, тексеруде не көргеніңізді жазыңыз."
],
"Как считается": [
"How it is calculated",
"Як рахується",
"Cómo se calcula",
"Қалай есептеледі"
],
"Описание расчёта появится с данными.": [
"The calculation description will appear with the data.",
"Опис розрахунку з'явиться з даними.",
"La descripción del cálculo aparecerá con los datos.",
"Есептеу сипаттамасы деректермен бірге шығады."
],
"Приложение уже установлено. Обновления приходят сами, когда вы открываете его с интернетом.": [
"The app is already installed. Updates arrive automatically when you open it online.",
"Застосунок уже встановлено. Оновлення приходять самі, коли ви відкриваєте його з інтернетом.",
"La app ya está instalada. Las actualizaciones llegan solas al abrirla con internet.",
"Қосымша орнатылған. Интернетпен ашқанда жаңартулар өздігінен келеді."
],
"Нажмите кнопку, и иконка «Аукционы» появится на экране телефона.": [
"Tap the button and the “Auctions” icon will appear on your phone.",
"Натисніть кнопку, і іконка «Аукціони» з'явиться на екрані телефона.",
"Toca el botón y el icono «Subastas» aparecerá en tu teléfono.",
"Батырманы басыңыз, «Аукциондар» белгішесі телефон экранында пайда болады."
],
"Установить приложение": [
"Install app",
"Встановити застосунок",
"Instalar la app",
"Қосымшаны орнату"
],
"Откройте эту ссылку в": [
"Open this link in",
"Відкрийте це посилання в",
"Abre este enlace en",
"Бұл сілтемені ашыңыз:"
],
"Нажмите «Поделиться»": [
"Tap “Share”",
"Натисніть «Поділитися»",
"Toca «Compartir»",
"«Бөлісу» басыңыз"
],
"(квадрат со стрелкой ↑)": [
"(square with an ↑ arrow)",
"(квадрат зі стрілкою ↑)",
"(cuadrado con flecha ↑)",
"(↑ көрсеткісі бар шаршы)"
],
"внизу экрана.": [
"at the bottom of the screen.",
"внизу екрана.",
"en la parte inferior.",
"экранның төменгі жағында."
],
"Выберите «На экран “Домой”» и нажмите «Добавить».": [
"Choose “Add to Home Screen” and tap “Add”.",
"Виберіть «На екран “Додому”» і натисніть «Додати».",
"Elige «Agregar a inicio» y toca «Agregar».",
"«Басты экранға қосу» таңдап, «Қосу» басыңыз."
],
"Откройте ссылку в": [
"Open the link in",
"Відкрийте посилання в",
"Abre el enlace en",
"Сілтемені ашыңыз:"
],
"Нажмите ⋮ в правом верхнем углу.": [
"Tap ⋮ in the top right corner.",
"Натисніть ⋮ у правому верхньому куті.",
"Toca ⋮ en la esquina superior derecha.",
"Жоғарғы оң жақтағы ⋮ басыңыз."
],
"Выберите «Установить приложение» или «Добавить на главный экран».": [
"Choose “Install app” or “Add to Home screen”.",
"Виберіть «Встановити застосунок» або «Додати на головний екран».",
"Elige «Instalar app» o «Agregar a la pantalla principal».",
"«Қосымшаны орнату» немесе «Басты экранға қосу» таңдаңыз."
],
"После установки приложение открывается без браузера, помнит избранное и заметки и работает на аукционе даже без связи. Новые лоты приходят сами.": [
"Once installed, the app opens without the browser, remembers favorites and notes and works at the auction even offline. New lots arrive automatically.",
"Після встановлення застосунок відкривається без браузера, пам'ятає обране й нотатки і працює на аукціоні навіть без зв'язку. Нові лоти приходять самі.",
"Una vez instalada, la app se abre sin navegador, recuerda favoritos y notas y funciona en la subasta incluso sin conexión. Los lotes nuevos llegan solos.",
"Орнатқаннан кейін қосымша браузерсіз ашылады, таңдаулы мен жазбаларды есте сақтайды және аукционда байланыссыз да жұмыс істейді. Жаңа лоттар өздігінен келеді."
],
"Вы на iPhone: шаги ниже.": [
"You are on iPhone: steps below.",
"Ви на iPhone: кроки нижче.",
"Estás en iPhone: pasos abajo.",
"Сіз iPhone-дасыз: қадамдар төменде."
],
"Иконка появится в списке приложений, как у обычного приложения.": [
"The icon will appear in your app list like a regular app.",
"Іконка з'явиться у списку застосунків, як у звичайного застосунку.",
"El icono aparecerá en tu lista de apps como una app normal.",
"Белгіше қосымшалар тізімінде кәдімгі қосымша сияқты пайда болады."
],
"Нажмите": [
"Tap",
"Натисніть",
"Toca",
"Басыңыз"
],
"справа вверху в Chrome": [
"in the top right in Chrome",
"праворуч угорі в Chrome",
"arriba a la derecha en Chrome",
"Chrome-да жоғарғы оң жақта"
],
"Выберите": [
"Choose",
"Виберіть",
"Elige",
"Таңдаңыз"
],
"«Установить приложение»": [
"“Install app”",
"«Встановити застосунок»",
"«Instalar app»",
"«Қосымшаны орнату»"
],
"«Установить»": [
"“Install”",
"«Встановити»",
"«Instalar»",
"«Орнату»"
],
"«Поделиться»": [
"“Share”",
"«Поділитися»",
"«Compartir»",
"«Бөлісу»"
],
"внизу экрана": [
"at the bottom of the screen",
"внизу екрана",
"en la parte inferior",
"экранның төменгі жағында"
],
"Прокрутите и выберите": [
"Scroll and choose",
"Прокрутіть і виберіть",
"Desplázate y elige",
"Төмен айналдырып таңдаңыз"
],
"«На экран „Домой“»": [
"“Add to Home Screen”",
"«На екран „Додому“»",
"«Agregar a inicio»",
"«Басты экранға қосу»"
],
"«Добавить»": [
"“Add”",
"«Додати»",
"«Agregar»",
"«Қосу»"
],
"На iPhone приложение ставится только из": [
"On iPhone the app installs only from",
"На iPhone застосунок встановлюється лише з",
"En iPhone la app solo se instala desde",
"iPhone-да қосымша тек мына жерден орнатылады:"
],
". Скопируйте ссылку и откройте её в Safari.": [
". Copy the link and open it in Safari.",
". Скопіюйте посилання і відкрийте його в Safari.",
". Copia el enlace y ábrelo en Safari.",
". Сілтемені көшіріп, Safari-де ашыңыз."
],
"Скопировать ссылку": [
"Copy link",
"Скопіювати посилання",
"Copiar enlace",
"Сілтемені көшіру"
],
"Аукционы Хьюстона": [
"Houston Auctions",
"Аукціони Х'юстона",
"Subastas de Houston",
"Хьюстон аукциондары"
],
"Лоты автоаукционов с MMR, максимальной ставкой и прибылью": [
"Auto auction lots with MMR, max bid and profit",
"Лоти автоаукціонів з MMR, максимальною ставкою і прибутком",
"Lotes de subastas de autos con MMR, puja máxima y ganancia",
"MMR, макс. мөлшерлеме және пайдасы бар автоаукцион лоттары"
],
"Подборка машин на каждые торги": [
"Car picks for every auction",
"Добірка машин на кожні торги",
"Selección de autos para cada subasta",
"Әр саудаға көлік іріктемесі"
],
"Сканер VIN: наведите камеру, и машина откроется": [
"VIN scanner: point the camera and the car opens",
"Сканер VIN: наведіть камеру, і машина відкриється",
"Escáner de VIN: apunta la cámara y se abre el auto",
"VIN сканері: камераны бағыттаңыз, көлік ашылады"
],
"Работает на площадке без интернета": [
"Works at the auction without internet",
"Працює на майданчику без інтернету",
"Funciona en la subasta sin internet",
"Алаңда интернетсіз жұмыс істейді"
],
"Новые лоты приходят сами": [
"New lots arrive automatically",
"Нові лоти приходять самі",
"Los lotes nuevos llegan solos",
"Жаңа лоттар өздігінен келеді"
],
"Открыть без установки": [
"Open without installing",
"Відкрити без встановлення",
"Abrir sin instalar",
"Орнатпай ашу"
],
"Приложение установлено": [
"App installed",
"Застосунок встановлено",
"App instalada",
"Қосымша орнатылды"
],
"Скопировано": [
"Copied",
"Скопійовано",
"Copiado",
"Көшірілді"
],
"Тёмная тема": [
"Dark theme",
"Темна тема",
"Tema oscuro",
"Қараңғы тақырып"
],
"Светлая тема": [
"Light theme",
"Світла тема",
"Tema claro",
"Ашық тақырып"
],
"Тема как в системе": [
"System theme",
"Тема як у системі",
"Tema del sistema",
"Жүйелік тақырып"
],
"Аукционы Хьюстона: лоты, MMR, прибыль и тайтл. Откройте и установите на телефон:": [
"Houston Auctions: lots, MMR, profit and title. Open and install on your phone:",
"Аукціони Х'юстона: лоти, MMR, прибуток і тайтл. Відкрийте й встановіть на телефон:",
"Subastas de Houston: lotes, MMR, ganancia y título. Ábrela e instálala en tu teléfono:",
"Хьюстон аукциондары: лоттар, MMR, пайда және тайтл. Ашып, телефонға орнатыңыз:"
],
", макс. ставка": [
", max bid",
", макс. ставка",
", puja máx.",
", макс. мөлшерлеме"
],
", прибыль": [
", profit",
", прибуток",
", ganancia",
", пайда"
],
"Мои заметки с осмотра:": [
"My inspection notes:",
"Мої нотатки з огляду:",
"Mis notas de inspección:",
"Менің тексеру жазбаларым:"
],
"Заметки": [
"Notes",
"Нотатки",
"Notas",
"Жазбалар"
],
"Сохранится, когда закончите": [
"Will save when you finish",
"Збережеться, коли закінчите",
"Se guardará al terminar",
"Аяқтағанда сақталады"
],
"У вас последняя версия": [
"You have the latest version",
"У вас остання версія",
"Tienes la última versión",
"Сізде соңғы нұсқа"
],
"Нет связи, показываю сохранённые данные": [
"No connection, showing saved data",
"Немає зв'язку, показую збережені дані",
"Sin conexión, mostrando datos guardados",
"Байланыс жоқ, сақталған деректер көрсетілуде"
],
"Не удалось загрузить данные. Проверьте интернет и откройте приложение ещё раз.": [
"Couldn't load data. Check your internet and open the app again.",
"Не вдалося завантажити дані. Перевірте інтернет і відкрийте застосунок ще раз.",
"No se pudieron cargar los datos. Revisa internet y abre la app de nuevo.",
"Деректер жүктелмеді. Интернетті тексеріп, қосымшаны қайта ашыңыз."
],
"Эта машина есть на нескольких торгах:": [
"This car is in several auctions:",
"Ця машина є на кількох торгах:",
"Este auto está en varias subastas:",
"Бұл көлік бірнеше саудада бар:"
],
"Подходят": [
"Matches:",
"Підходять:",
"Coinciden:",
"Сәйкес:"
],
"машин, выберите:": [
"cars, choose:",
"машин, виберіть:",
"autos, elige:",
"көлік, таңдаңыз:"
],
"Этой машины нет в каталогах приложения.": [
"This car is not in the app's catalogs.",
"Цієї машини немає в каталогах застосунку.",
"Este auto no está en los catálogos de la app.",
"Бұл көлік қосымша каталогтарында жоқ."
],
"Ничего не нашлось. Введите VIN целиком или последние 6–8 символов.": [
"Nothing found. Enter the full VIN or the last 6–8 characters.",
"Нічого не знайдено. Введіть VIN повністю або останні 6–8 символів.",
"No se encontró nada. Ingresa el VIN completo o los últimos 6–8 caracteres.",
"Ештеңе табылмады. VIN-ді толық немесе соңғы 6–8 таңбасын енгізіңіз."
],
"Закрыть": [
"Close",
"Закрити",
"Cerrar",
"Жабу"
],
"Фонарик": [
"Flashlight",
"Ліхтарик",
"Linterna",
"Шам"
],
"Наведите на штрихкод или надпись VIN, чтобы она была в рамке.": [
"Point at the VIN barcode or text so it is inside the frame.",
"Наведіть на штрихкод або напис VIN, щоб він був у рамці.",
"Apunta al código de barras o al texto del VIN dentro del marco.",
"VIN штрихкодына немесе жазуына бағыттаңыз, ол жақтауда болсын."
],
"VIN или последние 6 символов": [
"VIN or last 6 characters",
"VIN або останні 6 символів",
"VIN o últimos 6 caracteres",
"VIN немесе соңғы 6 таңба"
],
"Найти": [
"Find",
"Знайти",
"Buscar",
"Табу"
],
"Камера недоступна в этом браузере. Введите VIN вручную.": [
"Camera is not available in this browser. Enter the VIN manually.",
"Камера недоступна в цьому браузері. Введіть VIN вручну.",
"La cámara no está disponible en este navegador. Ingresa el VIN a mano.",
"Бұл браузерде камера қолжетімсіз. VIN-ді қолмен енгізіңіз."
],
"Нет доступа к камере. Разрешите камеру в настройках браузера или введите VIN вручную.": [
"No camera access. Allow the camera in browser settings or enter the VIN manually.",
"Немає доступу до камери. Дозвольте камеру в налаштуваннях браузера або введіть VIN вручну.",
"Sin acceso a la cámara. Permítela en los ajustes del navegador o ingresa el VIN a mano.",
"Камераға рұқсат жоқ. Браузер баптауларында рұқсат беріңіз немесе VIN-ді қолмен енгізіңіз."
],
"Прочитал VIN": [
"Read VIN",
"Прочитав VIN",
"VIN leído",
"Оқылған VIN"
],
". Сверьте с надписью: если есть ошибка, исправьте в поле внизу. Этой машины нет в каталогах приложения.": [
". Check it against the label: if there is a mistake, fix it in the field below. This car is not in the app's catalogs.",
". Звірте з написом: якщо є помилка, виправте в полі внизу. Цієї машини немає в каталогах застосунку.",
". Compáralo con la etiqueta: si hay un error, corrígelo en el campo de abajo. Este auto no está en los catálogos de la app.",
". Жазумен салыстырыңыз: қате болса, төмендегі өрісте түзетіңіз. Бұл көлік қосымша каталогтарында жоқ."
],
"Читаю надпись:": [
"Reading text:",
"Читаю напис:",
"Leyendo texto:",
"Жазу оқылуда:"
],
"Язык": [
"Language",
"Мова",
"Idioma",
"Тіл"
],
"Мои расходы на машину": [
"My costs per car",
"Мої витрати на машину",
"Mis gastos por auto",
"Бір көлікке шығындарым"
],
"Комиссия аукциона": [
"Auction fee",
"Комісія аукціону",
"Comisión de subasta",
"Аукцион комиссиясы"
],
"Дилер фи": [
"Dealer fee",
"Дилер фі",
"Dealer fee",
"Дилер ақысы"
],
"Прибыль и макс. ставка пересчитываются сразу.": [
"Profit and max bid update instantly.",
"Прибуток і макс. ставка перераховуються одразу.",
"La ganancia y la puja máx. se recalculan al instante.",
"Пайда мен макс. мөлшерлеме бірден қайта есептеледі."
],
"Итого": [
"Total",
"Разом",
"Total",
"Барлығы"
],
"Прибыль = цена продажи − MMR − расходы.": [
"Profit = sale price − MMR − fees.",
"Прибуток = ціна продажу − MMR − витрати.",
"Ganancia = precio de venta − MMR − gastos.",
"Пайда = сату бағасы − MMR − шығындар."
],
"Макс. ставка = цена продажи − расходы − желаемая прибыль ($1 500 для машин дороже $5 000, $1 000 для флипа).": [
"Max bid = sale price − fees − target profit ($1,500 for cars over $5,000, $1,000 for flips).",
"Макс. ставка = ціна продажу − витрати − бажаний прибуток ($1 500 для машин дорожче $5 000, $1 000 для фліпу).",
"Puja máx. = precio de venta − gastos − ganancia objetivo ($1 500 para autos de más de $5 000, $1 000 para flip).",
"Макс. мөлшерлеме = сату бағасы − шығындар − күтілетін пайда ($5 000-нан қымбат көлікке $1 500, флипке $1 000)."
],
"Цена продажи = ретейл Manheim с поправкой на быструю продажу и историю машины.": [
"Sale price = Manheim retail adjusted for a quick sale and the car's history.",
"Ціна продажу = ретейл Manheim з поправкою на швидкий продаж та історію машини.",
"Precio de venta = retail de Manheim ajustado por venta rápida e historial del auto.",
"Сату бағасы = жылдам сату мен көлік тарихына түзетілген Manheim ретейлі."
],
"Подробное описание расчёта доступно на русском языке.": [
"A detailed description is available in Russian.",
"Детальний опис доступний російською.",
"La descripción detallada está disponible en ruso.",
"Толық сипаттама орыс тілінде қолжетімді."
],
"Риски и история машины пока только на русском.": [
"Model risks and car history are in Russian for now.",
"Ризики та історія машини поки лише російською.",
"Los riesgos y el historial están en ruso por ahora.",
"Тәуекелдер мен көлік тарихы әзірге тек орыс тілінде."
]
};
function T(s) { if (LI == null) return s; const m = String(s).match(/^(\s*)([\s\S]*?)(\s*)$/); const t = I18N[m[2]]; return t ? m[1] + t[LI] + m[3] : s; }
