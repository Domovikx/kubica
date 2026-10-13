import * as stylex from '@stylexjs/stylex'

import { MobileTable } from './MobileTable'
import { homeStyles } from './HomePage.stylex'

/**
 * Страница-стол: React-рендер виджета mobile-table (волна A2). Хост
 * `main.viewers#viewers` — тот же DOM, что был в index.html; rAF/resize/
 * движок — внутри MobileTable (useTableEngine).
 */
export const HomePage = () => {
  const sxViewers = stylex.props(homeStyles.viewers)

  return (
    <main
      {...sxViewers}
      className={`viewers ${sxViewers.className ?? ''}`}
      id="viewers"
      data-testid="viewers"
    >
      <MobileTable />
    </main>
  )
}
