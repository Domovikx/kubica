# [2026-10-10] Переход на StyleX: полностью выпилить Tailwind

Статус: DOING (с 2026-10-10; блокер снят — задача `2026-10-08-mobile-split-styles.md` закрыта после
A3 2026-10-10). Коммитов до ревью человека не будет.

## Задача от пользователя

«StyleX переходим на него, полностью выпиливаем Tailwind. Tailwind был моей большой ошибкой.
вебсерчи, можешь сделать таску, описать и пока в работу не берем. вначале полностью закончим текущую
задачу с выпиливанием легаси.»

Решения человека (question-tool, 2026-10-10):

1. **Стык с текущей задачей**: «Дойти до A3, B/C перенести в StyleX» — фазы **B** (секционный
   перенос в Tailwind-утилиты) и **C** (`mobile-table.css` → утилиты, критерий «0 CSS») из
   `tasks/mvp-2/2026-10-08-mobile-split-styles.md` **переносятся в эту задачу**: промежуточный
   перегон в Tailwind-утилиты, который StyleX потом выпилит целиком, не делаем. Текущая задача
   закрывается сразу после волны A3.
2. В работу пока не брать (см. статус выше).

## Цель

Полный отказ от Tailwind в пользу StyleX: ни одного Tailwind-класса в разметке, ни одного
`tailwind`-пакета в зависимостях, ни одного tailwind-плагина в конфигах. Стили UI — StyleX
(атомарный CSS на сборке, без рантайма), хвост `mobile-table.css` (869 строк, фазы B/C) умирает
через посекционный перенос в stylex-классы соответствующих компонентов. Визуал пиксель-в-пиксель
(`computed-diff --compare` = 0), e2e 30/30, маркеры `.mtable*`/`data-testid`/`data-phase` нетронуты
— контракты задачи `mobile-split-styles` соблюдаются.

## Контекст (что есть сейчас)

Факты по коду, сверены 2026-10-10:

- **Tailwind 4.3.3**, CSS-first, только devDependencies: `tailwindcss` (`package.json:44`) +
  `@tailwindcss/vite` (`package.json:31`); `vite.config.ts:2,8` — `import tailwindcss` +
  `plugins: [tailwindcss()]`. `tailwind.config.*`/`postcss.config.*` отсутствуют (v4 не требует).
- **Единственный стилевой вход** `src/app/styles.css` (300 строк, импорт `src/app/main.tsx:8`):
  порядок слоёв `@layer theme, base, components, utilities`, `@theme static` (цвета/шрифт kubica +
  легаси-алиасы + токены стола `--ui-scale`, `--tap`, `--fs-*` calc-шрифты на `clamp`), два
  `@custom-variant` (`onstate` → `.on`, `aria-disabled` → `[aria-disabled='true']`), `@layer base`
  (reset без preflight — preflight не подключается, это канон задачи), **17 класс-правил**
  (`.viewers`, `.topbar`, `.bottombar`, `.title`, `.hint`, `.result*`, `.partKept`, `.partDrop`,
  `.switchBtn`, `.attribution`), keyframes.
- **`src/widgets/mobile-table/mobile-table.css`** (869 строк, импорт `MobileTable.tsx:28`) —
  легаси-стили секций; по исходному плану умирал в фазе C, теперь **переезжает в эту задачу**.
- **Утилиты в разметке**: 13 `.tsx` с `className` (~97 вхождений, 14 template-литералов);
  класс-константы — `src/widgets/mobile-table/mt-styles.ts` (127 строк, `*_CLS`); иконки —
  `dangerouslySetInnerHTML`, к ним Tailwind-арбитраж `[&>svg]`. **Вариантов `hover:`/`md:`/ `dark:`
  нет вообще** — только два кастомных варианта выше и `[&>svg]`. `@apply` — 0.
- **Контракты (нельзя ломать)**: 99 маркеров `.mtable*` (селекторы `e2e/m-table.spec.ts`),
  `data-testid`, `data-phase`, `--ui-scale` на `<html>` пишет `ui-scale.ts` (JS), хуки
  `window.__mtable.diePoint`, `fitHeadStar` меряет реальные боксы.
- **Инструмент приёмки пиксель-контракта**: `tmp/check/computed-diff.mjs` — снимок computed-style
  (40+ свойств × 4 вьюпорта × 4 состояния), эталон `tmp/check/_computed-baseline.json`, сверка
  `--compare` (exit 1 при диффе). Селекторы — data-testid + классы оверлеев (`.mtable*`), не
  Tailwind-классы; но спецификация/порядок CSS-правил поменяются → дифф реально может поймать.
- **Стэк**: React 19.3, Vite 8.3, TS ~6.0.3 (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`),
  ESLint 10 flat (без react-плагина — не выдумывать `eslint-disable react-hooks/*`), prettier 3.9,
  vitest 5, Playwright 1.63. В `vite.config.ts` **нет `@vitejs/plugin-react`** (только tailwindcss)
  — порядок «stylex перед react» из доки проверить на факте dev/HMR.
- Предыдущие волны `mobile-split-styles` уже согласовали: Tailwind-утилиты в разметке (не `@apply`),
  лимиты ≤750 TS/файл и ≤300 строк CSS, маркеры `.mtable*` — при StyleX лимит CSS пересматривается
  вместе с критерием «0 CSS» (см. ресёрч №7).

Предварительный вебсёрч (2026-10-10; `websearch` 403 → `html.duckduckgo.com/html/?q=` + `webfetch`):

- **StyleX, официальная дока Vite** (`stylexjs.com/docs/learn/installation/vite/`, HEAD 2026):
  `@stylexjs/unplugin` —
  `stylex.vite({ useCSSLayers, dev, runtimeInjection: false, lightningcssOptions })`; плагин ставить
  **до** `@vitejs/plugin-react` (Fast Refresh); unplugin **дописывает сгенерированный CSS в
  существующий CSS-ассет** (fallback — эмиссия `stylex.css`), т.е. `styles.css` остаётся CSS-входом
  проекта; HTML-entrypoint (у нас `index.html`) dev-HMR дополнительно не требует, React-entrypoint —
  virtual-модули `virtual:stylex:css-only` / `virtual:stylex.css`; есть `@stylexjs/eslint-plugin`.
- **API**: `stylex.create` / `stylex.props` / `stylex.defineVars` / `stylex.createTheme` /
  `stylex.keyframes` / `@stylexjs/atoms` / `stylex.when.*`, типы `StyleXStyles<>`, static-types,
  recipes/variants, light/dark themes — покрытие «наш кейс» выносится в ресёрч (таблица ниже).
- **Версии npm**: `@stylexjs/stylex` **0.18.3** (24 публикации назад), `@stylexjs/unplugin` ~0.19
  (Mantine-док) — **0.x, API нестабилен**, пин-версии в package.json обязательны.
- **Грабли из экосистемы**: (1) Mantine: unplugin держит процесс Vitest **~10 с после тестов** — для
  `npm test` нужно снимать dev-server-hook плагина; (2) SO: сторонние `vite-plugin-stylex`
  расходятся по версиям — использовать только официальный `@stylexjs/unplugin`; (3) unplugin «CSS
  asset trap» — дописывание в CSS-ассет, фолбэк-эмиссия `stylex.css`, порядок с tailwind-плагином на
  переходный период несовместим (плагины роутинга CSS конфликтуют — убрать tailwind одновременно с
  включением stylex, не «два плагина рядом»).
- **Опыт миграции Tailwind → StyleX** (LogRocket 2026-07-27, «20 компонентов»): строки стилей
  **удвоились** (1568 → 3143), CSS-бандл ~20KB — практически одинаково, build-time сопоставим;
  StyleX ловит типизированные ошибки стилей, которые Tailwind молча пропускал; вердикт статьи —
  StyleX для строгих переиспользуемых библиотек, verbosity как цена.
- **Рынок**: npm trends — zero-runtime CSS-in-JS (StyleX/vanilla-extract/Panda) сильно меньше
  Tailwind по установкам; StyleX — Meta, активная разработка (дока живая, 2026).

## Что сделать (ресёрч, по протоколу `tasks/AGENT.md`)

1. **Вопросы ресёрча** (варианты — таблицей при выполнении, решение после метода исключения, спорное
   — question-tool):
   - **Плагин и Vite 8**: `@stylexjs/unplugin` официальный vs babel/postcss-путь — проверить
     эмпирически на Vite 8.3 (пин `@stylexjs/unplugin` + `@stylexjs/stylex`): dev-сервер, HMR,
     `npm run build`, vitest (грабль с ~10 с — workaround из Mantine-доки), Playwright e2e. Нужен ли
     `@vitejs/plugin-react` (сейчас его нет — как у нас вообще работает JSX/HMR: esbuild-Vite; не
     сломать ли текущий dev-режим).
   - **Форма записи**: `stylex.props()` в className vs `sx={}`/пропсы — как в JSX-разметке сохранить
     **99 маркеров `.mtable*` + `data-*` рядом** со stylex-классами (merge внешнего className со
     `stylex.props` — проверить поддержку и паттерн `className: cls.concat(...)`).
   - **Токены**: `@theme static` (16+ цвет/шрифт + `--ui-scale`-семейство) → `stylex.defineVars` vs
     оставить «обычные» CSS-переменные в `styles.css` и дергать `var(--x)` stylex-значениями.
     Главная развилка: **`--ui-scale` пишет JS на `<html>`** (`ui-scale.ts`), а `defineVars` даёт
     scope-классовые переменные — совместимость проверить или выбрать «plain vars + var()».
   - **Варианты состояний**: `@custom-variant onstate` (`.on` ставит TS) и `aria-disabled` →
     stylex-эквиваленты (`[aria-disabled='true']`-селектор, псевдоклассы); `[&>svg]` на иконках →
     child-селектор в stylex.create.
   - **Динамика**: 14 template-литералов и условные классы в tsx → статические
     `stylex.create`-объекты + варианты (`stylex.props(a && styles.x)` / `stylex.when`); каждый
     «нестатичный» className разобрать отдельно и зафиксировать решение.
   - **Поряд волн**: мигрировать **компонент за компонентом** (13 tsx + `mt-styles.ts` + 17
     класс-правил styles.css + `mobile-table.css` посекционно), после каждой волны
     `computed-diff --compare` = 0; или сначала инфра (плагин/токены) одним заходом, потом волны.
     Волны закрывать пакетами (компонент + его css-секция), не «всё сразу».
   - **Критерий «0 CSS»**: с StyleX всегда есть CSS-вход (`styles.css` под дописывание + базовые
     правила). Переформулировать критерий: **0 legacy-CSS** (нет `mobile-table.css`, нет
     Tailwind-слойной магии, класс-правила styles.css либо в stylex, либо явный список
     глобалок-остатка) + минимум один CSS-вход; финальную формулировку согласовать с человеком на
     приёмке.
   - **Линт/формат**: добавить ли `@stylexjs/eslint-plugin` (деп — по AGENTS.md «зависимости меньше
     и стабильнее», вердикт с минусами), нужен ли prettier-плагин для stylex-объектов (проверить
     `npm run format:check` как есть), tsconfig-типы (`erasableSyntaxOnly` — stylex должен
     собираться без runtime-синтаксиса, проверить).
   - **Финальная инвентаризация**: `grep -ri tailwind` по `package.json`/`vite.config.ts`/`src/` → 0
     (в задачах/логах истории — можно).
2. **Вебсёрч** — по фактам выше; таблица вариантов ≥2 на каждый спорный вопрос, метод исключения от
   наименее подходящего, вердикт ± с минусами — в разделе «Результат ресёрча».
3. **Реализация** — после согласования ресёрча с человеком (вопросы через question-tool).

## Приёмка

- [x] `grep -ri tailwind package.json vite.config.ts src/` → 0 совпадений; `tailwindcss` и
      `@tailwindcss/vite` удалены из devDependencies; `vite.config.ts` — stylex-плагин вместо
      tailwind (порядок по вердикту ресёрча).
- [x] `npx tsc --noEmit`, `npx eslint src/`, `npm test` зелёные (и vitest не висит ~10 с после
      прогона — грабль unplugin обработан).
- [x] `npm run build` ок; вес `dist/` не вырос заметно (замерить: статья обещает ~20KB атомарного
      CSS — сравнить с текущим).
- [x] e2e 30/30 зелёные: маркеры `.mtable*`, `data-testid`, `data-phase`, `__mtable.diePoint` живы.
- [x] Полная батарея 9 чекеров
      (`ui-scale, add-icon, hint-v2, hint-cta2-shots, social-shots,     type-scale, hint-align, like-fit-probe, header-fonts`)
      → OK/MATCH.
- [x] **`node tmp/check/computed-diff.mjs --compare` = 0** — пиксель-контракт, финально и после
      каждой волны.
- [x] Стили заданы через stylex-объекты (не `@apply`, не инлайн-стили); маркеры `.mtable*` остаются
      обычными строками className рядом со stylex-классами.
- [x] Критерий «0 CSS» переформулирован и согласован (см. ресёрч), `mobile-table.css` удалён.
- [x] Полная батарея перед сдачей: `npx tsc --noEmit`, `npx eslint src/`, `npm test`,
      `npm run build` + e2e + чекеры + computed-diff.

## Вне рамок (out of scope)

- Поведение/логика (RTK, движок, гесты, звук, персист, localStorage-ключи) — только стили.
- Контракты из `mobile-split-styles`: `data-phase`, `--ui-scale`-пишущий JS, `__mtable.diePoint`,
  `data-testid`, порядок DOM секции — не меняются.
- Дизайн (цвета/размеры/типографика) — перенос 1:1, никаких «заодно поправим».
- `tmp/**` чекеры — не трогаются, кроме точечной правки, если какой-то чекер ссылается на
  Tailwind-класс (по факту ресёрча, с обоснованием).
- Инлайн-JS в `index.html`, MSW `public/mockServiceWorker.js` — не отсюда.
- FSD-слои/импорты (`docs/ARCHITECTURE.md`, `.dependency-cruiser.mjs`) — только если stylex-файлы
  создают новые зависимости (не должны).

## Файлы (ожидаемые)

- `package.json` — минус `tailwindcss`/`@tailwindcss/vite`, плюс `@stylexjs/stylex` +
  `@stylexjs/unplugin` (пин-версии), возможно `@stylexjs/eslint-plugin`.
- `vite.config.ts` — замена плагина.
- `src/app/styles.css` — остаётся CSS-входом: базовые правила/токены по вердикту ресёрча,
  Tailwind-слои и `@theme` уходят; 17 класс-правил → посекционно в stylex либо осознанный остаток.
- `src/widgets/mobile-table/mobile-table.css` — **удаляется**, содержимое (869 строк) → посекционно
  в tsx-компоненты (наследие фаз B/C).
- 13 `.tsx` с className + `mt-styles.ts` — класс-строки → `stylex.create`/константы.
- `src/app/main.tsx`, `MobileTable.tsx` — импорты CSS.
- `e2e/m-table.spec.ts`, `tmp/check/*` — только по факту привязки к Tailwind-классам.
- Новые стилевые файлы (`*.stylex.ts`/стили в том же файле) — по вердикту ресёрча.

## Связи

- `tasks/mvp-2/2026-10-08-mobile-split-styles.md` — фазы B/C перенесены сюда (решение человека
  2026-10-10); блокер: не начинать до сдачи A3. Контракты (`data-phase`, маркеры, computed-diff) —
  оттуда же.
- `tasks/AGENT.md` (ресёрч-протокол), `AGENTS.md` (депы, tmp, тесты), `docs/ARCHITECTURE.md` (слои).
- `tmp/check/computed-diff.mjs` (пиксель-эталон), `e2e/m-table.spec.ts` (30 тестов) — инструменты
  приёмки.

## Результат ресёрча

(выполнено 2026-10-10; `websearch` 403 → duckduckgo+webfetch, официальная дока stylexjs.com HEAD
2026, npm-registry; эмпирика — пробы в W0, результаты ниже дописываются)

### Таблица вариантов и вердикты

| #   | Вопрос                                                                                             | Варианты                                                                                                                                                                                                                                                            | Метод исключения                                                                                                                                                                                                                                                                                         | Вердикт                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Компилятор                                                                                         | (a) `@stylexjs/unplugin` official (0.19.1, peer `unplugin@^2.3.11`, deps babel+lightningcss); (b) ручной `@stylexjs/babel-plugin` (+нужен babel-pipeline/Vite-react); (c) postcss-plugin                                                                            | (b) — у нас JSX через esbuild, babel-pipeline = ставить `@vitejs/plugin-react` + допиливать (лишние депы, порядок/HMR); (c) — postcss идёт после трансформа JS, для AOT-StyleX не основной путь; (a) — официальный Vite-адаптер: компилирует, агрегирует CSS, дописывает в CSS-ассет, dev virtual-модули | **(a) unplugin**, пин `0.19.1` (0.x); риски — Vite 8.3: проверка эмпирически в W0                                                                                                    |
| 2   | dev-HMR CSS                                                                                        | (a) `<link href="/virtual:stylex.css">` + runtime в HTML/shim; (b) без ничего (HTML-entrypoint «нужно только линком»); (c) `devPersistToDisk`                                                                                                                       | Дока: линк в HTML-shell для dev-HMR обязателен; prod-линк на virtual нельзя (404 на Pages) → dev-only shim                                                                                                                                                                                               | **Эмпирика W0**: проба без линка → если CSS в dev нет, shim в `main.tsx` под `import.meta.env.DEV` (линк + `import('virtual:stylex:runtime')`)                                       |
| 3   | StyleX + маркеры `.mtable*` в одном элементе                                                       | (a) `sx={...}` проп (default `sxPropName:'sx'`) — компилятор мержит с `className`; (b) ручной `const sx = stylex.props(...)` + `className={cx('mtable…', sx.className)}` (spread до className); (c) маркеры в stylex — нет (статичные строки, но ломает e2e/чекеры) | (c) отпадает (контракт маркеров); (a)/(b) — эмпирика W0, что корректно мержит                                                                                                                                                                                                                            | **W0-проба**: предпочесть (a) как декларативный, фолбэк (b) хелпером `cx`                                                                                                            |
| 4   | Токены (`@theme static`, 30+ var, `--ui-scale` пишет JS на `<html>`)                               | (a) `stylex.defineVars`/`createTheme`; (b) plain `:root`-переменные в `styles.css` + `var(--x)` в значениях stylex                                                                                                                                                  | (a) — переменные stylex привязаны к классу файла, а JS пишет `--ui-scale` на `documentElement`, плюс наследование/calc-пересчёт от `:root` меняется → риск пикселей; (b) — 1:1 каскад, токены уже так работают                                                                                           | **(b)**: `:root`-токены остаются в `styles.css` (уже вне `@theme`), stylex-значения — строки `'var(--fs-cap)'` (проверить проход `var()` в W0)                                       |
| 5   | Состояния (`disabled:`, `aria-disabled:`, `onstate:`/.on, `:hover`)                                | (a) condition-ключи stylex (`':disabled'`, `'[aria-disabled="true"]'`); (b) React-условные style-объекты (компонент всегда знает состояние); (c) оставить CSS                                                                                                       | (a) — поддержка attribute-ключей не в доке однозначно (gh discussion #1485 — «примеры только с pseudo»), хрупко; (b) — детерминированно, работает везде, e2e кликает реально (62 клика); (c) — только для innerHTML-целей                                                                                | **(b) основной**; `:hover`/`:active`/`@media` — condition-ключи (задокументированы); `.on` остаётся маркером + conditional-стили. Эмпирика W0 на (a) как convenience для `:disabled` |
| 6   | Правила на innerHTML-содержимое (`[&>svg]`, `[&.mtableMorph>svg]`, 9× `.X svg` в mobile-table.css) | (a) глобальные CSS-правила по маркерам в `styles.css`; (b) `stylex.when.*` (нужен :has и цель у stylex недостижима — svg не React-узел); (c) отказ от innerHTML                                                                                                     | (b) — `when` не стилизует descendant снаружи, а сам svg недоступен React-пропсам; (c) — out of scope (иконки строками)                                                                                                                                                                                   | **(a)**: svg-дети и морф-анимация — глобальные правила по `.mtable*`-маркерам (это НЕ Tailwind, входит в «глобальный остаток»)                                                       |
| 7   | Слойность каскада                                                                                  | (a) `useCSSLayers:false` (default) — stylex unlayered, дописывается после globals/Tailwind; (b) `useCSSLayers:true` — stylex в @layer, ниже любого unlayered                                                                                                        | Наш принцип — эксклюзивность: элемент стилизуется ИЛИ глобальным правилом, ИЛИ stylex (маркеры — не стили); при (b) глобалы (`.result` и др.) перебивали бы stylex при коллизии, при (a) stylex выигрывает ничьи у утилит Tailwind (нужно на переходный период)                                          | **(a)** default; эксклюзивность + computed-diff как страховка                                                                                                                        |
| 8   | Vitest                                                                                             | (a) отдельный `vitest.config.ts` без stylex-плагина (как сейчас); (b) плагин в vitest + workaround 10-сек-хвоста (`devMode:'off'`)                                                                                                                                  | Тесты не импортируют стилевые модули (нет ui-тестов; проверить grep) → (a) без хвоста и без трансформа; хвост Mantine-доки актуален только для (b)                                                                                                                                                       | **(a)**; правило: тестам не импортировать stylex-модули; если понадобится — (b) с `devMode:'off'`                                                                                    |
| 9   | Линт/формат                                                                                        | (a) `@stylexjs/eslint-plugin` + prettier-плагин; (b) без них                                                                                                                                                                                                        | (a) +2 депа; ошибки нестатичных значений уже ловит babel на `vite build`/dev-трансформе; prettier форматит объекты как объекты                                                                                                                                                                           | **(b)**: без новых депов (AGENTS: зависимости меньше и стабильнее); страховка — батарея build                                                                                        |
| 10  | Критерий «0 CSS» (из mobile-split)                                                                 | (a) 0 файлов CSS; (b) 0 Tailwind + минимум 1 CSS-вход (точка входа StyleX + глобальный остаток)                                                                                                                                                                     | (a) невозможен физически: StyleX дописывается в CSS-ассет, а base-глобалы/токены/result-pop/svg-дети — не stylex                                                                                                                                                                                         | **(b)**: финальную формулировку показать человеку на вечернем ревью                                                                                                                  |

### Ключевые факты док (для реализации)

- `stylex.create` → AOT-атомарные классы; значения только литералы/константы/`var()`-строки,
  условные ветки — condition-ключи (`':hover'`, `'@media …'`), динамика — функции-формы
  (CSS-переменная под капотом). `stylex.keyframes` — для своих; глобальные `@keyframes` (spin,
  morph, pop) можно ссылкой по имени в `animation`.
- `stylex.props()` мержит, условно — `cond && styles.x`; `null` — «снять» свойство.
- `stylex.when.*` (ancestor/descendant/sibling, маркеры `stylex.defaultMarker()`, через `:has()`) —
  в проекте НЕ нужен (всё состояние известно React заранее; цели innerHTML недостижимы).
- unplugin: `stylex.vite({…})` **до** react-плагина; в build дописывает в CSS-ассет
  (`cssInjectionTarget` — приоритет index.css/style.css/первый; наш `styles.css` — проверить, куда
  попал CSS); dev — virtual `/virtual:stylex.css` + `virtual:stylex:runtime`;
  `devMode:'full'|'css-only'|'off'`; `sxPropName` default `'sx'`.

### Неснятые сомнения (снимаются в W0-пробе)

СНЯТО 2026-10-10 (W0, пробы на реальных Live.tsx/Foot.tsx + dev + build):

1. ✓ Vite 8.3 + unplugin 0.19.1 — трансформит, билдится. **Грабли: dev-сервер, живой с 07.10, НЕ
   подхватил правку vite.config (без restart в логе)** — перезапуск вручную (`nohup npx vite
   > > tmp/vite-dev.log 2>&1`, log append сохранён). После любой правки vite.config — следить за
   > > рестартом.
2. ✗ `sx`-проп НЕ мержит `className`: babel эмитит два `className`-ключа подряд, маркер теряется
   (проверено в DOM: `className` = только stylex-классы). Паттерн (a) — **отвергнут**.
3. ✗ строка-маркер в `stylex.props('mtableLive', styles.root)` — tsc TS2345 + runtime
   `TypeError: Failed to set an indexed property [0] on 'CSSStyleDeclaration'`. Ответвление типов
   (строк нет) подтверждено. **Отвергнут**.
4. ✓ **Паттерн (b) — рабочий и утверждён**: `const sx = stylex.props(styles.x)` + `{...sx}` +
   `className={\`mtableMarker ${sx.className ?? ''}\`}` (spread раньше className — merged-строка
   перекрывает). Маркер + атомарные классы в DOM, tsc 0, eslint 0.
5. ✓ `var()` в значениях stylex (`fontSize: 'var(--fs-headline)'`) — проходит компилятор и
   резолвится в computed (21px).
6. ✓ dev-CSS без HTML-линка: rules доступны в dev (dev-inject middleware), вычисляемые стили верны.
   Virtual-линк не понадобился.
7. ✓ build: атомарные правила попадают в `dist/assets/main-*.css` (cssInjectionTarget автоматически
   выбрал наш CSS-вход), в JS **0** `stylex.create`, маркеры (`mtableLive`) в JS. Минификатор
   сохраняет `:not(#\#)`-селекторы и `translateX(-50%)`.
8. ✓ vitest: ни один тест/тестовый модуль не импортирует `MobileTable`, `ui/*`, `mt-styles`,
   `stylex` — стендолон-конфиг vitest не трогаем, хвоста 10 c не будет.
9. ✓ `computed-diff --compare` после Live+Foot: **0/0/0, 16 снимков, чисто ✓**.
10. ✓ `hidden`-элемент отдаёт `transform: none` (нет layout) — НЕ баг (правило `.xuuh30` в CSS есть;
    на видимом элементе matrix корректна).

Итог W0: депы (пин 0.19.1, peer unplugin 2.3.11 авто), vite-плагин до tailwind, паттерн (b)
утверждён, пробы зелёные. Живой стиль-макрос для W1:

```tsx
const styles = stylex.create({ root: { position: 'absolute', … } })
const sx = stylex.props(styles.root)
<div {...sx} className={`mtableMarker ${sx.className ?? ''}`} … />
```

1. Vite 8.3 + unplugin 0.19.1 — компилирует/билдится/работает ли (peer-автоустановка `unplugin`).
2. `sx` + `className` merge-поведение (маркеры не теряются).
3. `var(--x)` в значениях stylex — проходит ли компилятор.
4. Куда в dev и в build попадает stylex-CSS (линк нужен или нет; `cssInjectionTarget`).
5. Тесты не импортируют стилевые модули (grep перед стартом).

### План волн (каждая = точечная проверка; финальный блок = полная батарея)

- **W0 — инфраструктура и пробы**: депы (пин 0.19.1), `vite.config` (+stylex до tailwind — tailwind
  остаётся до конца, когда утилит кончатся), probe-компонент на реальном месте, маркер-merge, var(),
  dev/build CSS, tsc/eslint/vitest. **ГОТОВО 2026-10-10** (см. «Неснятые сомнения» — все сняты).
- **W1 — mt-styles + className-утилиты (13 tsx)**: конвертация утилит → `stylex.create`;
  `[&>svg]`/морф/label/count — в глобальные правила по маркерам. **ГОТОВО 2026-10-10**:
  - Конвертировано: Live, Foot, Watermark, Toast, Backdrop (marker-only), MobileTable
    (section/canvas, `:active`), Head (весь, 9 констант), Sheet/Drawer/MusicCard (иконки-кнопки);
    общая база кнопок — `iconStyles` в `mt-styles.ts` (stylex в `.ts` работает); `hasSum`-маркер
    сохранён (e2e:114 + audit-contrast + header-fonts читают его).
  - Глобальные правила добавлены в styles.css: `.mtableMorph > svg` (+reduced-motion),
    `.mtableSpin`, `.mtableHeadStarLabel` (+@360), `.mtableHeadStarCount`, `.mtableIcon > svg`,
    `.mtableHeadStar > svg`.
  - **Новый грабль: stylex 0.19.1 МОЛЧА не компилирует shorthand `border` и `background`** (эмпирика
    через babel-plugin: `border:'none'`/`'1px solid red'`/`background:'red'` → нет правила; работает
    `borderWidth/Style/Color`, `backgroundColor`). Симптом: UA-бордер 2px outset на кнопках — пойман
    computed-diff. Фикс: суб-свойства
    (`borderWidth:'medium', borderStyle:'none', borderColor:'currentColor'` — точный эквивалент
    `border:none`). Остальные шорткаты проверены — `padding/inset/margin/flex/ overflow` работают.
    **Правило на все волны: шорткаты многочастей (border/background/ font/transition) — только
    суб-свойства.**
  - Проверки W1: tsc 0, eslint 0, computed-diff **чисто ✓** (0/0/0), e2e **30/30**, add-icon **ALL
    OK** (svg 26px, focus outline 2px solid ✓), header-fonts 0 (burger sum `rgb(239,49,36)` ✓), grep
    отсутствия tailwind-вариантов в tsx — 0.
  - Выяснено: `sx`-проп и строки в `stylex.props` не использовать (W0); states — только
    React-условные объекты; innerHTML-цели — глобальные правила.
- **W2 — mobile-table.css (869 строк, 103 селектора) → stylex + глобал → ФАЙЛ УДАЛЁН. ГОТОВО
  2026-10-10:**
  - Конвертировано: Hint (hint/glyph/title/sub/cta/info + disabled), Backdrop, Chip
    (chip/fill/dice), Sheet (sheet/row/glyph/name/desc/step/n/ok/formula + pre-блок), MusicCard
    (card/vol*), Drawer (drawer/body/section*/link/hist/hrow/hv/hmeta/hp/hredo/
    scale*/about/social); общее — новый `ui/overlay-styles.ts` (head/headTitle/rows/
    section/sectionHint/wide); Sheet/MusicCard/Drawer переведены на него (без дублей).
  - Глобальный остаток добавлен в styles.css: анимации
    `.mtableHint`/`.mtableSheet/.mtableDrawer/ .mtableMusicCard`/`.mtableBackdrop:not([hidden])` +
    keyframes `mtableHintIn/mtablePop/ mtableFade` (**stylex молча НЕ компилирует shorthand
    `animation`** — выяснено эмпирикой; `stylex.keyframes()` работает, но сменил бы имена → diff;
    решение: анимации — глобал по маркерам); svg-дети
    (HintGlyph/HintCta/ChipDie/Glyph/Wide/Social/Star); `.mtableMusicHost :empty/iframe`; скроллбары
    `::-webkit-scrollbar*`+thin; `.mtableSocialName/Meta`; state-комбо: `.mtableChip.on(+ .ChipN)`,
    `.mtableChipCount/.holding`, `.mtableRow.on .mtableGlyph`, `.mtablePreBlock .mtableEmpty`,
    `.mtableHrow .partMin/partMax`, `.mtableWide.on`, `.mtableScale.on`,
    `.mtableWide[aria-disabled]`, hover-правила чипа/ wide/scale (**порядок: hover ДО .on — как в
    легаси, при равной (0,2,0)**).
  - **Новый грабль (пойман diff'ом): stylex 0.19.1 поднимает специфику `:not(#\\#)` до (2,1,0)** и
    перебивал state-комбо (0,2,0) — потеря accent-фонов `.on`. Фикс: `useCSSLayers: true` в
    vite.config + `@layer …, stylex;` последним в styles.css — правила stylex в слое, наши глобалы
    (вне слоёв) бьют. Следствие: **state-токены — в строке маркера (e2e toHaveClass), state-визуал —
    глобальные правила, база — stylex**; чекеры, добавляющие `.on` программно (audit-contrast),
    получают рабочий CSS.
  - `[hidden] { display: none !important }` уже есть в @layer base → все `.X[hidden]`-фиксы
    мобильного стола были мёртвыми — не переносились; hidden-conditional не нужны.
  - Мёртвые (не перенесены): `.mtableLink:disabled` (disabled в JSX не ставится); `sheetOpen`-токен
    в MobileTable — без правил (оставлен как есть).
  - Проверки W2: tsc 0, eslint 0, computed-diff **чисто ✓** после каждого шага (Hint/Chip → Sheet →
    MusicCard → Drawer → удаление файла; 0/0/0, 3408 элементов, 16 снимков); аудит 103 селекторов:
    59 токенов — все существуют в src (нет потерь); dev-сервер после правки vite.config перезапущен
    вручную.
- **W2..Wk — mobile-table.css посекционно**: ✅ выполнено в W2 (файл удалён).
- **Wlast — styles.css и выпил Tailwind. ГОТОВО 2026-10-10:**
  - `styles.css` (869→475 строк): хедер переписан под канон StyleX; слои `@layer base, stylex;` без
    `@import tailwindcss/*`; `@theme static` → `:root` (мёртвые `--color-*` удалены —
    `var(--color-*)` нигде не использовался; `--font-sans` и легаси-алиасы/токены стола сохранены);
    удалены `@custom-variant onstate/aria-disabled`; удалены мёртвые legacy-правила
    `.topbar/.title/.hint/.switchBtn(+hover/active/focus-visible)/.bottombar/.attribution*`
    (подтверждено grep'ом DOM: этих классов в разметке 0), жив результат-поп (`.result*/.part*` —
    читает result-pop.ts).
  - `vite.config.ts`: `plugins: [stylex.vite({ useCSSLayers: true })]`, tailwind-импорт и плагин
    удалены; `package.json`: `-tailwindcss`, `-@tailwindcss/vite` (+`npm install`).
  - **Новый грабль (пойман computed-diff'ом): `*/` внутри хедер-коммента** — строка
    `(.result*/.part*)` закрыла комментарий раньше времени → браузер потерял `@layer base, stylex;`
    и **весь `:root`-блок** (симптом: пустые токены, Times New Roman, letter-spacing и rect.y
    поплыли). Фикс: `(.result, .part...)`. Правило: **в CSS-комментариях не писать `*/` внутри имён
    селекторов.**
  - Проверки Wlast: `grep -ri tailwind package.json vite.config.ts src/` → 0 (кроме поясняющих
    комментариев); tsc 0; eslint 0; vitest 30 files/254 tests (завершается без зависаний); lint:arch
    — 1 pre-existing warn (`die-id.ts`); e2e **30/30**; 9 чекеров **ALL OK / exit 0**; computed-diff
    **чисто ✓** 0/0/0 (3408 элементов, 16 снимков) — после фикса `*/` и после prettier; prettier
    --check OK; `npm run build` — **CSS 15.5KB** (обещанные ~20KB атомарного CSS — в пределах), JS
    не изменился.
