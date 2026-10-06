// Playwright Test по Best Practices (playwright.dev/docs/best-practices):
// раннер вместо ad-hoc скриптов, веб-ассёрты вместо слипов, изоляция
// контекстов, скрин/трейс только при падении.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  // Физика под SwiftShader медленная: паре ~10 с, пачке минуты.
  timeout: 180 * 1000,
  expect: { timeout: 60 * 1000 },
  fullyParallel: true,
  forbidOnly: false,
  // Retry ×1 (BP): удержание-тест таймингозависим от rAF/SwiftShader и в
  // полных прогонах (3 проекта × 6 тестов + dev-сервер) проседает под
  // нагрузкой — точечно проходит стабильно. on-first-retry ниже как раз под это.
  retries: 1,
  reporter: [['html', { outputFolder: 'tmp/playwright-report', open: 'on-failure' }]],
  outputDir: 'tmp/test-results',
  use: {
    baseURL: 'http://127.0.0.1:5173/kubica',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Только chromium: firefox/webkit-бинарников в окружении нет
  // (npx playwright install firefox webkit — когда понадобятся).
  projects: [
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet',
      use: { viewport: { width: 768, height: 900 } },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173/kubica/',
    reuseExistingServer: true,
    timeout: 60 * 1000,
  },
})
