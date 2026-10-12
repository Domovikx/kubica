/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Циклические зависимости запрещены: модули должны образовывать DAG, иначе рефакторинг и ленивая загрузка ломаются.',
      from: { pathNot: '^(node_modules)' },
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Модуль никуда не импортируется — возможно мёртвый код.',
      from: { pathNot: '^(node_modules)', orphan: true },
      to: {},
    },
    // FSD: импорты только вниз по слоям app → pages → widgets → features → entities.
    // Исключения (не архитектурные зависимости):
    // - *.css — колокализованные стили слайса, а не связь модулей;
    // - *.test.ts — тесты импортируют свой же модуль по определению;
    // - модули одного слайса (mobile-table → chrome/layout/…, table-setup →
    //   presets) — колокализация, а не импорт «друг друга» между слайсами
    //   ($1 в to.pathNot — имя слайса-источника из from.path).
    {
      name: 'fsd-no-upward-imports',
      severity: 'error',
      comment: 'Запрещены импорты вверх по слоям FSD (см. docs/ARCHITECTURE.md).',
      from: { path: '^src/pages/([^/]+)', pathNot: ['\\.test\\.tsx?$', '^src/pages/index\\.ts$'] },
      to: {
        path: 'src/(app|pages)',
        pathNot: ['\\.css$', '^src/pages/$1/', '^src/app/(store|hooks|index)(\\.ts)?$'],
      },
    },
    {
      name: 'fsd-widgets-down-only',
      severity: 'error',
      comment: 'Виджеты не импортируют страницы, приложение и друг друга.',
      // Хвостовой / в from: дверь слоя src/widgets/index.ts не считается
      // слайсом и не регулируется down-only (она только реэкспортит слайсы).
      from: { path: '^src/widgets/([^/]+)/', pathNot: '\\.test\\.tsx?$' },
      to: {
        path: 'src/(app|pages|widgets)',
        pathNot: ['\\.css$', '^src/widgets/$1/', '^src/app/(store|hooks|index)(\\.ts)?$'],
      },
    },
    {
      name: 'fsd-features-down-only',
      severity: 'error',
      comment: 'Фичи не импортируют виджеты, страницы и приложение.',
      // Хвостовой / в from: дверь слоя src/features/index.ts не регулируется.
      from: { path: '^src/features/([^/]+)/', pathNot: '\\.test\\.tsx?$' },
      to: {
        path: 'src/(app|pages|widgets|features)',
        pathNot: ['\\.css$', '^src/features/$1/', '^src/app/(store|hooks|index)(\\.ts)?$'],
      },
    },
    {
      name: 'fsd-entities-down-only',
      severity: 'error',
      comment:
        'Сущности не импортируют выше shared и чужие слайсы своего слоя (свой слайс/ shared/ пакеты — можно).',
      // Хвостовой / в from: дверь слоя src/entities/index.ts не регулируется.
      from: { path: '^src/entities/([^/]+)/', pathNot: '\\.test\\.tsx?$' },
      to: { pathNot: ['\\.css$', '^src/entities/$1/', '^src/shared', '^node_modules'] },
    },
    {
      name: 'fsd-shared-no-upward',
      severity: 'error',
      comment:
        'Shared — нижний слой: не импортирует entities/features/widgets/pages/app (как и dieId.utils: «shared не импортирует entities»).',
      from: { path: 'src/shared/', pathNot: '\\.test\\.tsx?$' },
      to: { path: '^src/(entities|features|widgets|pages|app)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // type-only импорты — настоящие связи: иначе no-orphans шумит (ложный
    // dieId.utils), а кросс-импорты import type обходят fsd-правила молча.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.css'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
}
