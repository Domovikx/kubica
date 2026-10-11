# Переименовать kebab-case папки src/ в camelCase (folder-имена)

Статус: DONE

## Задача от пользователя

«src\features\table-setup надо запланировать и реализовать переимеронывание папок, эту например надо
в tableSetup и проверить и переименовать остальные»

## Цель

Когда я читаю импорты и пути слоёв, я хочу одинаковый camelCase-стиль — и для файлов (задача
`2026-10-10-camelcase-filenames.md`, DONE), и для папок, чтобы не переключаться между стилями.
Критерий: ни одной kebab-папки в `src/`, всё компилируется, тесты и пиксель-контракт зелёные.

## Контекст (что есть сейчас)

- 10 kebab-папок в `src/` (find, 2026-10-10): `entities/dice-geometry`, `entities/dice-notation`,
  `entities/roll-history`, `features/dice-pool`, `features/dnd-music`, `features/roll-dice`,
  `features/table-roll`, `features/table-setup` (пример человека), `features/ui-scale`,
  `widgets/mobile-table` (+ вложенные `hooks`, `ui` — уже простые, не трогаем).
- Цели: `diceGeometry`, `diceNotation`, `rollHistory`, `dicePool`, `dndMusic`, `rollDice`,
  `tableRoll`, `tableSetup`, `uiScale`, `mobileTable`.
- Имена файлов внутри уже camelCase/`.utils.ts`/`.stylex.ts` (задачи camelcase-filenames и
  stylex-suffix, DONE) — переименование папок их не задевает.
- Внешние ссылки на пути папок: `docs/ARCHITECTURE.md`, `docs/PLAN.md` (канон-доки — обновить),
  чекеры `tmp/check/`: `adaptive-matrix.mjs`, `audit-suspects.mjs`, `cheat-probe.mjs`,
  `d100-pct-dbg.mjs` (fetch/import `src/features/table-setup/presets.ts`), `juice-probe.mjs` —
  точечные правки путей.
- e2e, vite/vitest/playwright конфиги, index.html — на имена папок не ссылаются (grep пуст,
  2026-10-10).
- Git/FS: имена различаются дефисом (не только регистр) — insensitive FS не помеха (эмпирика
  camelcase-filenames); папки `ui-scale` и файл `uiScale.ts` внутри — после rename путь
  `@/features/uiScale/uiScale`.
- Сегмент-замечание: `--ui-scale` (CSS-токен) и маркеры `.mtable*` — к путям папок отношения не
  имеют, замена только по целым сегментам путей импортов.

## Что сделать (ресёрч, по протоколу `tasks/AGENT.md`)

1. Точный аудит ссылок: `grep -rn` по 10 именам папок в `src/`, `docs/`, `tmp/check/`, `e2e/`
   (ожидание по контексту: импорты src + 2 доки + 5 чекеров).
2. Переименовать 10 папок (`os.rename`); `git add -A` — git покажет rename-пары файлов.
3. Заменить целые сегменты путей в импорт-литералах src (python-скрипт, как в filenames-задаче, но
   по сегментам-папкам); после — `npx tsc --noEmit`.
4. Поправить пути в 5 чекерах и 2 docs-файлах.
5. Перезапуск dev-сервера, полная батарея.

## Приёмка

- [ ] `find src -type d -name "*-*"` → пусто (кроме, если что-то вне скоупа — тогда явный список).
- [ ] `git status` показывает переименования файлов внутри папок (R-пары), dev-сервер отдаёт 200.
- [ ] `grep -rn "table-setup\|mobile-table\|dice-pool\|dnd-music\|roll-history\|ui-scale/\|dice-geometry\|dice-notation\|roll-dice\|table-roll" src/`
      → 0 (кроме возможных текстовых упоминаний — проверить каждое).
- [ ] docs: `grep` путей в `docs/ARCHITECTURE.md` и `docs/PLAN.md` — актуальны (0 kebab-путей).
- [ ] tmp/check: 5 чекеров с путями обновлены; батарея 9 чекеров OK.
- [ ] Полная батарея: `npx tsc --noEmit`, `npx eslint src/`, `npm test` (30/254), `npm run build`,
      `npm run test:e2e` (30/30), `node tmp/check/computed-diff.mjs --compare` = 0.
- [ ] `npm run lint:arch` — без новых нарушений (1 pre-existing warn `dieId.utils.ts`).

## Вне рамок (out of scope)

- Имена файлов (уже camelCase/.utils.ts/.stylex.ts) — не меняются.
- Папки без дефиса (`app`, `model`, `home`, `hooks`, `ui`, `api`, `mocks`, `arena`, `three` …) — уже
  допустимы, не трогаем.
- Исторические задачи `tasks/**` — упоминания старых путей не правим.
- CSS-токены (`--ui-scale`), DOM-маркеры (`.mtable*`), localStorage-ключи — не трогаем.

## Файлы (ожидаемые)

- 10 переименований папок (цели см. «Контекст»), все файлы внутри получают новые пути.
- `src/**` — правка импорт-строк с новыми сегментами.
- `docs/ARCHITECTURE.md`, `docs/PLAN.md` — актуализация путей.
- `tmp/check/{adaptive-matrix,audit-suspects,cheat-probe,d100-pct-dbg,juice-probe}.mjs` — пути.
- `tasks/mvp-2/README.md` — строка задачи.

## Связи

- Файлы уже переименованы: `2026-10-10-camelcase-filenames.md` (DONE), `2026-10-10-stylex-suffix.md`
  (DONE).
- Стиль: `2026-10-10-stylex-migration.md`; декомпозиция (план):
  `2026-10-10-ui-folder-decomposition.md`.

## Лог выполнения (2026-10-10)

- Переименовано 10 папок (9 первым проходом; `mobile-table` → `mobileTable` — после остановки
  dev-сервера: vite держал хэндлы, python-скрипт получил PermissionError и упал до замены импортов —
  доделано вторым проходом).
- Замена целых сегментов путей в импорт-литералах: 32 файла в src; `npx tsc --noEmit` → 0.
- Внешние ссылки: `docs/ARCHITECTURE.md` (2 замены), `docs/PLAN.md` (11) — kebab-путей слоёв больше
  нет; в `tmp/check` поправлены реальные пути (`audit-suspects`, `d100-pct-dbg`, `juice-probe`),
  упоминания в комментариях `adaptive-matrix`/`cheat-probe` оставлены как исторические (импорты не
  ссылаются).
- Проверки: tsc 0, eslint 0, vitest 30/254, `find src -type d -name "*-*"` пусто, build ok, e2e
  **30/30**, computed-diff **чисто ✓** 0/0/0, батарея 9 чекеров **9/9**, lint:arch — 1 pre-existing
  warn, dev-сервер перезапущен (200).
- Дополнительно по слову человека: `src/pages/home/home.tsx` → `HomePage.tsx` (React-компонент =
  PascalCase; единственный импортёр `src/app/App.tsx` → `@/pages/home/HomePage`); после правки
  tsc/eslint/vitest/e2e 30/30/diff чисто.
