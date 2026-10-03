import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// e2e-спеки гоняет Playwright Test (npm run test:e2e), не Vitest.
// Алиас @ дублируем из vite.config.ts (этот файл его затеняет).
export default defineConfig({
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
