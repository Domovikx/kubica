# [2026-10-09] Перевести оставшиеся js/mjs-файлы репозитория на ts/mts

Статус: READY

## Задача от пользователя

«добавь задачу максимальный переезд где это возможно с js mjs на ts mts»

Решения человека (question-tool, 2026-10-09):

1. **tmp/** (~150 `.mjs`/`.cjs` чекеров, не в git) — не трогать, это вне рамок задачи.
2. **Новые dev-зависимости** ради переезда — разрешены свободно (только инструменты, в бандл не
   идут).

## Цель

Когда в репозитории остаются одиночные JS-файлы (конфиги, служебный скрипт скилла), я хочу перевести
их на TS/MTS, чтобы типы, редактор и `tsc` работали везде, а инвентарь «максимальный переезд» был
доведён до минимума «где возможно». Критерий: после задачи в git не остаётся ни одного
`.js`/`.mjs`/`.cjs`, кроме явно невозможных технически (каждый такой — с обоснованием в «Вне
рамок»).

## Контекст (что есть сейчас)

Факты по коду, сверены 2026-10-09:

- Полный инвентарь JS в git (`git ls-files "*.js" "*.mjs" "*.cjs"`) — ровно **4 файла**:
  - `eslint.config.mjs` (19 строк) — flat config: `@eslint/js` + `typescript-eslint`, запуск
    `npm run lint` (`package.json:14`) и lint-staged (`package.json:55-58`);
  - `.dependency-cruiser.mjs` (69 строк) — JSDoc-тип
    `@type {import('dependency-cruiser') .IConfiguration}`, запуск `npm run lint:arch` =
    `depcruise src` (`package.json:16`);
  - `.opencode/skills/ui-review/scripts/review.mjs` (152 строки) —
    `node … review.mjs [--throws N] [--out …]` (`.opencode/skills/ui-review/SKILL.md:32`),
    импортирует `node:fs` и `playwright`;
  - `public/mockServiceWorker.js` (448 строк) — MSW service worker, ссылка на него в
    `src/shared/api/mocks/browser.ts:11` (`serviceWorker.url = BASE_URL + mockServiceWorker.js`) —
    браузер исполняет JS, не TS.
- Уже TypeScript: весь `src/`, `e2e/`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`.
- `tsconfig.json`: `include: ["src", "e2e", "playwright.config.ts"]` — конфиги в корне в проверку
  **не входят**; `erasableSyntaxOnly: true` (только стираемые типы — идеально под нативный
  strip-types Node).
- **Node v24.15.0** — `.mts` исполняется нативно, без флагов: замер 2026-10-09 (пробник
  `node tmp/_mts-probe.mts` → exit 0).
- `tmp/` (~150 `.mjs`/`.cjs` чекеров) — в `.gitignore` (`*tmp*`), в git не идёт → вне рамок (решение
  человека).
- `tools/` — python/venv (CAD), JS-файлы там только в site-packages venv — не наш код.
- `.opencode/` уже частично на TS: `.opencode/tools/*.ts` по правилам проекта (AGENTS.md).

Предварительный вебсёрч (2026-10-09; `websearch` 403 → `html.duckduckgo.com/html/?q=` + `webfetch`):

- **ESLint docs, Configuration Files (версия HEAD v10.12.0, eslint.org/docs/latest/use/configure/
  configuration-files)**: `eslint.config.ts`/`.mts`/`.cts` поддерживаются, но для Node.js нужен
  devDep `jiti` ≥2.2.0 (автоматически не ставится) **либо** нативная загрузка на Node ≥22.13 через
  `--experimental-strip-types` + флаг `unstable_native_nodejs_ts_config` (experimental, пакуется в
  `npx --node-options='…' eslint --flag …`); ESLint конфиг **не typecheck-ит**; приоритет
  js/mjs/cjs > ts.
- **dependency-cruiser**: нативный TS-парсинг исходников подтверждён (DeepWiki, 2026-01-25), а вот
  загрузка **TS-файла конфига** в доке не подтверждена — `[УТОЧНИТЬ]` эмпирической проверкой.
- **Node.js type stripping**: включён по умолчанию с 23.6; у нас v24.15 — проверено замером выше.

## Что сделать (ресёрч, по протоколу `tasks/AGENT.md`)

1. **Вопросы ресёрча** (варианты — таблицей при выполнении, решение после метода исключения):
   - ESLint: `eslint.config.ts` через `jiti` (деп разрешён человеком) или нативная
     experimental-загрузка (правка `scripts.lint`, `lint-staged` — флаги везде, где стартует
     eslint)? Что делает с хуками husky/lint-staged каждый вариант?
   - dependency-cruiser: ест ли `.dependency-cruiser.ts`/`.mts`? Эмпирически: переименовать →
     `npm run lint:arch`; если нет — варианты (оставить `.mjs` с обоснованием / обёртка-скрипт /
     dep) — критерий из AGENTS.md: зависимости «меньше и стабильнее», но запрета нет (решение
     человека).
   - `review.mjs` → `.mts`: обновление команды в SKILL.md скилла; нужен ли прогон типа через `tsc`
     (файл в `include` tsconfig не входит — как проверяем: добавить в include отдельным tsconfig или
     `tsc --noEmit -p`?) — не потерять проверяемость.
   - JSDoc-тип в depcruise-конфиге → полноценный `import type { IConfiguration }`.
   - Финальная инвентаризация: повторный `git ls-files` на приёмке — новых js/mjs не появилось.
2. **Вебсёрч** — по фактам выше; таблица вариантов ≥2 на каждый файл, метод исключения от наименее
   подходящего, вердикт ± с минусами — в разделе «Результат ресёрча».
3. **Реализация** — после согласования ресёрча с человеком (вопросы через question-tool).

## Приёмка

- [ ] `git ls-files "*.js" "*.mjs" "*.cjs"` → в выдаче только `public/mockServiceWorker.js` (он же
      «Вне рамок» с обоснованием) либо пусто.
- [ ] `npm run lint` и `npm run lint:arch` проходят с новыми конфигами (0 ошибок).
- [ ] Скрипт скилла запускается: `node .opencode/skills/ui-review/scripts/review.mts` стартует (и
      команда в `.opencode/skills/ui-review/SKILL.md` указывает на новое имя файла).
- [ ] `npx tsc --noEmit` проверяет мигрированные файлы (добавлены в coverage) и чистый —
      доказательство фактом, а не «вроде ок».
- [ ] Новые депы (если были) — только в `devDependencies`, бандл не изменился: `npm run build` ок,
      вес `dist/` не вырос.
- [ ] Edge: повседневные команды (`npm run lint`, lint-staged, husky-хуки) не требуют ручной выдачи
      флагов; если флаги неизбежны — они запрограммированы в `package.json`, не в инструкции
      «запускай руками».
- [ ] Edge: после переезда поведение конфигов то же (ignored-пути, правила — байт-в-байт или
      осознанно лучше); сравнение до/после через `eslint --print-config` любой файл-мишень.
- [ ] Полная батарея перед сдачей: `npx tsc --noEmit`, `npx eslint src/`, `npm test`,
      `npm run build`.

## Вне рамок (out of scope)

- `tmp/**` — ~150 `.mjs`/`.cjs` чекеров, не в git (решение человека 2026-10-09); правило для новых
  чекеров — отдельным решением в `tmp/README.md`, не здесь.
- `public/mockServiceWorker.js` — генерируется MSW (`msw init`), ссылается на него
  `src/shared/api/mocks/browser.ts:11`, браузер исполняет только JS; переименование сломает
  service-worker-контракт.
- `tools/` (python/venv/CAD), `node_modules/`, `dist/`, `.opencode/node_modules/`.
- Переписывание логики скриптов/конфигов — задача только расширение и типы, поведение то же.
- Инлайн-JS в `index.html` и CSS — не из этой задачи.

## Файлы (ожидаемые)

- `eslint.config.mjs` → `eslint.config.ts` (+ возможно `jiti` в devDependencies, правка
  `package.json` scripts/lint-staged) — по вердикту ресёрча.
- `.dependency-cruiser.mjs` → `.dependency-cruiser.ts|.mts` либо остаётся `.mjs` с обоснованием — по
  вердикту ресёрча.
- `.opencode/skills/ui-review/scripts/review.mjs` → `review.mts` + правка команды в
  `.opencode/skills/ui-review/SKILL.md`.
- `tsconfig.json` — расширение coverage (include), чтобы `tsc` проверял мигрированные файлы.
- `public/mockServiceWorker.js` — не изменяется.

## Связи

- `AGENTS.md` (правила tmp/), `tasks/AGENT.md` (критерии: депы, проверяемость),
  `docs/ARCHITECTURE.md` (слои), `.opencode/skills/ui-review/SKILL.md` (команда запуска).
