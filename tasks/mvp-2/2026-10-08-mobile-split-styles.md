# 2026-10-08 Распил mobile-table (TS+CSS) и миграция стилей по лучшим практикам 2026

Статус: **DONE 2026-10-10** (A1 2026-10-09, A2 2026-10-09, A3 2026-10-10; амандировка 2026-10-09).
**Фазы B (секционный Tailwind) и C (финал «0 CSS»/`mobile-table.css`) перенесены в задачу
`2026-10-10-stylex-migration.md`** — решение человека 2026-10-10 (Tailwind → StyleX, промежуточный
перегон в утилиты не делаем).

> **Объём расширен человеком дважды (2026-10-09).**
>
> 1. «Задача полностью переехать на Tailwind и полностью избавиться от легаси CSS везде»: все стили
>    — в утилиты Tailwind v4 в разметке, `mobile-table.css` исчезает как файл, legacy-правила
>    `styles.css` уходят (см. «Согласование» ниже).
> 2. **Амандировка (ответы человеком 2026-10-09, question-tool): «Полный реактивный React сейчас» и
>    «всё на реакт !» + выбран «Переход на Redux Toolkit».** Весь виджет (включая готовые волны 0–2)
>    переводится на React-компоненты + RTK: UI-состояние — слайсы/хуки, imperative-мутации DOM
>    уходят, three.js/физика остаются imperative-движком под React-эффектами. Структурный свап —
>    одной волной (фаза A), затем секционный Tailwind (фаза B), затем финал (фаза C). Пиксельная
>    идентичность и поведение не меняются — страховка та же (батарея + computed-diff).

## Задача от пользователя

«У нас, походу, ЧП: нашёл божественные сущности `src/widgets/mobile-table/mobile-table.css` и
`src/widgets/mobile-table/mobile-table.ts`. Эм, нам нужен распил. И почему у нас до сих пор
ванильный CSS — мы не планировали миграцию на что-то более удобное? Может, заведём задачу? Нам нужно
повебсерчить тему стилей и BP стилей в 2026 году, и сформировать таску на разделение божественной
сущности и аналогичных файлов, и стили — то же самое, божественный файл со стилями. Это очень жутко.
Лучшие практики по стилям искать и мигрировать.»

## Цель

Разбить бог-файлы `mobile-table` (TS и CSS) на модули с понятными границами и **полностью перевести
стили на Tailwind v4** (утилиты в разметке; см. «Согласование») — чтобы правка UI не превращалась в
поиск по 1700-строчному файлу, а стили были инкапсулированы, предсказуемы и не дублировали друг
друга. Поведение и пиксельная идентичность UI не меняются — это структурная работа (страховка —
снимок computed-style до/после каждой волны).

**И главное — полное избавление от легаси**: ни одного фрагмента старой системы, живущего вне
принятой (критерий приёмки «легаси = 0»). Это важнее точечных улучшений: легаси копится, каждая
новая фича его обходит, и через полгода проект становится неподъёмным — история убивает проекты
именно так. Важность — выше среднего (не критический уровень: ничего не сломано, но откладывать
нельзя — см. секцию 11 «Легаси» в `.opencode/skills/code-review/patterns.md`).

## Контекст (что есть сейчас; проверено чтением, 2026-10-08)

- **TS**: `mobile-table.ts` — 1632 строки, рядом под-модули от ночной фазы D (`chrome.ts` 155,
  `gestures.ts` 151, `stars.ts` 117, `layout.ts` 62, `watermark.ts` 60, `format.ts` 29). Итого
  слайджет ~2200 строк TS. Фаза D намеренно **не дробила** сквозную DOM-сборку head/sheet/drawer
  (см. `tasks/refactor-2026-10-07.md`, раздел «Фаза D») — это остаток распила.
- **CSS**: `mobile-table.css` — **1282 строки, 142 правила, 77 уникальных классов, только 7
  media/container-запросов**; подключён импортом из `mobile-table.ts:85`. Плюс `src/app/styles.css`
  (227 строк). Всего CSS в проекте — 1509 строк в двух файлах.
- **Tailwind v4 уже установлен, но legacy не мигрирован**: `vite.config.ts:8` — плагин
  `@tailwindcss/vite`; `src/app/styles.css:7-8` — только `theme` + `utilities` слои, **без
  preflight** (комментарий: «существующая вёрстка не должна сдвинуться ни на пиксель»); токены
  продублированы в `@theme` и `:root`. Утилиты доступны новым React-компонентам, но 1282 строки
  legacy-CSS живут по-старому. Появилось в коммите `d7d6f68` («новый стек: react-каркас, rtk-query,
  msw, tailwind»).
- **Слои уже настроены**: `@layer theme, base, components, utilities`, unlayered legacy-правила бьют
  утилиты → миграция может идти постепенно, без большого взрыва.
- **Огромный blast radius на классы**: 54 файла чекеров `tmp/check/*.mjs` селектят `.mtable*` (285
  уникальных ссылок), e2e — 30 имён классов. **Переименование классов `.mtable*` напрямую ломает всю
  верификацию проекта** — это ключевой риск задачи.
- Ночная фаза D (`refactor-2026-10-07.md`) уже доказала безопасный путь: под-модули рядом,
  характеризующие тесты до правок, батарея после каждой фазы, поведение не менять.

## Что сделать (ресёрч, по протоколу `tasks/AGENT.md`)

**Предварительный веб-ресёрч уже сделан (2026-10-08, Exa 403 → DuckDuckGo HTML + webfetch):**

- CODERCOPS, «CSS Styling Systems 2026» (2026-05-31): выбор = 4 трейдоффа (co-location, build-time
  vs runtime, уровень абстракции, TS-токены); тренд 2026 — **от runtime CSS-in-JS (styled-components
  в упадке 3 года подряд) к utility-классам или build-time решениям** (CSS Modules,
  vanilla-extract); Tailwind 4 — конфиг через `@theme` в CSS; CSS Modules — «скучный надёжный выбор»
  с автоскоупом и нулевым рантаймом; **«не мигрируй работающее без конкретной проблемы»** —
  рефакторить инкрементально, когда окупается.
- xcodx, «CSS Best Practices (2026)» (2026-07-29): 15 правил — cascade layers, custom properties,
  clamp() fluid type, container queries, logical properties, focus-visible, dark mode.
- css-cascade-layers.com: в 2026 `@layer` — «table stakes»; главный риск слоёв — governance порядка
  (общий контракт).
- techinterview (2026-05-05): набор опций 2026 — Tailwind / CSS Modules / vanilla-extract /
  Tailwind+arbitrary CSS / legacy styled-components.

**Доресёрчить при выполнении:**

1. **Таблица вариантов (≥2) + метод исключения**, ориентиры из предресёрча:
   - (а) **Tailwind-utility для нового + legacy как есть** в `@layer components` — уже установлено,
     нулевые новые зависимости, но 1282 строки в utility не превращаются;
   - (б) **CSS Modules** (встроена в Vite, ноль новых зависимостей): распил `mobile-table.css` на
     `*.module.css` рядом с под-модулями TS, автоскоуп классов;
   - (в) **vanilla-extract / zero-runtime**: TS-типизация токенов, но новая зависимость и конфиг —
     сверить с критерием «меньше зависимостей» (`tasks/AGENT.md`);
   - (г) **нативный CSS 2026**: `@layer` + вложенность + явный контракт именования, файлы по секциям
     — минимум инструментов, но дисциплина на человека.
   - сверить с критериями проекта: PWA-бюджет (вес CSS в precache), ноль бэкенда, зависимости,
     проверяемость чекерами/e2e; посмотреть, что выбирал `docs/STACK.md` для ванили (сверить — стек
     уже сдвинулся в d7d6f68: react + tailwind).
2. **Распил остатка TS**: сквозная DOM-сборка head/sheet/drawer из `mountMobileTable` — варианты
   выноса (секции-билдеры с инъекцией узких колбэков vs что-то получше), учесть аргументы фазы D
   против («~20 инъекций колбэков») и предложить решение, которое их снимает.
3. **Распил CSS**: как нарезать 1282 строки (по секциям head/sheet/drawer/chips ↔ под-модулям TS, по
   контекстам), что делать с 7 media-запросами (container queries? — проверить).
4. **Стратегия классов `.mtable*`**: переименование запрещено без волны обновления 54 чекеров + e2e
   — вероятный вердикт «имена сохраняем», но проверить альтернативы (CSS Modules коуп сохраняет
   внешние имена через `composes`/ручные классы?).
5. **Согласовать с человеком** (question-tool после ресёрча): масштаб (одна задача или волны),
   выбранный вариант, целевой потолок строк на файл, судьба `.mtable*` имен.
6. **Оркестрация исполнения — делегирование сабагентам**: объём (распил TS + распил CSS + миграция +
   тесты) больше одного прохода. План-волны с параллельным делегированием сабагентам/агентам
   (независимые секции — параллельно: волна TS-распила, волна CSS-нарезки, волна тестов),
   координация и верификация — у запускающего. **Каждая волна заканчивается зелёной батареей**
   (`npm test`, чекеры по затронутому, при UI-правках — e2e) до старта следующей; перед миграционной
   волной — характеризующие тесты на текущее поведение. Итог — замер «легаси = 0» и полная батарея.

## Ресёрч (выполнено 2026-10-09)

### Вопросы, на которые отвечает ресёрч

1. Какая система стилей станет «принятой» для legacy (1327 строк `mobile-table.css` + 199
   `styles.css`), чтобы закрыть легаси=0 и не сломать 81 чекер/e2e?
2. Как распилить остаток `mountMobileTable` (1701 строка), не повторив «~20 инъекций колбэков» из
   Фазы D?
3. Как нарезать CSS, чтобы каждый файл ≤300 строк с нулевым изменением пикселей?
4. Судьба классов `.mtable*` и media-запросов (container queries?).

### Факты (проверено чтением/источниками 2026-10-08…09)

- Vite 8.3.4: CSS Modules — встроена (`*.module.css`, `vite.dev/guide/features#css-modules`), но
  классы в CSS/DOM **хэшируются**; скоуп сохраняется только `:global(...)` (гейдж = не скоупится).
  Утилит Tailwind в разметке **ноль** (1 `className` во всём `src/`: `viewers`), т.е. конфликт
  legacy ↔ utility сегодня физически невозможен.
- Blast radius: 81 из 136 чекеров `tmp/check/*.mjs` селектят `.mtable*`/DOM-классы, e2e
  `m-table.spec.ts` — 100 ссылок; `audit-suspects.mjs` ещё и сканирует исходник CSS на
  `.topbar/.result/...`. Переименование = волна правок верификации.
- `mobile-table.css`: 1327 строк, 144 правила, **4** (не 7) `@media`: 2×`prefers-reduced-motion`,
  `max-width:360`, `max-width:600` (обслуживает 3 карточки сразу). Container queries: не дают
  выигрыша (`.mtable` = viewport-fixed), конвертация = риск сдвига без выгоды → не мигрировать
  (CODERCOPS: «не мигрируй работающее без конкретной проблемы», 2026-05-31).
- Токены продублированы: `@theme` (styles.css:10-20) + `:root` (22-30); `--color-*` из `@theme` не
  используются ни разу (0 ссылок), `--alfa-red-hover` — 0 использований. Использования `:root`-
  токенов — только внутри styles.css (18 ссылок); mobile-table.css живёт на своих
  `--ui-scale/--tap/--fs-*/--icon-*`.
- `mountMobileTable` (103–1701): сборка DOM 110–1111 (~967 строк), проводка 1116–1701. Сквозных
  «швов» между секциями — 6 (звук×2, musicEntry, 3 музыки-синка, renderPresets↔refreshChrome),
  ретро-ссылок — 4 (TDZ-риск, лечатся тадами). «17 колбэков Фазы D» — это на деле пакет `chrome.els`
  (17 узлов, уже один пакет) + импорты-синглтоны, которые инъекции не требуют.
- `docs/STACK.md` выбирал ванилу по байтам (2026-09-22) — стек с тех пор сдвинут в `d7d6f68`
  (react+tailwind); STACK.md про стили не говорит ничего → канон нужно зафиксировать впервые.
- `docs/ARCHITECTURE.md:29-30`: «глобальный CSS без скоупов… при росте — CSS-модули» —
  зафиксированная «честная граница» — её мы меняем осознанно этой задачей.

### Таблица вариантов

| Критерий (по порядку важности)     | (а) Tailwind-утилиты для нового, legacy как есть | (б) CSS Modules (Vite)                             | (в) vanilla-extract        | **(г) нативный CSS 2026: секции + `@layer` + литеральные классы** |
| ---------------------------------- | ------------------------------------------------ | -------------------------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| PWA-бюджет (вес precache)          | 0                                                | 0                                                  | 0 (build-time)             | **0**                                                             |
| Зависимости                        | 0                                                | 0 (встроена в Vite)                                | **+1 (dep + конфиг)**      | **0**                                                             |
| Распил бог-файла                   | **нет** — 1327 строк остаются                    | да                                                 | да                         | **да**: секционные файлы ≤300                                     |
| Классы `.mtable*` / 81 чекер + e2e | сохраняются                                      | **хэш в CSS/DOM → ломает**; `:global` = без скоупа | хэш → та же проблема       | **сохраняются 1-в-1**                                             |
| Инкрементальность / blast radius   | нулевой, но задача не закрывается                | большая волна правок TS (импорты объектов)         | большая волна              | **постепенно, по секциям**                                        |
| Проверяемость                      | —                                                | чекеры падают на хэшах                             | чекеры падают              | **чекеры меряют 1-в-1 как и сейчас**                              |
| Цена владения                      | 2 канона без записи                              | дисциплина импортов стилей везде                   | новый тулчейн для человека | дисциплина + **записанный канон в docs/**                         |

### Метод исключения (от наименее подходящего)

1. **(в) vanilla-extract — нет:** новая зависимость и конфиг ради того же скоупинга, который и там
   хэшует имена (те же 81 чекер) — критерий «меньше зависимостей» не окупается ничем.
2. **(а) Tailwind + legacy как есть — нет:** не решает цель задачи (бог-файл не распиливается),
   легаси=0 не достигается (ванильный CSS остаётся вне слоёв) — вычёркивается по самой цели.
3. **(б) CSS Modules — нет:** автоскоуп и 0 зависимостей — правда, но хэширование имён прямо ломает
   ключевой актив проекта (81 чекер + e2e), а обход через `:global(...)` уничтожает сам скоупинг →
   остаётся (г) с лишней механикой. Переименование веры не даёт: чекеры писались под точные имена.
4. **(г) — финал.** Нарезать `mobile-table.css` на секционные файлы (перенос правил, порядок P1–P7
   из инвентаризации сохранён, агрегатор `mobile-table.css` с `@import` сверху), всё legacy-правило
   положить в `@layer components` (заявка слоёв переехать наверх — в агрегатор, иначе порядок слоёв
   в бандле определит первый попавшийся блок), токены — один источник (`@theme`), Tailwind-утилиты
   остаются инструментом для нового React-кода.

**Плюсы (г):** 0 зависимостей; имена `.mtable*` и верификация не трогаются; инкрементально (секция
за секцией); byte-идентичный каскад при сохранении порядка; закрывает и «незавершённый распил» (§11
Легаси), и «два источника токенов». **Минусы (г):** автоскоупа нет — скоупing по-прежнему держится
на префиксах (ARCHITECTURE ограничение сохраняется); перенос в `@layer` требует проверки порядка
(P1–P7 + порядок файлов mobile-table → styles.css) — лечится замерами чекеров; дисциплина на
человека. **Когда решение перестанёт быть верным:** появятся элементы, где legacy-класс и
Tailwind-утилита живут вместе (утилита перебьёт legacy — это правильно, но требует осознания); или
число людей вырастет до нужды в автоскоупе → тогда переоценка CSS Modules для нового кода (не для
legacy).

### Вердикты по подвопросам

- **Классы `.mtable*`: сохранить как есть** (переименование запрещено без волны обновления 81
  чекера + e2e — экономически не окупается при выбранном (г)).
- **Media-запросы: оставить как есть** (4 шт.; конвертация в container queries — без выгоды,
  `.mtable` и так viewport-привязан; `prefers-reduced-motion` вообще не про ширину).
- **Распил TS — вариант «билдеры секций → `{root, handles}` + общий `ctx`-тад»:** 0 поштучных
  инъекций (1 объект на файл), сквозные швы (6) гасятся реестром синков и выносом оверлеев в
  `overlays.ts`; ретро-ссылки → тады (TDZ-safe); `section.append(...)` остаётся в mount → порядок
  DOM не меняется. Оценка потолока: Вариант 1 (только билдеры) ≈870–900 строк у mount; Вариант 2
  (+overlays/music-views/история-вью) ≈680–730; + вынос `throwAll` → ≈500–560.

### Источники (с датами проверки)

- vite.dev/guide/features — CSS Modules встроена, хэш-скоуп (проверено 2026-10-09).
- CODERCOPS «CSS Styling Systems 2026» (2026-05-31): тренд — от runtime CSS-in-JS к утилитам/
  build-time; «не мигрируй работающее без конкретной проблемы» (предресёрч задачи).
- xcodx «CSS Best Practices 2026» (2026-07-29): cascade layers — table stakes; container queries,
  logical properties (предресёрч; перепроверено DDG 2026-10-09).
- css-cascade-layers.com / ishu.dev (2026-04-05): `@layer` — «table stakes» 2026, 96%+ поддержки,
  Tailwind v4 сам опирается на слои (DDG 2026-10-09).
- Собственные чтения: `tasks/refactor-2026-10-07.md` (Фаза D), `docs/STACK.md`, `patterns.md` §11.

### Неснятые сомнения / допущения

- `[СОМНЕНИЕ]` (снято решением человека ниже): перенос legacy в `@layer components` — заменён полным
  переездом на утилиты; риск сдвига каскада лечится снимком computed-style + 9 чекерами после каждой
  волны.
- Порядок файлов в бандле `mobile-table.css → styles.css` задан порядком импортов в `main.tsx`; при
  удалении `mobile-table.css` сохранить порядок оставшихся стилевых точек входа.

## Согласование с человеком (2026-10-09)

Ответы на question-tool (дословно по смыслу):

1. **Вариант стилей:** «задача полностью переехать на таилвинд и полностью избавиться от легаси css
   везде» → отклонены все варианты таблицы, кроме направления «Tailwind». Исполнение: **утилиты
   Tailwind v4 в разметке** (стили — в `className`/`classList` строками утилит там, где создаётся
   DOM), токены/анимации/варианты — `@theme` + `@custom-variant`, глобальное — `@layer base`.
   `@apply` и «переписать те же правила через @utility» — не считать миграцией (оставили бы legacy в
   новом синтаксисе). Preflight по-прежнему не подключаем (вёрстка не должна сдвинуться;
   зафиксировать в docs).
2. **Потолок TS:** делегировано — «методом исключения оставить наиболее правильный вариант».
   Исключение: Вариант 1 (≤900) — нет: не достигает цели задачи (mount остаётся монолитом проводки);
   Вариант 2 + вынос `throwAll` (≤600) — нет: вынос 180 строк физики броска поверх волн, которые и
   так переписывают весь mount, — кумулятивный риск самого хрупкого поведения. **Оставлен Вариант 2
   (билдеры + `ctx`-тады + `overlays.ts` + music-views): потолок ≤750 TS.**
3. **Классы `.mtable*`:** «главное полностью избавиться от легаси, остальное как хочешь» → **имена
   сохраняются как маркерные классы без стилей** (хуки для 81 чекера/e2e/селекторов состояний в TS);
   визуал дают утилиты. Ноль затрат, ноль риска верификации.
4. **Волны:** «параллельно только по блокам, если результаты сабагентов никак не пересекаются, иначе
   последовательно» → секции mobile-table правятся **последовательно** (общие файлы
   `mobile-table.ts`/`chrome.ts`), параллельно можно только то, что не пересекается по файлам
   (например, docs/ и тул-верификация).

### План волн (каждая заканчивается зелёной батареей)

- **Волна 0 — фундамент + страховка:** `styles.css` = единственный стилевой вход (объявление слоёв,
  все токены в `@theme`, `@custom-variant on/aria-disabled`, `@keyframes`, `@layer base` для
  глобалов: box-sizing, html/body, `body[data-mode]`, `[hidden] { display:none !important }`,
  focus-visible); тул-снимок computed-style `tmp/check/computed-diff.mjs` (baseline → сравнение);
  baseline-батарея (npm test, e2e, 9 чекеров).
- **Волна N (N=1…7) — секция за секцией** (порядок: core/canvas/watermark → head+icon/foot/ toast →
  hint → sheet+chips → drawer (история/пресеты/sections/social/scale/power/about) → music+overlays →
  styles.css-app остаток и `result-pop`): перенос правил секции в утилиты на местах создания DOM,
  удаление правил из `mobile-table.css`, распил соответствующего куска `mountMobileTable` на
  билдер-подмодуль (Вариант 2), после — computed-diff + чекеры/e2e.
- **Финал:** `mobile-table.css` удалён (импорт из `mobile-table.ts` убран), docs-канон, замер
  «легаси = 0» (`grep` ванильных правил/второго набора токенов), `wc -l`, полная батарея и замер
  веса бандла (PWA-бюджет: имена утилит в TS против сэкономленного CSS).

### Методика волн (правила конвертации, для каждой волны)

1. **Маркеры `.mtable*` остаются в class**, но уже без стилей; утилиты добавляются в ту же строку
   `class`/`className` рядом с маркером (чекеры/e2e не трогаем).
2. **Legacy-правило → утилиты на самом элементе.** Вложенные селекторы (`.a .b`) разворачиваются:
   утилиты child-элемента. Псевдо/медиа: `:hover`→`hover:`, `:active`→`active:`,
   `:focus-visible`→`focus-visible:`, `.on`→`on:` (custom-variant), `[hidden]`→удалить правило
   (глобал `[hidden]` в `@layer base` уже гасит), `(max-width:600px)`→`max-[600px]:`,
   `(max-width:360px)`→`max-[360px]:`, `prefers-reduced-motion`→`motion-reduce:`.
3. **Значения — 1-в-1** из legacy (px/цвета/градиенты). Нет готовой утилиты → arbitrary-форма:
   `w-[225px]`, `bg-[#1d2026]`, `text-[min(24vw,150px)]`, `[-webkit-text-stroke:1px_rgba(...)]`.
4. **Конфликт утилит одного свойства** — Tailwind сортирует их по своему порядку, не по порядку в
   строке; сверять с legacy-приоритетом (media-правило должно побеждать базовое; variant-утилиты в
   Tailwind идут после базовых — это соответствует исходному порядку CSS).
5. **Распил TS (Вариант 2):** DOM-секция `mountMobileTable` → билдер-подмодуль
   `src/widgets/mobile-table/<section>.ts` (`build<Section>(...)` возвращает ссылки), контекст —
   параметры, wiring (события/fit) остаётся в mount, если файл упирается в лимит; ретро-ссылки
   (объекты, на которые ссылаются выше места объявления) — только через возвращаемые ссылки/тады
   (TDZ-риск из ресёрча).
6. **Лимиты:** каждый файл ≤750 TS / ≤300 CSS.
7. **Верификация волны:** `npx tsc --noEmit && npx eslint src/`, `npm test`,
   `node tmp/check/computed-diff.mjs --compare` (обязательно 0 изменений), чекеры секции,
   `npm run test:e2e`. Dev-сервер уже работает (`http://127.0.0.1:5173/kubica/`) — не убивать, лог
   `tmp/vite-dev.log` не трогать. Полная батарея (9 чекеров + e2e) — после каждой волны.

### Лог волн

- **Волна 0 (2026-10-09) — DONE.** `styles.css` переписан: слои, `@theme static` (все токены:
  дизайн-цвета + `--alfa-red/--bg/--panel/--text/--muted/--transition-fast` +
  `--ui-scale/--tap/ --fs-*/--icon-*`), `@custom-variant on/aria-disabled`, `@layer base`
  (box-sizing, html/body, `[hidden]{display:none!important}`, **mode-глобалы**
  `body[data-mode]`/`.viewers`/`.result`), legacy-правила app из незалойеренного → в `@layer base`
  (глобалы добивают их по специфичности в том же слое). `mobile-table.css` (1327→1261): удалены
  мёртвые `.sidebar/.topbar/.bottombar` (в DOM их нет), `:root`-дубль токенов, весь
  `body[data-mode]`-блок с `--fs`-дублями. Тул `tmp/check/computed-diff.mjs`: 4 вьюпорта × 4
  состояния = 16 снимков, 3408 элементов, baseline → `tmp/check/_computed-baseline.json`; чистый
  compare ×4, мутационный тест пройден. **Осознанная дельта baseline:** `[hidden]!important` вылечил
  старый баг — у `.mtableSets` (mine-список) не было парного `[hidden]`-правила (в CSS честно
  написано «display:flex перебивает UA-[hidden] — возвращаем», тут забыли), пустой список держал
  фантомные 8px в открытой шторке; baseline пересохранён после фикса. Батарея: tsc 0, eslint 0,
  vitest 230, e2e 30, 9 чекеров OK, computed-diff чисто. Замеры: `styles.css` 272,
  `mobile-table.css` 1261, `mobile-table.ts` 1701.
- **Волна 1 (2026-10-09) — DONE (core/canvas/watermark).** Правила `.mtable` (+глобал
  `body[data-mode] .mtable` clip/overscroll), `.mtableWatermark(/Text)`, `.mtableCanvas(:active)` →
  утилиты на элементах (маркеры `.mtable*` сохранены). Распил: новый `core.ts`
  (`buildTableCore(container)` → `{section, canvas, watermark}`), `mobile-table.ts` 1701→1689,
  `watermark.ts` только класс-строки (fit не тронут), `mobile-table.css` 1261→1197. Нюанс:
  `overflow-hidden overflow-clip` Tailwind отсортировал вразрез легаси (итог `hidden`) → оставлена
  одна `overflow-clip` (итог `clip` = legacy-финал, computed-diff чист; ancient-fallback упразднён —
  вне матрицы). **Addendum 0.5:** в base-глобалы доехали два пропущенных глобала из mobile-table.css
  — `body[data-mode]{background:#0a0b0e}` и глобальный
  `button/input:focus-visible{outline:2px #fff}` (дубль focus-visible в mobile-table.css устранён).
  Батарея волны целиком: tsc 0, eslint 0, vitest 230, e2e 30, 6 чекеров ALL OK, 3 probe IDENTICAL,
  computed-diff 0. Замеры: ts 1689, css 1186, core.ts 35, watermark.ts 65, styles.css 284.
- **Волна 2 (2026-10-09) — DONE (head/icon/foot/toast).** `mobile-table.css` 1186→869: правила
  `.mtableHead(/Btn|Icon|Music|Sound|Star…)/.mtableBurger/.mtableFoot(/Parts)/.mtableToast` →
  утилиты; keyframes `mtableMorphIn`/`mtableSpin` переехали в `styles.css` (ровно 300 строк —
  потолок исчерпан). Распил: новые `head.ts` (константы
  `ICON_BTN/ICON_BTN_BODY/ICON_MORPH/ ICON_SPIN`, `buildHead`), `foot.ts` (`buildFoot`),
  `overlays.ts` (`buildToast`); `mobile-table.ts` 1689→1608. Фиксы: Tailwind v4 `max-[360px]` =
  `@media (width < 360px)` (эксклюзивно) — использован `[@media(max-width:360px)]:…` для
  легаси-паритета `≤360`; вариант `.on` переименован в **`onstate`** (e2e требует отсутствие
  `\bon\b` у выключенной кнопки) — `@custom-variant onstate` в styles.css + `head.ts`. Батарея:
  tsc/eslint/prettier 0, vitest 230, e2e 30, 9 чекеров OK/IDENTICAL, computed-diff 0. Замеры:
  mobile-table.css 869, mobile-table.ts 1608, head.ts 165, foot.ts 39, overlays.ts 35,
  styles.css 300.

## Амандировка плана (2026-10-09, решение человека)

Ответы question-tool (дословно по смыслу):

1. **Глубина:** «Полный реактивный React сейчас» — state/hooks (не откладывать на потом).
2. **Готовые волны 0–2:** «всё на реакт !» — TSX-компоненты вместо vanilla-билдеров; старые билдеры
   (`core/head/foot/overlays`) удаляются после замены TSX.
3. **Темп свапа:** «Один свап целиком» — структурный React-свап фазы A одной волной (батарея сразу
   после свапа), без portal-стрэнглера по секциям.
4. **Сторы:** «Переход на Redux Toolkit» — существующие ванильные сторы (`table-setup`,
   `roll-history`) и модульные синглтоны UI-состояния мигрируют в RTK-слайсы; `redux`/`react-redux`
   уже в deps (использование до сих пор 0).

### Ресёрч архитектуры под React-свап (2026-10-09, два explore-агента)

- **Wiring** (`mobile-table.ts:600–1608`, ~1000 строк): 31 слушатель, ~200 рантайм-мутаций DOM, 12
  вызовов `refreshChrome`, замыкания-состояния
  (`rolling/windActive/activeSet/lastResult/ clearArmed/holdFired`), 3 источника
  `section.dataset.phase` (reroll/gestures/chrome), post-render замеры (`fitHeadStar` —
  5×getBoundingClientRect; `applyLayout` мутирует футер как измерительный прибор), pointer-hold на
  чипах с собственным rAF; `chrome.ts` — чистый derived-слой (~30 атрибутов на refresh).
- **State:** `setup/history` — Set-слушатели + **некэшированный снапшот** (новый объект на каждый
  get → для uSES нужен кэш; для RTK неактуально — слайс хранит стабильный стейт); `music` —
  примитивы + onMusicChange/onMusicNotice; `ui-scale/power/mute/haptics` — без подписок, записи
  только из UI-обработчиков; `presets/stars` — функции поверх localStorage/fetch. `pool-store`
  готов, но не подключён — **не трогаем**. Redux deps — 0 использований.
- **Контракты, которые нельзя сломать:** `data-phase` (`empty|ready|charging|rolling|loading`),
  `__mtable.diePoint`, localStorage-ключи (`kubica-table-v1`, `dice-rolls-v1`, `dice-uiscale`,
  `dice-power`, `dice-muted`, `dice-haptics`, `dice-music-vol`, `kubica-presets-v1`,
  `kubica-presets-hidden-v1`, `kubica-stars`), `--ui-scale` на `<html>`, 30 e2e, 9 чекеров.

### План волн (амандированный; каждая волна = зелёная батарея + computed-diff 0)

- **Фаза A — структурный React+RTK-свап (одна волна):**
  - A1. `src/app/store.ts` (`configureStore`) + Provider в `main.tsx`; слайсы: `table-setup`
    (counts, clamp, `kubica-table-v1`), `roll-history` (entries, лимит 50, `dice-rolls-v1`;
    `commitTableResult` диспатчит напрямую), `ui-scale` (+ applyUiScale на `<html>`), `power`,
    `sound` (thunks зовут `setMuted/setHaptics` — внутренние чтения `isMuted()` продолжают
    работать), `dnd-music` (зеркало `{state,avail,volume}`: движок не переписываем, `onMusicChange`
    → dispatch), `mt-ui` (оверлеи/dirty/rolling/windActive/lastResult/phase/ activeSet). Персист —
    свой glue ~30 строк без redux-persist (preloadedState + try/catch). Vitest-тесты сторов
    переписываются на слайсы (тот же объём кейсов).
  - A2. Компонентное дерево `src/widgets/mobile-table/*.tsx`: `MobileTable` (корень, замена
    `mountMobileTable` + bridge в `home.tsx`) →
    `Head/Hint/Foot/Sheet(rows+presets+chips)/ Drawer(history,scale,power,about,social)/MusicCard/Toast/Backdrop`;
    маркеры `.mtable*` в `className` (CSS не трогаем в фазе A — пиксельная идентичность);
    `*.styles.ts` — класс-константы; хуки `useTableEngine` (createTable + rAF с guard
    document.hidden из `home.tsx:13–35`), `useGestures`, `useWatermarkFit`, `useFitHeadStar`
    (useLayoutEffect), `useChipHold`, toast/dirty локально; `throwAll/reroll/syncInstances` —
    async-пайплайны в `useThrow` (физика imperative). Футер-«измеритель» `applyLayout` → отдельный
    sr-only узел.
  - A3. Удалить `mobile-table.ts`, `chrome.ts`, билдеры `core/head/foot/overlays`, bridge в
    `home.tsx`. Батарея: tsc/eslint, vitest, e2e 30, 9 чекеров, computed-diff = 0.
- **Фаза B — секционный Tailwind (прежние волны 3–7, каждая с батареей):** hint → sheet+chips →
  drawer → music/overlays → app-остаток/`styles.css`. Утилиты в `className`/`*.styles.ts`,
  соответствующие правила уходят из `mobile-table.css`.
- **Финал (фаза C):** `mobile-table.css` удалён (легаси-CSS=0), `styles.css` вычищен (≤300 не
  растить), docs-канон (ARCHITECTURE/STACK: React+RTK+Tailwind-утилиты, маркеры `.mtable*`, без
  preflight), замер бандла, дописан лог волн.

### Методика волн (амандированная; правила конвертации)

1. **React-правило:** UI-состояние — только RTK-слайсы (глобальное) или локальный state компонентов
   (чисто-визуальное: hold-прогресс, toast, фокусы); imperative — только движок
   (three.js/физика/жесты/таймеры) под `useEffect`. Запрещено: ручные
   `classList/textContent/ hidden`-мутации вне движка.
2. **Маркеры `.mtable*` остаются в `className`** (чекеры/e2e не трогаем); утилиты добавляются рядом
   в ту же строку (см. «Методика волн» фазы B ниже).
3. **Лимиты:** каждый файл ≤750 TS (вкл. TSX) / ≤300 CSS; `*.styles.ts` — константы строк.
4. **Верификация волны:** `npx tsc --noEmit && npx eslint src/`, `npm test`,
   `node tmp/check/computed-diff.mjs --compare` (обязательно 0), чекеры секции, `npm run test:e2e`.
   Dev-сервер работает (`http://127.0.0.1:5173/kubica/`) — не убивать. Полная батарея — после каждой
   фазы/волны.

### Лог волн (амандированных)

- **A1 (2026-10-09) — DONE (RTK-слайсы + store + Provider; аддитивный, ванильный виджет не
  тронут).** Создано: `src/app/store.ts` (`configureStore`, preloadedState из localStorage,
  persist-subscribe со сравнением слайсов по ссылке, синглтон + типы RootState/AppDispatch +
  `appActions`), `src/app/hooks.ts` (typed `useAppDispatch/useAppSelector` через `withTypes`),
  Provider + bootstrap в `main.tsx` (data-mode до рендера, `applyUiScale` из preloadedState,
  `onMusicChange → dispatch(syncFromEngine))`); 7 слайсов: `setup-slice` (капы MAX_PER_DIE/
  MAX_TOTAL, `kubica-table-v1`), `history-slice` (лимит 50, валидация записей, `dice-rolls-v1`,
  пустой список → `removeItem`), `ui-scale-slice` (`dice-uiscale`), `power-slice` (`dice-power`),
  `sound-slice` (`dice-muted`/`dice-haptics`; write-through без thunk'ов), `music-slice` (зеркало
  `{state,avail,volume}`, `dice-music-vol` читается preloadedState, пишет движок), `mt-ui-slice` (3
  оверлея-буля + dirty по панелям + rolling/windActive/lastResult/activeSet/
  clearArmed/loadProgress/loadError). Dep-cruiser: точечные лицензии `^src/app/(store|hooks)` в трёх
  fsd-правилах + node_modules разрешён в `fsd-entities-down-only` (entities теперь импортируют RTK).
  38 слайс-тестов (7 файлов, тот же объём кейсов, что у старых сторов; старые тесты сторов остаются
  до A3). **Осознанные решения:** thunk'ы у sound-slice заменены write-through (компонент зовёт
  движок + диспатчит); `commitTableResult` переключается на dispatch в A2 (в A1 старый виджет ещё
  читает ванильные сторы — переключение раньше рассинхронит историю); `setVolume` музыки — чистый
  редьюсер (персист `dice-music-vol` — забота движка `setMusicVolume`, glue не дублирует). Батарея:
  tsc 0, eslint 0, vitest **268** (230 старых + 38 слайсовых), depcruise 0 ошибок (warn
  `no-orphans die-id` — pre-existing), e2e 30, 9 чекеров OK/IDENTICAL (hint-align/
  like-fit/header-fonts — дельта только в label/timestamp), computed-diff 0 (3408 элементов, 16
  снимков).

- **A2 (2026-10-09) — DONE (React-компоненты всего виджета; легаси-сборка заменена).** Создано:
  `engine.ts` (`createEngine(deps)` — three.js/физика/жесты из mountMobileTable, состояние читает из
  RTK через `getState`, возвращает `{update, resize, reroll, syncCounts, dispose}`),
  `hooks/use-table-engine.ts` (createEngine + rAF-цикл с гвардом `document.hidden` + resize +
  cleanup-dispose; синк counts отдельным эффектом; возвращает `RefObject<Engine>`),
  `hooks/use-toast.ts`, `use-chip-hold.ts`, `use-watermark-fit.ts`, `use-stars.ts` (модульный
  singleton + `loadStars()`/`useStarCount()`), `use-fit-head-star.ts`, `MobileTable.tsx` (корень:
  DOM-порядок watermark/canvas/head/foot/hint/live/backdrop/sheet/drawer/musicCard/toast 1-в-1,
  `data-phase` из selectPhase, `sheetOpen`-класс = sheet||music, Esc/probeMusic/onMusicNotice/
  disposeMusic/hideResult/loadStars — root-эффекты, toggle-паритет: add/burger — тумблер, музыка
  всегда открывает), 11 компонентов в `ui/` (Head/Hint/Foot/Live/Watermark/Backdrop/Toast/Chip/
  Sheet/Drawer/MusicCard), `home.tsx` заменён на `<MobileTable />`. **Осознанные решения:** иконки —
  `dangerouslySetInnerHTML` (svg прямым ребёнком для `[&>svg]`); музыка-burger — span `ICON_SPIN` c
  testid; футер/Live — imperative textContent через refs (движок временно перезаписывает при замере
  — с React-текстом узлы бы отцеплялись); head-star пилюля всегда в DOM (`hidden` пока данных нет —
  как легаси); соцсети — innerHTML целиком на `<a>` (svg прямой ребёнок); строка-обёртка степперов
  без класса (как legacy `rows`); `{`${pct}%`}` одним текстовым узлом (kerning); write-through
  звук/power/scale/music-volume; dirty-wire onClick/onInput на панели; two-tap clearArmed + 3с;
  openOverlay эксклюзивный. Поправки после computed-diff: структура sheet (обёртка строк) и соцсети
  (innerHTML на `<a>`) + текстовый узел `%` — привели к 0. **Батарея:** tsc 0, eslint 0, vitest
  **268** (старые + слайсовые; ui/-тестов нет — покрытие e2e/чекерами), depcruise 0 ошибок (warn
  pre-existing), e2e **30/30**, 9 чекеров OK/IDENTICAL, computed-diff **чисто ✓** (0 изменено/0
  добавлено/0 удалено, 3408 элементов, 16 снимков). like-fit-probe: сид `kubica-stars` в
  localStorage (детерминизм от rate-limit GitHub API). Оставшийся легаси (`mobile-table.ts` и др.) —
  не импортируется приложением, удаляется в A3.

- **A3 (2026-10-10) — DONE (легаси выпилено; задача закрыта).** Удалены 7 файлов легаси-кластера:
  `mobile-table.ts` (~1500), `chrome.ts`, `core.ts`, `head.ts`, `foot.ts`, `overlays.ts`,
  `watermark.ts` (вне кластера импортёров нет — проверено greps по `./`, `../`, `@/widgets/…`;
  A2-сборка самозамкнута). Сняты мёртвые экспорты: `rollPool` + приватные
  `poolWorld/poolQueue/ getPoolWorld` (`dice-pool/pool.ts`), `commitTableResult` (`table-roll.ts`),
  `createStarCounter`/ `StarCounter` (`stars.ts` — проба GitHub API уже в `hooks/use-stars.ts`),
  ванильный стор истории (`entities/roll-history/history.ts`: `createHistoryStore`/`HistoryStore`/
  `getHistoryStore`/`HistoryListener`/`load`/`STORAGE_KEY`/`MAX_ENTRIES`), ванильный стор сетапа
  (`features/table-setup/table-setup.ts`: `createSetupStore`/`SetupStore`/`getSetupStore`/
  `SetupListener`/`load`/`STORAGE_KEY`); в файлах остались только живые типы/форматтеры/чистые
  функции, шапки комментариев обновлены (+`history-slice.ts`, `engine.ts`). Store-тесты удалены:
  `history.test.ts` блок «roll-history» (11 it) и `table-setup.test.ts` 4 store-it — покрытие
  паритетно (`history-slice.test`/`setup-slice.test`); engine-тесты `ui-scale/power/sound/music`
  остались (тестируют живые write-through движки). **Решения (человек, 2026-10-10):** `rollPool`
  удалён как явно мёртвый экспорт (guard №9 `tasks/refactor-2026-10-07.md` зафиксирован: файлы
  `dice-pool` — «не трогаем», сняты только мёртвые экспорты); фазы B/C этой задачи перенесены в
  `2026-10-10-stylex-migration.md` (Tailwind признан ошибкой, план — StyleX). **Батарея:** tsc 0,
  eslint 0, vitest **254** (268 − 15 store-кейсов), depcruise 0 ошибок (warn `no-orphans die-id` —
  pre-existing), e2e **30/30**, 9 чекеров exit 0 (ui-scale/add-icon/hint-v2/hint-cta2/social/
  type-scale — ALL OK, hint-align/like-fit/header-fonts — дельта 0), computed-diff **чисто ✓**
  (изменено 0/добавлено 0/удалено 0, 3408 элементов, 16 снимков).

## Приёмка

> **Объём приёмки сокращён решением человека 2026-10-10:** пункты про фазы B/C (`mobile-table.css`
> удалён, «0 CSS», легаси-правила `styles.css` → утилиты, фиксация канона в `docs/ARCHITECTURE.md`)
> перенесены в `2026-10-10-stylex-migration.md` вместе с фазами. Здесь — приёмка фаз 0–A3.

- [ ] Результат ресёрча в разделе ниже: вопросы, таблица вариантов (≥2), метод исключения, вердикт
      ±, источники с датами. **Готово.**
- [ ] Согласовано с человеком: вариант миграции, масштаб волн, судьба имен классов. **Готово (секция
      «Согласование», 2026-10-09).**
- [ ] Ни один файл `src/**/*.ts` и `src/**/*.css` не превышает согласованный потолок: **≤750 TS /
      ≤300 CSS**; замер `wc -l` в отчёте. **Готово (A3: легаси-файлы удалены, остаток `styles.css`
      300 / `mobile-table.css` 869 — второй файл уходит в StyleX-задачу).**
- [ ] Поведение UI не изменилось: `npm test` зелёный, `npm run test:e2e` — все passed (на 2026-10-10
      — 30), 9 чекеров `node tmp/check/<имя>.mjs` — все OK (визуальная идентичность — скриншоты +
      computed-diff без расхождений). **Готово (батарея A3, 2026-10-10).**
- [ ] **Легаси = 0**: замером (`wc -l`/`grep`) подтверждено — `src/**/*.css` не содержит ванильных
      правил вне принятой системы (утверждённых `@layer base`-глобалов и `@theme`), второй набор
      токенов отсутствует (`:root` дублей нет), `mobile-table.css` удалён, пометки «ВРЕМЕННО/старый»
      без задачи — пусто; замер в отчёте. → **перенесено в StyleX-задачу** (`mobile-table.css`
      остаётся до её фазы B/C-наследия).
- [ ] Классы `.mtable*`: сохранены как маркерные — 9 чекеров и e2e зелёные без правок верификации.
      **Готово (A3).**
- [ ] Стили нового кода пишутся в выбранной системе … → **перенесено в StyleX-задачу** (система
      меняется с Tailwind на StyleX, канон там же).
- [ ] Полная батарея перед сдачей: `npx tsc --noEmit`, `npx eslint src/`, `npm test`,
      `npm run build`, `npm run test:e2e`, 9 чекеров, замер веса бандла. **Готово для фаз 0–A3
      (A3-батарея 2026-10-10; `npm run build`/вес бандла — в StyleX-задаче, т.к. депы Tailwind там
      уходят).**

## Вне рамок (out of scope)

- Изменение поведения/визуала UI (это рефакторинг структуры, не фичи — правило фазы D).
- Новые зависимости (runtime CSS-in-JS — instant reject по предресёрчу; Tailwind уже установлен).
- Включение Tailwind preflight (в отдельной задаче с пересчётом пикселей — здесь запрещён).
- Домен/шрифты/дизайн-токены как таковые (2.19/2.21 уже сделали шкалу; здесь — только перенос
  существующих токенов в один источник `@theme`).

## Файлы (ожидаемые)

- `src/widgets/mobile-table/mobile-table.ts` — уменьшается до ≤750 строк за счёт новых
  билдер-подмодулей DOM-сборки (`head.ts`, `sheet.ts`, `drawer.ts`, `overlays.ts`, …).
- `src/widgets/mobile-table/mobile-table.css` — **удаляется** (правила переехали в утилиты); импорт
  `mobile-table.ts:85` убирается.
- `src/app/styles.css` — единственный стилевой вход: слои, `@theme` (все токены), `@layer base`
  (глобалы), `@custom-variant`, ключевые кадры; ≤300 строк.
- `docs/ARCHITECTURE.md` и/или `docs/STACK.md` — зафиксировать принятую систему стилей.
- Тесты/тулы: `tmp/check/computed-diff.mjs` (снимок/сравнение computed-style), расширение
  `layout.test.ts`/`stars.test.ts` + e2e-характеризация перед риск-волнами.

## Связи

- `tasks/refactor-2026-10-07.md` — фаза D: прецедент распила, запрет менять поведение,
  батарея/чекеры как верификация.
- Находки code-review 2026-10-07 (`mountMobileTable` — блокер SOLID/KISS) — задача закрывает их
  остаток (DOM-сборка) и добавляет распил CSS (в ревью CSS не покрывался).
- `d7d6f68` — хвост «нового стека» (react+tailwind): эта задача доводит миграцию стилей до конца.
- `2.19-typography`, `2.21-type-scale`, `2.20-ui-scale` — токены и шкала, которые миграция не должна
  сломать (чекеры type-scale/ui-scale в списке 9).
- `.opencode/skills/code-review/patterns.md`, секция 11 «Легаси» — определение и severity «важно»
  (выше среднего): задача является планом избавления от легаси, найденного ревью.
