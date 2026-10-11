# Переименовать kebab-case файлы src/: camelCase, стили — .styles.ts, утилиты — .utils.ts

Статус: DONE

## Задача от пользователя

«далее можешь расписать задачу. нейминги файлов привести в соответствие тоесть
C:\Users\Domo\workspace\kubica\src\features\dnd-music\music-slice.ts заменить на musicSlice тоесть
кэмалКейс»

«styles не так надо стили и утилиты через .styles.ts .utils.ts»

Уточнения (question-tool, 2026-10-10):

- Объём: «все что в кебеб-стайле сейчас» — все .ts-файлы с дефисом в имени, не только слайсы.
- `.tsx`-компоненты: «Оставить PascalCase» (React-конвенция) — не трогаем.
- База для стилей: `mt.styles.ts` / `overlay.styles.ts` (короткая база, без дубля слова styles).
- Утилиты (`*.utils.ts`): die-id, face-orient, test-pump, md-icon, die-glyph, result-pop.
- Слайсы (`music-slice` и т.д.) и хуки (`use-*`) — обычный camelCase (`musicSlice.ts`,
  `useChipHold.ts`).

Три правила именования после уточнений:

1. Стили → `<база>.styles.ts`: `mt-styles.ts` → `mt.styles.ts`, `overlay-styles.ts` →
   `overlay.styles.ts`.
2. Утилиты → `<база camelCase>.utils.ts`: `die-id.ts` → `dieId.utils.ts`, `face-orient.ts` →
   `faceOrient.utils.ts`, `test-pump.ts` → `testPump.utils.ts`, `md-icon.ts` → `mdIcon.utils.ts`,
   `die-glyph.ts` → `dieGlyph.utils.ts`, `result-pop.ts` → `resultPop.utils.ts`.
3. Всё остальное kebab → camelCase (слайсы, сторы, хуки): `music-slice.ts` → `musicSlice.ts`,
   `use-chip-hold.ts` → `useChipHold.ts`.

## Цель

Когда я ищу файл или читаю импорты, я хочу консистентные имена модулей: camelCase для логики, явные
суффиксы `.styles.ts`/`.utils.ts` для стилей и утилит, чтобы по имени файла было видно его роль.
Критерий «стало лучше»: `find src -name "*-*.ts"` пуст, всё компилируется и тесты зелёные, разница —
только в именах файлов и строках импортов.

## Контекст (что есть сейчас)

- 40 .ts-файлов в `src/` содержат дефис в имени (полная карта переименований — секция «Файлы»): 28 →
  camelCase, 10 → с суффиксом `.utils.ts` (6 модулей + 4 теста), 2 → `.styles.ts`.
- Тесты: имя = модульное имя целиком + `.test.ts` (сейчас `face-orient.test.ts` при
  `face-orient.ts`) — после переименования модуля тест называется по тому же правилу:
  `faceOrient.utils.ts` → `faceOrient.utils.test.ts`.
- `.tsx` уже в PascalCase (13 файлов: `src/widgets/mobile-table/MobileTable.tsx`,
  `src/widgets/mobile-table/ui/Backdrop.tsx`, `src/app/App.tsx`) — по ответу пользователя остаются.
- Папки FSD уже kebab-case (`dnd-music`, `roll-history`, `mobile-table`, `dice-geometry`) и по
  диктовке («файлов») не переименовываются.
- Git на этой машине: `git config core.ignorecase = true` (проверено 2026-10-10) — case-only
  переименование на Windows-файловой системе требует отдельной механики (см. ресёрч).
- ESLint: правил по именованию файлов нет (`eslint.config.*` — grep naming/filename пуст,
  2026-10-10) — после переименования ничего не упадёт.
- Динамических импортов по путям src нет: только `src/shared/dice/physics.ts:22,27` —
  `import('cannon-es')` (пакет npm, не наш файл).
- Внешних ссылок на имена файлов нет: `grep -rln` по `docs/` и `tmp/check/` на kebab-имена даёт
  только совпадения CSS-токена `--ui-scale` (например, `tmp/check/audit-fonts.mjs:123`), ни одного
  импорта/пути к файлу (2026-10-10).
- Зависимости-конфиги не затронуты: `package.json`/vite/vitest/playwright конфиги ссылаются на
  `src/**` масками, `.dependency-cruiser.mjs` правила — по папкам слоёв
  (`.dependency-cruiser.mjs:31` и ниже), не по именам модулей.
- Директива A3 из закрытой задачи (hooks → PascalCase, утилиты → `<Экспорт>.utils.ts`) перекрыта
  решением пользователя в этой задаче: всё kebab → camelCase, стили/утилиты — `.styles.ts`/
  `.utils.ts`, `.tsx` остаётся PascalCase.
- Стилевые модули сейчас: `src/widgets/mobile-table/mt-styles.ts` (база stylex для кнопок, см.
  задачу `2026-10-10-stylex-migration.md`) и `src/widgets/mobile-table/ui/overlay-styles.ts` (общий
  stylex оверлеев head/rows/section/wide).

## Что сделать (ресёрч, по протоколу `tasks/AGENT.md`)

1. Механика case-only переименования в git на Windows при `core.ignorecase=true`:
   - Вопрос: работает ли одностадийный `git mv music-slice.ts musicSlice.ts` или нужен двухшаговый
     (`git mv` во временное имя → `git mv` в финальное)? Гипотеза: одностадийный на insensitive FS
     может «перепрыгнуть» и git увидит только удаление+добавление или ничего.
   - Вебсёрч (доки git, обсуждения GitHub): best practice для переименования регистра на
     Windows/Mac; проверить эмпирикой на копии двух файлов до массовой волны.
   - Вердикт: выбрать способ, при котором `git status` показывает rename-пары, а
     `git ls-tree -r HEAD --name-only` фиксирует финальный регистр (иначе Linux-CI чекаут не найдёт
     модули).
2. Аудит ссылок перед стартом: `grep -rn` по всем kebab-именам в `src/`, `docs/`, `tasks/`,
   `tmp/check/` — подтвердить, что менять надо только import-строки внутри `src/` (ожидание по
   контексту: 0 внешних; если найдётся — решить с человеком).
3. Способ обновления импортов: гипотеза — python/perl-скрипт замены путей по карте 40 пар (одно имя
   → другое, включая суффиксы `.styles`/`.utils`), после каждого шага `npx tsc --noEmit`. Ручное
   переименование по одному — как fallback.
4. Порядок волн (предложение, уточнить при выполнении): сначала спецсуффиксы (2 styles + 6 utils с
   тестами), затем слайсы/сторы, затем хуки `use-*` — после каждой волны tsc/eslint/vitest, в конце
   — полная батарея.
5. Реализация — после того, как механика git-переименования (п.1) выбрана и аудит (п.2) чист.

## Приёмка

- [ ] `find src -type f -name "*-*.ts"` → 0 строк (все 40 файлов переименованы).
- [ ] Суффиксы на месте: существуют ровно `src/widgets/mobile-table/mt.styles.ts`,
      `src/widgets/mobile-table/ui/overlay.styles.ts`; 6 модулей `*.utils.ts` в `src/shared/`
      (`dieId`, `faceOrient`, `testPump`, `mdIcon`, `dieGlyph`, `resultPop`).
- [ ] Тесты идут вслед за модулем полным именем: `faceOrient.utils.test.ts`,
      `testPump.utils.test.ts`, `dieGlyph.utils.test.ts`, `mdIcon.utils.test.ts` лежат рядом со
      своими модулями (4 пары); у слайсов — `historySlice.test.ts` и т.д. (как сейчас, только
      camel).
- [ ] Регистр зафиксирован в git:
      `git ls-tree -r HEAD --name-only | grep -E '(^|/)[a-z0-9]+-[a-z0-9-]+\.ts$'` → 0 строк
      (проверка после коммита, не только на диске).
- [ ] `git status` после массового `git mv` показывает rename-пары, а не delete+untracked.
- [ ] Импорты обновлены: `npx tsc --noEmit` → 0 ошибок (битых путей нет).
- [ ] Полная батарея перед сдачей: `npx tsc --noEmit`, `npx eslint src/`, `npm test` (30 файлов/254
      теста), `npm run build`, `npm run test:e2e` (30/30), 9 чекеров `tmp/check/*.mjs` → OK,
      `node tmp/check/computed-diff.mjs --compare` = 0.
- [ ] Внешние ссылки: `grep -rn "music-slice\|table-roll\|die-id\|use-chip-hold\|overlay-styles"` по
      `src/ docs/ tmp/check/` — 0 совпадений, кроме исторических задач `tasks/**` (их не правим).
- [ ] Edge-case: после переименования dev-сервер перезапущен (HMR не должен отдавать старые пути);
      ветка после коммита собирается на Linux (CI deploy workflow `npm run build` — success).

## Вне рамок (out of scope)

- Папки (`dnd-music`, `roll-history`, `mobile-table`, `dice-geometry`, `hooks/`, `ui/`) — остаются
  kebab-case, диктовка только про файлы.
- `.tsx`-компоненты (`MobileTable.tsx`, `Backdrop.tsx`, `App.tsx` …) — остаются PascalCase.
- Файлы без дефиса (`engine.ts`, `format.ts`, `layout.ts`, `stars.ts`, `selectors.ts`,
  `gestures.ts`, `hooks.ts`, `store.ts`) — уже «camelCase»-совместимы, не трогаем.
- Корневые конфиги с дефисом (`.dependency-cruiser.mjs` и т.п.) — не переименовывать (сломает
  автодискавери конфигов).
- Формат PascalCase-хуков из директивы A3 — не применяется (перекрыто: хуки → camelCase).
- Исторические задачи `tasks/**` — упоминания старых имён не правим.
- CSS-токены и DOM-маркеры (`--ui-scale`, `.mtable*`) — к ним «ui-scale»/«slice» не относится.

## Файлы (ожидаемые)

Карта 40 переименований по трём правилам:

- Стили → `.styles.ts` (2): `mt-styles.ts` → `mt.styles.ts`, `overlay-styles.ts` →
  `overlay.styles.ts`.
- Утилиты → `.utils.ts` (6 модулей + 4 теста): `die-id.ts` → `dieId.utils.ts`, `face-orient.ts` →
  `faceOrient.utils.ts` (+ `faceOrient.utils.test.ts`), `test-pump.ts` → `testPump.utils.ts` (+
  `testPump.utils.test.ts`), `md-icon.ts` → `mdIcon.utils.ts` (+ `mdIcon.utils.test.ts`),
  `die-glyph.ts` → `dieGlyph.utils.ts` (+ `dieGlyph.utils.test.ts`), `result-pop.ts` →
  `resultPop.utils.ts`.
- Слайсы/сторы → camelCase (22): `history-slice.ts` → `historySlice.ts`, `pool-store.ts` →
  `poolStore.ts`, `music-slice.ts` → `musicSlice.ts`, `power-slice.ts` → `powerSlice.ts`,
  `table-roll.ts` → `tableRoll.ts`, `setup-slice.ts` → `setupSlice.ts`, `table-setup.ts` →
  `tableSetup.ts`, `ui-scale.ts` → `uiScale.ts`, `ui-scale-slice.ts` → `uiScaleSlice.ts`,
  `sound-slice.ts` → `soundSlice.ts`, `mt-ui-slice.ts` → `mtUiSlice.ts` (+ их `.test.ts`, где есть —
  11 пар).
- Хуки → camelCase (6): `use-chip-hold.ts` → `useChipHold.ts`, `use-fit-head-star.ts` →
  `useFitHeadStar.ts`, `use-stars.ts` → `useStars.ts`, `use-table-engine.ts` → `useTableEngine.ts`,
  `use-toast.ts` → `useToast.ts`, `use-watermark-fit.ts` → `useWatermarkFit.ts`.
- `src/**` — правка import-строк во всех модулях, которые ссылаются на переименованные.
- `tasks/mvp-2/README.md` — строка этой задачи в таблице среза (уже добавлена, описание уточнить под
  три правила).

## Связи

- Смежная по духу: `tasks/mvp-2/2026-10-09-js-mjs-to-ts-mts.md` (нейминг/форматы в git).
- Затрагивает файлы, созданные в `tasks/mvp-2/2026-10-10-stylex-migration.md` (`mt.styles.ts` бывший
  `mt-styles.ts`, `overlay.styles.ts` бывший `overlay-styles.ts`, `mtUiSlice.ts`) — стили не
  меняются, только имена.
- Протокол ресёрча: `tasks/AGENT.md`; статусы/DoD: `tasks/README.md`.

## Лог выполнения (2026-10-10)

- Ресёрч-п.1 (case-only механика) отпал: все 40 имён меняют не только регистр, но и дефисы → обычный
  `os.rename` работает на insensitive FS; git показал **40 rename-пар (R)** в `git status`.
- Аудит (п.2) нашёл внешние ссылки, упущенные первым проходом: чекеры `tmp/check` динамически
  импортируют src-модули через vite dev: `hint-cta2-shots.mjs:139`, `hint-cta-shots.mjs:159`
  (`md-icon.ts`), `cheat-probe.mjs:37` (`face-orient.ts`), `d100-pct-dbg.mjs:35` (`table-setup.ts`)
  — пути поправлены (точная правка tmp, разрешена).
- Реализация: python-скрипт — 40 renames + 95 замен импортов в 41 файле (только basename в литералах
  путей — папки `ui-scale/`, `table-roll/` не задеты, токен `--ui-scale` не тронут).
- Проверки: tsc 0, eslint 0, vitest 30/254, lint (eslint+md) 0, lint:arch — 1 pre-existing warn
  (`die-id.ts` → имя в warn теперь `dieId.utils.ts`), build ok, e2e **30/30**, computed-diff **чисто
  ✓** 0/0/0 (3408 элементов, 16 снимков), батарея 9 чекеров **ALL OK** (hint-cta2-shots после
  починки пути — ALL OK; hint-cta-shots — «CTA уже новый» — предсказуемое поведение
  legacy-сравнения, к именам отношения нет), dev-сервер перезапущен.
- Приёмка: `find src -name "*-*.ts"` пуст; в staged ровно 12 файлов с суффиксами `.styles.ts` (2) /
  `.utils.ts` (10).
- Follow-up, принятый человеком сразу после сдачи: суффикс стилей `.styles.ts` заменяется на
  `.stylex.ts` (модули `mt`/`overlay`) — см. задачу `2026-10-10-stylex-suffix.md`.
