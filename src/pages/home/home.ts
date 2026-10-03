import { tickRolls } from '@/features/roll-dice/quick-roll'
import { tickPoolWorld } from '@/features/dice-pool/pool'
import { mountMobileTable } from '@/widgets/mobile-table/mobile-table'

/**
 * Kubica — один стол: mobile-table монтируется всегда, без query-параметров.
 * Старые ссылки с `?m=1` / `?table` / `?glass=…` продолжают открывать тот же стол
 * (параметры игнорируются).
 */
export const mountHomePage = (): (() => void) => {
  const viewers = document.getElementById('viewers') as HTMLElement

  document.body.dataset.mode = 'mtable'
  const grid = mountMobileTable(viewers)
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
    grid.dispose()
  }
}
