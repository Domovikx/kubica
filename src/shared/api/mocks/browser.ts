import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

const worker = setupWorker(...handlers)

/** Включить моки (ждём готовность worker'а до монтирования приложения). */
export const enableMsw = async (): Promise<void> => {
  // GitHub Pages и dev живут под base '/kubica/' — воркер лежит в public
  // и отдаётся по тому же префиксу (иначе дефолтный /mockServiceWorker.js → 404).
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledFrame: 'bypass',
  })
}
