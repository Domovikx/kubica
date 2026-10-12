# FSD-ревью 2026_1011-1629: разбор находок волной за волной

Дата: 2026-10-11. Источник: `.opencode/skills/fsd-review/tmp/fsd-review_2026_1011-1629.md` (отчёты:
`tmp/review/fsd-2026_1011-1629/`). 37 находок → ~28 уникальных. Принято в работу целиком, приоритет
— блокеры → важные → быстрые дедупы → структурные переезды → сегментация.

## Цель

Все принятые находки ревью закрыты или осознанно отложены с решением в логе; механика
(lint:arch/lint:fsd) ловит новые нарушения закрытых классов; батарея зелёная после каждой волны.

## Волна 1 — блокеры границ + механика + быстрые дедупы

- [x] 1.1 Миграция геометрии: `bodyRadius`, `toModelFrame` и связанные данные/типы из
      `entities/diceGeometry/geometry` вниз в `shared/dice`; `physics.ts`, `readout.ts`,
      `faceOrient.utils.ts` — импорты вниз/локально; убрать re-export `toModelFrame` из
      `faceOrient.utils.ts:40` (тест — прямой импорт).
- [x] 1.2 `entities/rollHistory/history.ts` — `DieId` из `@/shared/dice/dieId.utils`, не через
      geometry-реэкспорт.
- [x] 1.3 dep-cruiser: правило «shared не импортирует выше» (`from: src/shared` → только
      shared/node_modules); `tsPreCompilationDeps: true` (type-only импорты + ложный no-orphans).
- [x] 1.4 `mtUiSlice` через публичный API виджета: экспорт из `widgets/mobileTable/index.ts`,
      `app/store.ts` — через barrel; steiger: `no-public-api-sidestep` включить точечно для
      `src/app/**`.
- [x] 1.5 `MUTE_KEY`/`HAPTICS_KEY` — один источник (`sound.ts`), `soundSlice` импортирует.
- [x] 1.6 Убрать фантомный `hooks/index.ts` (внешних потребителей нет — YAGNI) и type-re-export
      `HeadProps`/`DrawerProps`/`SheetProps` из barrel'ов.
- [x] 1.7 `testPump.utils.ts` → вне прод-дерева (`src/testUtils/`), импорты тестов обновить.

Приёмка: tsc/eslint/vitest/lint/lint:arch/lint:fsd зелёные; в depcruise нет upward из shared;
app/store идёт через barrel; grep `entities/diceGeometry` в shared отсутствует.

## Волна 2 — композиция React (дедупы UI)

- [x] 2.1 OverlayHead (шапка оверлея) + `useDirtyPanel(kind)` — Sheet/Drawer/MusicCard.
- [x] 2.2 mute-toggle хук — Head/DrawerSoundSection (+ aria-зеркало музыки).
- [x] 2.3 ChipGroup подкомпонент — SheetPresetsSection («Быстрые»/«Мои»).
- [x] 2.4 `holdFiredRef` внутрь `useChipHold`; fit-рефы шапки внутрь Head/useFitHeadStar.
- [x] 2.5 engine.ts: вынести throwAll/finishPack/runRound секции по образцу gestures.ts.
- [x] 2.6 YAGNI-хвосты: `cancelToast` без потребителя; `showResult` без вызывателей — по решению.

Приёмка: e2e 30/30, чекеры 9/9, diff 0/0/0; файлы Sheet/Drawer/MusicCard ужались, поведение то же.

## Волна 3 — здоровье слайсов (переезды и решения)

- [x] 3.1 `features/dicePool` — мёртвый слайс-дублёр: удалить (git сохранит) или подключить к
      планам; решение — в логе.
- [x] 3.2 `entities/model`: подключить `MODELS` к engine (единый источник `.glb`-URL) либо удалить
      слайс.
- [x] 3.3 Переименовать слайс `entities/model` (коллизия с сегментом) + единый шаблон имён
      (`rollDice`→`throwPower` и т.п., `dndMusic/music` — база=слайс).
- [x] 3.4 `soundSlice` → features (стор настроек), shared — только движок звука.
- [x] 3.5 `sheetPresets.utils` (сборка данных) → `features/tableSetup`; в ui — отображение.
- [x] 3.6 `formatParts`/`formatLabel` → `widgets/mobileTable/format.ts`; в entities — типы.
- [x] 3.7 `useStars`/`stars` (GitHub-счётчик) → features-слайс; виджет рендерит.
- [x] 3.8 presetRev-проп → подписка на источник (useSyncExternalStore) — если не уехало в 3.5.

Приёмка: батарея зелёная; grep-проверки «нет бизнеса в shared/ui», «нет мёртвых слайсов».

## Волна 4 — сегментация и конвенции

- [x] 4.1 Ввести сегменты `model`/`lib` хотя бы в растущих слайсах; вернуть
      `fsd/no-segmentless-slices` в steiger по мере готовности.
- [x] 4.2 Зафиксировать конвенцию «папка компонента = PascalCase» в guidelines (или переименовать —
      решение в логе).
- [x] 4.3 layoutSlots/LayoutPlan — развести имена и владельцев раскладки.
- [x] 4.4 useStars-пороги формулы «Оценить репозиторий» — один владелец label-формулы.

## Ресёрч (по ходу волн)

- RTK 2026: расположение createSlice / entity adapters, best practices слайсов.
- FSD 2026: сегментация слайсов, @x-кросс-импорты, shared/lib grouping.
- React 19: useSyncExternalStore для localStorage-источников, хуки-владельцы.

## Ход работ (лог)

- 2026-10-11: задача создана; коммиты `ce27c13` (WIP-реформа) и `961afc1` (FSD-инфраструктура) до
  начала волн; волна 1 в работе.
- 2026-10-11: **волна 1 DONE** (`d376fa1`): геометрия → shared/dice (блокер закрыт), mtUiSlice →
  features/tableUi (цикл store↔виджет разорван; vitest получил stylex-плагин), ключи звука один
  источник, testPump → src/testUtils, YAGNI-барrel'ы удалены, dep-cruiser: tsPreCompilationDeps
  - fsd-shared-no-upward + entities-down-only-corrected, steiger: app-sidestep on,
    insignificant-slice-off (слепота desegmented pages). Батарея полная: e2e 30/30, diff 0/0/0.
- 2026-10-11: **волна 2 DONE** (`d46cb69`): OverlayHead + useDirtyPanel (шапка оверлея и
  dirty-делегат вместо трёх копий Sheet/Drawer/MusicCard), useMuteToggle/useHapticsToggle — владелец
  тумблеров звука, ChipGroup в SheetPresetsSection, holdFiredRef внутри useChipHold (убран из
  цепочки пропсов Sheet→Section→Chip), fit-рефы шапки внутри Head, engine.ts → throwPack.ts (423→265
  строк, прецедент декомпозиции), YAGNI: cancelToast удалён.
- 2026-10-11: **волна 3 DONE** (`77e20e8`): удалён мёртвый `features/dicePool` (дублёр
  rollHistory+setup; git сохранит); `entities/model` → `entities/dieModels` (коллизия слайс/сегмент
  устранена, steiger-исключение снято), engine берёт `.glb`-URL из реестра `MODELS`; `soundSlice` →
  `features/sound` (shared — только движок звука); `sheetPresets.utils` →
  `features/tableSetup/presetDisplay.utils` (сборка данных из ui); `formatParts`/`formatLabel` →
  `widgets/mobileTable/format.ts` (тесты переехали из history.test.ts); `useStars`/`stars` →
  `features/repoStars`; переименования «база=слайс»: `rollDice` → `throwPower` (`power` →
  `throwPower.ts`/`throwPowerSlice.ts`), `dndMusic` → `music`; раскладка канвы
  `layoutSlots`/`slotsToWorld`/`LayoutRect` → `widgets/mobileTable/layout.ts` (px-`LayoutPlan`
  переименован в `SlotPlan` — 4.3 закрыта попутно); 3.8 (presetRev → useSyncExternalStore) —
  отложена: в 3.5 данные уехали в features, но проп `presetRev` ещё дублирует состояние в
  Sheet/SheetPresetsSection; вернёмся, если раскатка tableSetup покажет живой источник. Батарея
  полная: e2e 30/30, чекеры 9/9, diff 0/0/0, lint:arch 0, lint:fsd clean; vitest 28 файлов / 236
  тестов (−18 у удалённого dicePool).
- 2026-10-11: **волна 4 DONE** (`6c926ca`): все слайсы entities/features/pages сегментированы
  (стор-слайсы → `model/`, чистые хелперы repoStars → `lib/`, `pages/home/ui/HomePage.tsx`; 66
  импортов обновлены); `entities/dieModels` → `dieModel` (ед.ч., inconsistent-naming погашен);
  steiger: включён `fsd/no-segmentless-slices` (слепота на desegmented слайсы снята),
  `fsd/public-api` off для entities/features/pages (конвенция прямых импортов без barrel),
  `fsd/insignificant-slice` off глобально («один потребитель — осознанная норма MVP, merge размывает
  границы» — решение в конфиге); 4.4 — `starReviewLabel` в `features/repoStars/lib` (шапка/дроверь
  больше не копируют формулу с расходящимися порогами: канон «число видно всегда, когда известно»);
  4.2 — конвенция сегментации и PascalCase-папок зафиксирована в docs/ARCHITECTURE.md (шпаргалка
  «куда класть»). Батарея полная: e2e 30/30, чекеры 9/9, diff 0/0/0, lint 0, lint:arch 0, lint:fsd
  clean.

**Итог ревью:** все 4 волны закрыты (коммиты `d376fa1`, `d46cb69`, `77e20e8`, `6c926ca`); отложено
осознанно: 3.8 (presetRev → useSyncExternalStore — проп ещё дублирует состояние, вернуться при
раскатке tableSetup) и ресёрч-блок задачи (RTK/FSD/React-бест-практисы — частично учтено правилами).
Пуш не выполнялся (не запрашивался).

- 2026-10-12: **фидбек-цикл после ревью (структура)** — в рабочем дереве, ожидает review/коммита:
  плоские слайсы (файлы из model/lib/ui переехали в корень слайса, `pages/home/` →
  `src/pages/HomePage.tsx` — уточнение владельца: лишняя вложенность при 1 файле); двери: `index.ts`
  у каждого слоя (`@/features`, `@/entities`, `@/widgets`, `@/pages`, `@/shared`, `@/testUtils`,
  `@/app`) — 125 импортов переведены на короткие двери слоёв, 43 дубля import-ов слиты в один
  statement, 8 длинных строк развёрнуты; shared: дверь слоя реэкспортирует всё, кроме `api` (msw —
  только динамический импорт из main.tsx), кросс-сегментные импорты ВНУТРИ shared — только в
  сегментную дверь (`@/shared/dice`), иначе цикл через слой-баррель; mobileTable реструктуризован по
  FSD-канону сегментов: `ui/` (компоненты+стили), `model/` (engine, gestures, layout, selectors,
  throwPack, useTableEngine, useToast), `lib/` (format), корень — только `index.ts`; steiger:
  `fsd/no-layer-public-api` off (двери слоёв — решение владельца, границы держит dep-cruiser);
  dep-cruiser: down-only правила не захватывают двери слоёв (хвостовой `/` в from.path),
  `fsd-no-upward-imports` — исключение для `src/pages/index.ts`; FSD-скрипты перенесены из tmp/ в
  `tools/` (rewrite_layer_doors.py, merge_layer_imports.py, wrap_long_imports.py); ARCHITECTURE.md —
  раздел дверей переписан. Батарея полная: tsc 0, eslint 0, vitest 28/236, lint 0 (md), lint:arch 0
  (149 модулей), lint:fsd clean, build 0, e2e 30/30, чекеры 9/9, diff 0/0/0.
- 2026-10-12: **продолжение цикла (KISS)** — в рабочем дереве: `src/testUtils/` убран — `testPump`
  переехал в `src/shared/lib/` (дверь `@/shared/lib`, намеренно мимо двери слоя — тест-код и
  антицикл), `src/` теперь содержит только FSD-слои; widgets уплощён по KISS/YAGNI (решение
  владельца): папка-слайс `mobileTable/`, сегменты `ui/model/lib` и папки компонентов удалены — 42
  файла прямо в `src/widgets/`, дверь `index.ts` реэкспортит `./MobileTable`;
  `tools/flatten_slice.py` (уплощение слайсов), dep-cruiser: `fsd-widgets-down-only` переписан под
  плоский слой (сиблинги = колокализация); ARCHITECTURE обновлён. CSS-аудит: прямых css в проекте
  один — `src/app/styles.css` (канонический вход по ресёрчу stylex: токены :root, base-глобалы,
  svg/innerHTML-остаток, анимации; единственный legacy-блок внутри — `.result`-поп до его миграции).
  Батарея полная: tsc/eslint 0, vitest 28/236, lint 0, lint:arch 0 (143 модуля), lint:fsd clean,
  build 0, e2e 30/30, чекеры 9/9, diff 0/0/0.
- 2026-10-12: **ресёрч FSD v2.1 + стол → страница (вариант A)** — по просьбе владельца («по 2026
  ищем, обоснование и дока») пройден официальный справочник спеки: Layers → Widgets, Slices and
  segments, пример Auth, code smell Desegmentation (feature-sliced.design, v2.1). Ключевая цитата:
  блок, «составляющий большую часть содержимого страницы и нигде не переиспользуемый, — не виджет, а
  содержимое страницы»; плюс «You don't have to use every layer». Реализация: 42 файла
  `src/widgets/` → `src/pages/HomePage/{ui,model,lib}` (ui 32, model 8, lib 2), `HomePage.tsx` →
  `pages/HomePage/ui/HomePage.tsx`, дверь слайса `pages/HomePage/index.ts`; слой `widgets` удалён
  (дверь `@/widgets`, dep-cruiser `fsd-widgets-down-only` и упоминания в fsd-features/fsd-shared —
  сняты; steiger: widgets убран из files-глобов, комментарии переписаны);
  `fsd/no-segments-on-sliced-layers` off удалён — правило включено (проверено прогоном);
  `no-segmentless-slices` off подтверждён нужным (11 ошибок на плоских entities/features, новый
  слайс HomePage — с сегментами — проходит); 15 файлов переписаны на `../model|lib/...`
  (`tmp/rewrite_page_imports.py`); комментарии `app/hooks.ts`, `rollHistory/historySlice.ts`,
  STACK.md обновлены. Доки: ARCHITECTURE (метод, шпаргалка «куда класть», двери без `@/widgets`,
  структура с цитатой и критерием возврата слоя widgets); скилл `.opencode/skills/fsd-review`
  актуализирован — добавлен §«Обоснование структуры (FSD v2.1: почему так)» с цитатами спеки и
  историей решений. Dev-батарея зелёная: tsc 0, eslint 0, vitest 19/19 (переехавшие тесты), lint 0,
  lint:arch 0 (143 модуля), lint:fsd clean. Полная батарея — перед коммитом.
- 2026-10-12: **разнесение `pages/HomePage` по слоям FSD (widgets + владельцы)** — по просьбе
  владельца («надо разнести компоненты согласно доке», метод снизу вверх от `shared` по каждому
  юниту). Реализация: слайсы `widgets/{drawer,sheet,musicCard}/` (8+7+1 файлов, двери `index.ts`,
  `src/widgets/index.ts` — реэкспорты); кит оверлея (`OverlayHead`, `overlay.stylex`, `mt.stylex`) →
  `shared/ui`; хуки к владельцам стейта: `useDirtyPanel` → `features/tableUi`, `useSoundToggle` →
  `features/sound` (там же `useDispatch` из react-redux вместо `useAppDispatch` — иначе цикл
  `store → features-дверь → хук → store`); селекторы →
  `features/{tableUi, tableSetup,sound,music,uiScale,throwPower}/selectors.ts` +
  `entities/rollHistory/selectors.ts` (структурная типизация вместо RootState — без цикла через
  `app`), селектор стейта `useTableEngine` импортирует из `@/features`; форматтеры →
  `features/tableSetup/format.ts` (formatLabel/summarize/ shortSet) и
  `entities/rollHistory/format.ts` (formatParts/fmtTime/partClass), тесты разделены соответственно,
  `lib/` упразднён; `model/selectors.ts` оставил только экранный `selectPhase` (DOM-контракт
  `data-phase`); `OverlayHead` больше не импортирует дверь `@/shared` (цикл → `./mdIcon.utils`).
  Доки: ARCHITECTURE (шпаргалка «самодостаточный блок UI → widgets», структура страницы/слоя, кит в
  shared/ui), скиллы fsd-review (обоснование п.1 «оверлеи vs композиция», хуки-владельцы, Часть C: 6
  слоёв) и code-review. Dev-батарея зелёная: tsc 0, eslint+markdownlint 0, vitest 236/236 (29
  файлов), lint:arch 0 (156 модулей, 404 связи), lint:fsd clean. Полная батарея (build + e2e 30 +
  чекеры + diff) — перед коммитом.
