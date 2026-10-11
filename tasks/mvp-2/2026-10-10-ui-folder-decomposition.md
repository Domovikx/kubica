# Декомпозировать крупные компоненты mobile-table/ui в папки (folder-per-component)

Статус: DONE

## Задача от пользователя

«также рекомендую запланировать декомпозицию в стиле реакт компонентов тоесть например есть
src\widgets\mobile-table\ui\Drawer.tsx делаем src\widgets\mobile-table\ui\Drawer и в папке делаем
Drawer.tsx рядом выносим стики, хуки, утилиты и прочее. задача избегать божественных сущностей и
компонентов»

## Цель

Когда я читаю или меняю компонент стола, я хочу, чтобы крупный компонент жил в собственной папке со
своими стилевым модулем, хуками и утилитами, а не был «божественной сущностью» на 600 строк со всем
в одном файле. Критерий «стало лучше»: Drawer/Sheet/Head разложены по папкам, каждый файл < ~250
строк, поведение и пиксели не изменились (e2e/чекеры/diff зелёные).

## Контекст (что есть сейчас)

- Размеры (wc -l, 2026-10-10): `ui/Drawer.tsx` **629**, `ui/Sheet.tsx` **515**, `ui/Head.tsx`
  **330**, `ui/MusicCard.tsx` **226**, `MobileTable.tsx` **188**, `ui/Hint.tsx` **161**,
  `ui/Chip.tsx` **117**; общий stylex — `ui/overlay.stylex.ts` (используется Sheet/MusicCard/
  Drawer); `mt.stylex.ts` — база кнопок; хуки стола — `hooks/use-*.ts` (camelCase: `useChipHold` …),
  общие для виджета, не привязаны к одному компоненту.
- Каждый крупный компонент держит module-scope `stylex.create` + разметку + локальные хелперы —
  типичная «божественная сущность» (один файл = стили + логика + подкомпоненты).
- Контракты, которые нельзя ломать: маркеры `.mtable*` в className (в e2e/чекерах/audit),
  `data-testid`, `data-phase`, `__mtable.diePoint` (engine), поведение оверлеев (computed-diff
  0/0/0).
- Хуки в `hooks/` сейчас общевиджетные (`useToast` нужен и Head, и Drawer) — их слепое «переносить в
  папку компонента» сломает модульность.

## Что сделать (ресёрч, по протоколу `tasks/AGENT.md`)

1. Аудит крупных компонентов: что выносится в папку, а что остаётся общим:
   - В папку `ui/<Name>/`: `Name.tsx` (компонент), `Name.stylex.ts` (его stylex-блок, если после
     раздела останется крупный), подкомпоненты `<Name>Section.tsx`/`<Name>Row.tsx` и пр.,
     компонентные хуки `use<Name>*.ts` (если используются только этим компонентом).
   - Общее (не трогать): `hooks/useToast` и другие мульти-пользовательские хуки, engine, selectors,
     `overlay.stylex.ts` (пока используют более чем одним компонентом).
   - Вопрос ресёрча: делить ли `overlay.stylex.ts` на «по папкам» или оставить общим (гипотеза:
     оставить общим до тех пор, пока ≥2 компонента им пользуются; разделять, когда блок становится
     компонент-специфичным).
2. Порог «божественной сущности» (предложить и согласовать): файл > ~250 строк ИЛИ смешивает ≥3 роли
   (разметка + стили + локальная логика + подкомпоненты). По этому порогу в волну идут Drawer,
   Sheet, Head; MusicCard/Hint/Chip — на грани (решить по факту после первых двух).
3. Порядок волн: Drawer (самый крупный) → Sheet → Head → (опционально MusicCard); каждая волна —
   переезд + правка импортов + tsc/eslint/vitest + e2e/чекеры/diff после волны.
4. Импорт-контракт: снаружи продолжает работать `import { Drawer } from '.../ui/Drawer'` — папка с
   index/barrel НЕ нужна (импорт в `ui/Drawer/Drawer.tsx`... вопрос ресёрча: barrel
   `ui/Drawer/index.ts` re-export vs прямой путь к `Drawer.tsx` внутри папки; гипотеза — barrel ради
   чистых импортёров).
5. Реализация — после того, как человек согласует scope волн и порог (вопросы ресёрча 1–2, 4).

## Приёмка

- [ ] Структура: существуют `src/widgets/mobile-table/ui/Drawer/` (и `Sheet/`, `Head/`) с
      компонентом внутри; старые одиночные `Drawer.tsx`/`Sheet.tsx`/`Head.tsx` в `ui/` удалены.
- [ ] Размеры: ни один `.tsx` в `ui/` не превышает ~250 строк (`wc -l`).
- [ ] Импорты снаружи не сломаны: `npx tsc --noEmit` → 0; импортёры (`MobileTable.tsx` и др.)
      указывают на новые пути.
- [ ] Поведение не изменилось: `npm test` 30/254, e2e 30/30, батарея 9 чекеров OK,
      `node tmp/check/computed-diff.mjs --compare` = 0 (пиксель-контракт), `npm run build` ок.
- [ ] Контракты маркеров сохранены: grep по e2e/чекерам — все `.mtable*`/`data-testid` на месте
      (проверяется диффом и e2e автоматически).
- [ ] Хуки: каждый перенесённый в папку хук имеет ровно одного потребителя (grep импортов);
      мульти-потребительские остались в `hooks/`.

## Вне рамок (out of scope)

- Переименование/перемещение engine, selectors, mtUiSlice, mt.stylex.ts (база кнопок) — остаются на
  своих местах до отдельного решения.
- Рефакторинг логики внутри компонентов (вынос бизнес-логики в slices) — только структурная
  декомпозиция файлов.
- `.stylex.tsx` для подкомпонентов — не вводим (подкомпоненты — обычные `.tsx`; stylex-блоки, если
  выносятся, — `*.stylex.ts`).
- PWA/service worker, вёрстка, дизайн — не трогаем.

## Файлы (ожидаемые)

- `src/widgets/mobile-table/ui/Drawer/` — `Drawer.tsx` (+ `Drawer.stylex.ts`, подкомпоненты,
  компонентные хуки — по факту аудита).
- `src/widgets/mobile-table/ui/Sheet/` — аналогично.
- `src/widgets/mobile-table/ui/Head/` — аналогично.
- `src/widgets/mobile-table/MobileTable.tsx` — правка импортов.
- Опционально (по согласованию): `ui/MusicCard/`.

## Связи

- Стильный канон: `2026-10-10-stylex-migration.md` (маркер-merge, useCSSLayers, state-комбо);
  суффикс stylex-модулей: `2026-10-10-stylex-suffix.md`.
- Нейминг: `2026-10-10-camelcase-filenames.md` (camelCase для модулей, PascalCase для tsx).
- Протокол ресёрча: `tasks/AGENT.md`.

## Лог: волна Drawer (2026-10-11)

- `ui/Drawer.tsx` (629) → `ui/Drawer/`: `Drawer.stylex.ts` (164), `Drawer.tsx` (113 — шапка,
  dirty-логика, эффекты, сборка секций), `DrawerHistorySection.tsx` (131), `DrawerSoundSection.tsx`
  (83), `DrawerSocialSection.tsx` (78), `DrawerPowerSection.tsx` (60), `DrawerScaleSection.tsx`
  (65), `DrawerAboutSection.tsx` (34), barrel `index.ts` (импортёру `./ui/Drawer` правки не нужны).
  Все файлы < 250 строк.
- Секции сами тянут стор через селекторы (без prop-drilling); общий stylex оверлеев не делился
  (`overlay.stylex.ts` — ≥2 потребителя, по гипотезе задачи остаётся общим).
- Проверки: tsc 0, eslint 0, vitest 30/254, e2e 30/30 (1 flaky «удержание с паузой» — точечный
  перезапуск 3/3 passed; первая серия e2e после git mv падала из-за кэша vite на удалённый
  `ui/Drawer.tsx` — перезапуск dev-сервера, не связано с кодом), computed-diff чисто, чекеры 9/9.
- Опечатка во время работы: в `DrawerAboutSection` случайно оказалась comma-операция внутри
  `${sxSection.className ?? '', ''}` (ломала маркер) — поймана при ревью, поправлена.

## Лог: волна Sheet (2026-10-11)

- `ui/Sheet.tsx` (515) → `ui/Sheet/`: `Sheet.stylex.ts` (145), `Sheet.tsx` (176 — шапка, onSave,
  dirty, формула «Сохранить сет»), `SheetPresetsSection.tsx` (132 — чипы быстрых/моих, тап — выбор,
  удержание — удаление), `SheetDiceRows.tsx` (92 — степперы DIE_IDS), `sheetPresets.utils.ts` (34 —
  displaySets/sameCounts/BUILT_IN_NAMES), barrel `index.ts`. Все < 250.
- Ревизия пресетов: `presetRev` переезжает в Sheet (bump и на onSave, и из секции через `onMutate`)
  — без этого «Сохранить сет» не обновил бы чипы (поймано при ревью).
- `SheetDiceRows` НЕ берёт на себя обёртку `.mtableRows` — она осталась в Sheet (порядок DOM 1-в-1,
  пиксель-контракт); подкомпонент рендерит только внутренний `<div>` степперов.

## Лог: волна Head (2026-10-11)

- `ui/Head.tsx` (330) → `ui/Head/`: `Head.stylex.ts` (123), `Head.tsx` (211), barrel `index.ts`.
  Подкомпоненты HeadLeft/Ctl/Side не заводились — после выноса стилей файл < 250, разбиение добавило
  бы только indirection (YAGNI).

## Итог приёмки (проверено после волн Drawer/Sheet/Head)

- Структура: `ui/Drawer/`, `ui/Sheet/`, `ui/Head/` с компонентами и barrel `index.ts`; старых
  одиночных `Drawer.tsx`/`Sheet.tsx`/`Head.tsx` в `ui/` нет.
- Размеры: ни один `.tsx` в `ui/` не > 250 (максимум — MusicCard 226, в волну не шёл: ниже порога, в
  задаче оставлен «по факту» — решено не декомпозировать).
- Импорты снаружи не менялись (`./ui/Drawer` и др. через barrel): `npx tsc --noEmit` → 0.
- Поведение: `npm test` 30/254, e2e 30/30 (серии без flaky после перезапуска vite), батарея 9
  чекеров OK, computed-diff чисто (0/0/0), `npm run build` ok, `npm run lint` 0 issues, `lint:arch`
  — 1 pre-existing warn (dieId.utils.ts).
- Хуки: в папки не переносились (useToast/useStars/useFitHeadStar — мульти-потребители, остались в
  `hooks/`); компонентных хуков с ровно одним потребителем не появилось.
- overlay.stylex.ts остался общим (потребители Drawer/Sheet — ≥2, по гипотезе ресёрча).
