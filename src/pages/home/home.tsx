import { useEffect, useRef } from 'react'
import { tickPoolWorld } from '@/features/dice-pool/pool'
import { tickRolls } from '@/features/roll-dice/quick-roll'
import { mountMobileTable } from '@/widgets/mobile-table/mobile-table'

/**
 * Страница-стол: React-обёртка над legacy-виджетом mobile-table (strangler —
 * этап 1). Рендерит хост `main.viewers#viewers` (тот же DOM, что был в
 * index.html), внутрь монтирует vanilla-виджет и крутит общий rAF-цикл
 * (физика/бота) — логика бывшего pages/home/home.ts перенесена в эффект.
 */
export const HomePage = () => {
  const hostRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const grid = mountMobileTable(host)

    const onResize = (): void => grid.resize()
    window.addEventListener('resize', onResize)
    grid.resize()

    // Скрытая вкладка: кадры не рендерим (батарея), rAF и так троттлится.
    // Физика тоже качается отсюда: в фоне setTimeout заморожены, поэтому
    // бросок просто ждёт возвращения вкладки, а не виснет.
    let raf = 0
    const animate = (): void => {
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
  }, [])

  return <main className="viewers" id="viewers" data-testid="viewers" ref={hostRef} />
}
