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
    // Решение 2026-10-12 (владелец): плоские слайсы — файлы в корне слайса
    // (избыточна вложенность dieModel/model/…), публичная дверь — index.ts.
    // Виджеты: сегменты ui/model/lib, дверь виджета — index.ts.
    files: ['./src/entities/**', './src/features/**', './src/pages/**', './src/widgets/**'],
    rules: {
      'fsd/public-api': 'error',
      'fsd/no-public-api-sidestep': 'error',
      'fsd/no-segmentless-slices': 'off',
    },
  },
  {
    // Конвенция: entities/features/shared импортируются через публичный API
    // слайса (index.ts) либо прямым файлом своего слайса; barrel'ов-свалок нет.
    // app обязан ходить в виджет через публичный API (index.ts): прямые импорты
    // внутренностей (mtUiSlice и т.п.) дрейфуют контракт виджета.
    files: ['./src/app/**'],
    rules: {
      'fsd/no-public-api-sidestep': 'error',
      'fsd/public-api': 'error',
    },
  },
  {
    // shared — сегменты слоя без слайсов: публичная дверь обязана (index.ts,
    // FSD public API rule); кросс-импорты сегментов — только через дверь.
    files: ['./src/shared/**'],
    rules: {
      'fsd/public-api': 'error',
      'fsd/no-public-api-sidestep': 'error',
    },
  },
  {
    // Решение 2026-10-12 (владелец): у слоёв есть двери index.ts — короткие
    // импорты ('@/features' вместо '@/features/tableSetup'). FSD-канон
    // запрещает layer public API, но границы держит dep-cruiser (down-only +
    // no-circular), а дверь слоя — тонкий barrel только по публичным API слайсов.
    rules: {
      'fsd/no-layer-public-api': 'off',
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
    rules: {
      'fsd/no-segments-on-sliced-layers': 'off',
    },
  },
  {
    // Конвенция kubica: app/store, app/hooks — устоявшиеся имена
    // (store/hooks — стандартные app-сегменты канона).
    files: ['./src/app/**'],
    rules: {
      'fsd/segments-by-purpose': 'off',
    },
  },
])
