import { tickRolls } from '@/features/roll-dice/quick-roll'
import { mountModelList } from '@/widgets/model-list/model-list'
import { mountRollHistory } from '@/widgets/roll-history/roll-history'
import { mountViewerGrid } from '@/widgets/viewer-grid/viewer-grid'

export const mountHomePage = (): (() => void) => {
  const sidebar = document.getElementById('sidebar') as HTMLElement
  const viewers = document.getElementById('viewers') as HTMLElement

  const disposeList = mountModelList(sidebar)
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
      grid.update()
    }
    raf = requestAnimationFrame(animate)
  }
  animate()

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    disposeList()
    disposeHistory()
    grid.dispose()
  }
}
