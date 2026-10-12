import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

// Конфиг steiger учитывает осознанные конвенции kubica (см. fsd-guidelines, ARCHITECTURE.md).
// Правила с пометками-исключениями — базовая линия: новые нарушения должны падать.
export default defineConfig([
  ...fsd.configs.recommended,
  {
    // Тесты импортируют стор/моки приложения по определению.
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
  },
  {
    // Конвенция: слои выше entities подключаются к app/store и app/hooks —
    // осознанные исключения; границы держит dep-cruiser (fsd-*-down-only).
    files: ['./src/widgets/**', './src/features/**', './src/pages/**'],
    rules: {
      'fsd/forbidden-imports': 'off',
    },
  },
  {
    // Конвенция: entities/features/shared импортируются по прямым файлам, без barrel;
    // barrel — только ui-папки компонентов и публичный API виджета. Правила
    // public-api требуют index.ts — против конвенции, оффним по слоям без dверей.
    files: ['./src/entities/**', './src/features/**', './src/pages/**', './src/shared/**'],
    rules: {
      'fsd/no-public-api-sidestep': 'off',
      'fsd/public-api': 'off',
    },
  },
  {
    // Один потребитель — осознанная норма kubica (слайс = владелец предметной
    // области; на MVP у сущности мало потребителей, «merge» размывает границы).
    rules: {
      'fsd/insignificant-slice': 'off',
    },
  },
  {
    // Но слой app обязан ходить в виджет через публичный API (index.ts):
    // прямые импорты внутренностей (mtUiSlice и т.п.) дрейфуют контракт виджета.
    files: ['./src/app/**'],
    rules: {
      'fsd/no-public-api-sidestep': 'error',
    },
  },
  {
    // Конвенция: в shared двери не нужны (прямые импорты, tree-shaking через Vite).
    files: ['./src/shared/**'],
    rules: {
      'fsd/public-api': 'off',
    },
  },
  {
    rules: {
      'fsd/no-segments-on-sliced-layers': 'off',
    },
  },
  {
    // Конвенция kubica: app/store, app/hooks, mobileTable/hooks, selectors —
    // устоявшиеся имена (store/hooks — стандартные app-сегменты канона).
    files: ['./src/app/**', './src/widgets/mobileTable/**'],
    rules: {
      'fsd/segments-by-purpose': 'off',
    },
  },
])
