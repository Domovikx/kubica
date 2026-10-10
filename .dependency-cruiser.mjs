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
      from: { path: 'src/pages', pathNot: '\\.test\\.tsx?$' },
      to: { path: 'src/(app|pages)', pathNot: ['\\.css$', '^src/app/(store|hooks)(\\.ts)?$'] },
    },
    {
      name: 'fsd-widgets-down-only',
      severity: 'error',
      comment: 'Виджеты не импортируют страницы, приложение и друг друга.',
      from: { path: '^src/widgets/([^/]+)', pathNot: '\\.test\\.tsx?$' },
      to: {
        path: 'src/(app|pages|widgets)',
        pathNot: ['\\.css$', '^src/widgets/$1/', '^src/app/(store|hooks)(\\.ts)?$'],
      },
    },
    {
      name: 'fsd-features-down-only',
      severity: 'error',
      comment: 'Фичи не импортируют виджеты, страницы и приложение.',
      from: { path: '^src/features/([^/]+)', pathNot: '\\.test\\.tsx?$' },
      to: {
        path: 'src/(app|pages|widgets|features)',
        pathNot: ['\\.css$', '^src/features/$1/', '^src/app/(store|hooks)(\\.ts)?$'],
      },
    },
    {
      name: 'fsd-entities-down-only',
      severity: 'error',
      comment: 'Сущности не импортируют ничего выше shared (внешние пакеты и shared — можно).',
      from: { path: 'src/entities/[^/]+', pathNot: '\\.test\\.tsx?$' },
      to: { pathNot: ['^src/shared', '^node_modules'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
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
