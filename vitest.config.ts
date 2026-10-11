import { resolve } from 'node:path'
import stylex from '@stylexjs/unplugin'
import { defineConfig } from 'vitest/config'

// e2e-спеки гоняет Playwright Test (npm run test:e2e), не Vitest.
// Алиас @ и stylex-плагин дублируем из vite.config.ts (этот файл его затеняет):
// без трансформации stylex.create в тесты падает любой импорт tsx (например,
// app/store → публичный API виджета → MobileTable.tsx).
export default defineConfig({
  plugins: [stylex.vite({ useCSSLayers: true })],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    // .opencode — инструменты (там свои node_modules с их тестами), не наш код.
    exclude: ['e2e/**', 'node_modules/**', '**/node_modules/**', '.opencode/**', 'dist/**'],
  },
})
