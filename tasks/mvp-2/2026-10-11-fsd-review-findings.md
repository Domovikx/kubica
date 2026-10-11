# FSD-ревью 2026_1011-1629: разбор находок волной за волной

Дата: 2026-10-11. Источник: `.opencode/skills/fsd-review/tmp/fsd-review_2026_1011-1629.md` (отчёты:
`tmp/review/fsd-2026_1011-1629/`). 37 находок → ~28 уникальных. Принято в работу целиком, приоритет
— блокеры → важные → быстрые дедупы → структурные переезды → сегментация.

## Цель

Все принятые находки ревью закрыты или осознанно отложены с решением в логе; механика
(lint:arch/lint:fsd) ловит новые нарушения закрытых классов; батарея зелёная после каждой волны.

## Волна 1 — блокеры границ + механика + быстрые дедупы

- [ ] 1.1 Миграция геометрии: `bodyRadius`, `toModelFrame` и связанные данные/типы из
      `entities/diceGeometry/geometry` вниз в `shared/dice`; `physics.ts`, `readout.ts`,
      `faceOrient.utils.ts` — импорты вниз/локально; убрать re-export `toModelFrame` из
      `faceOrient.utils.ts:40` (тест — прямой импорт).
- [ ] 1.2 `entities/rollHistory/history.ts` — `DieId` из `@/shared/dice/dieId.utils`, не через
      geometry-реэкспорт.
- [ ] 1.3 dep-cruiser: правило «shared не импортирует выше» (`from: src/shared` → только
      shared/node_modules); `tsPreCompilationDeps: true` (type-only импорты + ложный no-orphans).
- [ ] 1.4 `mtUiSlice` через публичный API виджета: экспорт из `widgets/mobileTable/index.ts`,
      `app/store.ts` — через barrel; steiger: `no-public-api-sidestep` включить точечно для
      `src/app/**`.
- [ ] 1.5 `MUTE_KEY`/`HAPTICS_KEY` — один источник (`sound.ts`), `soundSlice` импортирует.
- [ ] 1.6 Убрать фантомный `hooks/index.ts` (внешних потребителей нет — YAGNI) и type-re-export
      `HeadProps`/`DrawerProps`/`SheetProps` из barrel'ов.
- [ ] 1.7 `testPump.utils.ts` → вне прод-дерева (`src/testUtils/`), импорты тестов обновить.

Приёмка: tsc/eslint/vitest/lint/lint:arch/lint:fsd зелёные; в depcruise нет upward из shared;
app/store идёт через barrel; grep `entities/diceGeometry` в shared отсутствует.

## Волна 2 — композиция React (дедупы UI)

- [ ] 2.1 OverlayHead (шапка оверлея) + `useDirtyPanel(kind)` — Sheet/Drawer/MusicCard.
- [ ] 2.2 mute-toggle хук — Head/DrawerSoundSection (+ aria-зеркало музыки).
- [ ] 2.3 ChipGroup подкомпонент — SheetPresetsSection («Быстрые»/«Мои»).
- [ ] 2.4 `holdFiredRef` внутрь `useChipHold`; fit-рефы шапки внутрь Head/useFitHeadStar.
- [ ] 2.5 engine.ts: вынести throwAll/finishPack/runRound секции по образцу gestures.ts.
- [ ] 2.6 YAGNI-хвосты: `cancelToast` без потребителя; `showResult` без вызывателей — по решению.

Приёмка: e2e 30/30, чекеры 9/9, diff 0/0/0; файлы Sheet/Drawer/MusicCard ужались, поведение то же.

## Волна 3 — здоровье слайсов (переезды и решения)

- [ ] 3.1 `features/dicePool` — мёртвый слайс-дублёр: удалить (git сохранит) или подключить к
      планам; решение — в логе.
- [ ] 3.2 `entities/model`: подключить `MODELS` к engine (единый источник `.glb`-URL) либо удалить
      слайс.
- [ ] 3.3 Переименовать слайс `entities/model` (коллизия с сегментом) + единый шаблон имён
      (`rollDice`→`throwPower` и т.п., `dndMusic/music` — база=слайс).
- [ ] 3.4 `soundSlice` → features (стор настроек), shared — только движок звука.
- [ ] 3.5 `sheetPresets.utils` (сборка данных) → `features/tableSetup`; в ui — отображение.
- [ ] 3.6 `formatParts`/`formatLabel` → `widgets/mobileTable/format.ts`; в entities — типы.
- [ ] 3.7 `useStars`/`stars` (GitHub-счётчик) → features-слайс; виджет рендерит.
- [ ] 3.8 presetRev-проп → подписка на источник (useSyncExternalStore) — если не уехало в 3.5.

Приёмка: батарея зелёная; grep-проверки «нет бизнеса в shared/ui», «нет мёртвых слайсов».

## Волна 4 — сегментация и конвенции

- [ ] 4.1 Ввести сегменты `model`/`lib` хотя бы в растущих слайсах; вернуть
      `fsd/no-segmentless-slices` в steiger по мере готовности.
- [ ] 4.2 Зафиксировать конвенцию «папка компонента = PascalCase» в guidelines (или переименовать —
      решение в логе).
- [ ] 4.3 layoutSlots/LayoutPlan — развести имена и владельцев раскладки.
- [ ] 4.4 useStars-пороги формулы «Оценить репозиторий» — один владелец label-формулы.

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
- 2026-10-11: **волна 2 в работе**
  (OverlayHead/useDirtyPanel/mute-toggle/ChipGroup/holdFired/fit-refs/engine-декомпозиция).
