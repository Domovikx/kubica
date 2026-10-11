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
    // barrel — только ui-папки компонентов и публичный API виджета.
    rules: {
      'fsd/no-public-api-sidestep': 'off',
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
    // Техдолг к обсуждению на FSD-ревью: слайсы с файлами в корне без сегментов.
    rules: {
      'fsd/no-segmentless-slices': 'off',
    },
  },
  {
    // Техдолг к обсуждению: слайс entities/model совпадает по имени с сегментом model.
    files: ['./src/entities/model/**'],
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
