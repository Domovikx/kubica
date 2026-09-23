import { tickRolls } from '@/features/roll-dice/quick-roll'
import { tickPoolWorld } from '@/features/dice-pool/pool'
import { mountModelList } from '@/widgets/model-list/model-list'
import { mountRollHistory } from '@/widgets/roll-history/roll-history'
import { mountRollPanel } from '@/widgets/roll-panel/roll-panel'
import { mountViewerGrid } from '@/widgets/viewer-grid/viewer-grid'

export const mountHomePage = (): (() => void) => {
  const sidebar = document.getElementById('sidebar') as HTMLElement
  const viewers = document.getElementById('viewers') as HTMLElement

  const disposeList = mountModelList(sidebar)
  const poolSection = document.createElement('div')
  poolSection.className = 'sidebarSection'
  sidebar.appendChild(poolSection)
  const disposePool = mountRollPanel(poolSection)
  const historySection = document.createElement('div')
  historySection.className = 'sidebarSection'
  sidebar.appendChild(historySection)
  const disposeHistory = mountRollHistory(historySection)
  const grid = mountViewerGrid(viewers)

  const onResize = () => grid.resize()
  window.addEventListener('resize', onResize)
  grid.resize()

  let raf = 0
  const animate = () => {
    // Скрытая вкладка: кадры не рендерим (батарея), rAF и так троттлится.
    // Физика тоже качается отсюда же: в фоне setTimeout заморожены,
    // поэтому бросок просто ждёт возвращения вкладки, а не виснет.
    if (!document.hidden) {
      tickRolls()
      tickPoolWorld()
      grid.update()
    }
    raf = requestAnimationFrame(animate)
  }
  animate()

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    disposeList()
    disposePool()
    disposeHistory()
    grid.dispose()
  }
}
