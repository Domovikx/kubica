import { mountModelList } from '@/widgets/model-list/model-list'
import { mountViewerGrid } from '@/widgets/viewer-grid/viewer-grid'

export const mountHomePage = (): (() => void) => {
  const sidebar = document.getElementById('sidebar') as HTMLElement
  const viewers = document.getElementById('viewers') as HTMLElement

  const disposeList = mountModelList(sidebar)
  const grid = mountViewerGrid(viewers)

  const onResize = () => grid.resize()
  window.addEventListener('resize', onResize)
  grid.resize()

  let raf = 0
  const animate = () => {
    // Скрытая вкладка: кадры не рендерим (батарея), rAF и так троттлится
    if (!document.hidden) grid.update()
    raf = requestAnimationFrame(animate)
  }
  animate()

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    disposeList()
    grid.dispose()
  }
}
