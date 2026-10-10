import { MobileTable } from '@/widgets/mobile-table/MobileTable'

/**
 * Страница-стол: React-рендер виджета mobile-table (волна A2). Хост
 * `main.viewers#viewers` — тот же DOM, что был в index.html; rAF/resize/
 * движок — внутри MobileTable (useTableEngine).
 */
export const HomePage = () => (
  <main className="viewers" id="viewers" data-testid="viewers">
    <MobileTable />
  </main>
)
