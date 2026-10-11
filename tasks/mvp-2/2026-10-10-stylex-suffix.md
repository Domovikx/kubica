# Переименовать stylex-модули `*.styles.ts` → `*.stylex.ts`

Статус: DONE

## Задача от пользователя

«Variables must be in a file with one of the following extensions: .stylex.js .stylex.mjs
.stylex.cjs .stylex.ts .stylex.tsx .stylex.jsx — мне кажется что нам лучше выбрать .stylex.ts/tsx
нужно запланировать миграцию и далее ее сделать»

## Цель

Когда я открываю stylex-модуль или настраиваю IDE/инструменты, я хочу канонический суффикс
`.stylex.ts` (рекомендация экосистемы StyleX), чтобы инструменты однозначно распознавали файлы со
stylex-объектами. Критерий: stylex-модули называются `X.stylex.ts`, проект компилируется, все тесты
зелёные.

## Контекст (что есть сейчас)

- Stylex-модули сейчас (суффикс `.styles.ts` от задачи `2026-10-10-camelcase-filenames.md`, выполнен
  2026-10-10):
  - `src/widgets/mobile-table/mt.styles.ts` (1 `stylex.create` — база кнопок);
  - `src/widgets/mobile-table/ui/overlay.styles.ts` (1 `stylex.create` — общие оверлеи).
- `stylex.create` также живёт module-scope внутри 13 `.tsx`-компонентов (`MobileTable.tsx`,
  `ui/Drawer.tsx`, `ui/Head.tsx`, `ui/Sheet.tsx` …) — это компоненты, они остаются `.tsx` (решение:
  `.stylex.tsx` резервируется для будущих stylex-модулей в JSX-формате, компоненты в него не
  переименовываем — иначе ломается React-конвенция имен).
- Источник сообщения «Variables must be in a file…»: grep по `node_modules/@stylexjs/**` и
  `tmp/vite-dev.log` (2026-10-10) — не найден; вероятно, IDE-расширение StyleX или доки. Не
  критично: директива человека — принять суффикс как канон.
- Импорты модулей сейчас: `from './mt.styles'`, `from '../mt.styles'`, `from './overlay.styles'`
  (проверить grep'ом перед стартом).

## Что сделать (ресёрч, по протоколу `tasks/AGENT.md`)

1. `grep -rn "\.styles" src/` — собрать все импорты двух модулей (ожидание: 2–6 строк).
2. Переименовать: `mt.styles.ts` → `mt.stylex.ts`, `overlay.styles.ts` → `overlay.stylex.ts`
   (обычный `os.rename`/`git mv`, имена различаются не только регистром — insensitive FS не помеха,
   как выяснено в camelcase-задаче).
3. Обновить импорты; `npx tsc --noEmit` после.
4. Полная батарея (задача трогает stylex-вход — проверяем пиксель-контракт).

## Приёмка

- [ ] `find src -name "*.styles.ts"` → пусто; существуют `mt.stylex.ts` и `ui/overlay.stylex.ts`.
- [ ] `git status` показывает rename-пары (2 шт.).
- [ ] `grep -rn "mt\.styles\|overlay\.styles" src/` → 0 (импорты обновлены).
- [ ] Полная батарея: `npx tsc --noEmit`, `npx eslint src/`, `npm test` (30/254), `npm run build`,
      `npm run test:e2e` (30/30), 9 чекеров OK, `node tmp/check/computed-diff.mjs --compare` = 0.
- [ ] tmp/check: `grep -rn "\.styles" tmp/check/` → 0 (чекеры ссылаются только на md-icon/
      face-orient и т.п., но проверить на всякий случай).

## Вне рамок (out of scope)

- `.tsx`-компоненты со `stylex.create` внутри — остаются `*.tsx`.
- Содержимое модулей (экспорты, значения) — не меняется, только имена файлов и импортов.
- Декомпозиция компонентов в папки — отдельная задача (`2026-10-10-ui-folder-decomposition.md`).

## Файлы (ожидаемые)

- `src/widgets/mobile-table/mt.styles.ts` → `src/widgets/mobile-table/mt.stylex.ts`
- `src/widgets/mobile-table/ui/overlay.styles.ts` → `src/widgets/mobile-table/ui/overlay.stylex.ts`
- Модули-импортёры (2–6 шт., по факту grep'а) — правка путей.

## Связи

- Прямо продолжает `2026-10-10-camelcase-filenames.md` (замена только что принятого суффикса
  `.styles.ts` на канон stylex).
- Stylex-миграция в целом: `2026-10-10-stylex-migration.md`.

## Лог выполнения (2026-10-10)

- grep импортов `.styles` — 7 ссылок в 4 tsx (Drawer/Head/MusicCard/Sheet), в tmp/check — 0.
- Переименовано: `mt.styles.ts` → `mt.stylex.ts`, `ui/overlay.styles.ts` → `ui/overlay.stylex.ts`;
  импорты поправлены (`../mt.styles`→`../mt.stylex`, `./overlay.styles`→`./overlay.stylex`).
- Проверки: tsc 0, eslint 0, vitest 30/254, `grep "\.styles" src/` → 0, build ok, e2e **30/30**,
  computed-diff **чисто ✓** 0/0/0, батарея 9 чекеров **9/9 OK**.
- git показывает 2 rename-пары (см. общий стейдж WIP).
