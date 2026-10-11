// Монтирование движка стола для React: createEngine + общий rAF-цикл
// (физика; в фоне кадры не рендерим) + resize; cleanup — dispose. Синк
// пачки костей отдельным эффектом (engine.syncCounts при смене counts).
// Порядок эффектов объявления важен: этот эффект раньше counts-эффекта —
// иначе engineRef.current ещё null.
import { useEffect, useRef, type RefObject } from 'react'
import { store } from '@/app/store'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { selectCounts } from '../selectors'
import { createEngine, type Engine } from '../engine'

export interface TableEngineRefs {
  canvasRef: RefObject<HTMLCanvasElement | null>
  sectionRef: RefObject<HTMLElement | null>
  footRef: RefObject<HTMLDivElement | null>
  footPartsRef: RefObject<HTMLSpanElement | null>
  liveRef: RefObject<HTMLDivElement | null>
  headRef: RefObject<HTMLDivElement | null>
  showToast: (msg: string) => void
}

export const useTableEngine = (refs: TableEngineRefs): RefObject<Engine | null> => {
  const dispatch = useAppDispatch()
  const counts = useAppSelector(selectCounts)
  const engineRef = useRef<Engine | null>(null)
  const showToastRef = useRef(refs.showToast)
  showToastRef.current = refs.showToast

  useEffect(() => {
    const { canvasRef, sectionRef, footRef, footPartsRef, liveRef, headRef } = refs
    const canvas = canvasRef.current
    const section = sectionRef.current
    const foot = footRef.current
    const footParts = footPartsRef.current
    const live = liveRef.current
    const head = headRef.current
    if (!canvas || !section || !foot || !footParts || !live || !head) return

    const engine = createEngine({
      dispatch,
      getState: () => store.getState(),
      canvas,
      section,
      foot,
      footParts,
      live,
      head,
      showToast: (msg) => showToastRef.current(msg),
    })
    engineRef.current = engine

    // Скрытая вкладка: кадры не рендерим (батарея), rAF и так троттлится.
    // Физика тоже качается отсюда: в фоне setTimeout заморожены, поэтому
    // бросок просто ждёт возвращения вкладки, а не виснет.
    let raf = 0
    const animate = (): void => {
      if (!document.hidden) engine.update()
      raf = requestAnimationFrame(animate)
    }
    animate()

    const onResize = (): void => engine.resize()
    window.addEventListener('resize', onResize)
    engine.resize()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      engine.dispose()
      engineRef.current = null
    }
    // refs объект создаётся каждый рендер — монтируем один раз по дизпатчу
    // (стабильный); значения ref'ов читаем на mount, до первого рендера они
    // уже присвоены (React attach до effects).
  }, [dispatch])

  useEffect(() => {
    engineRef.current?.syncCounts(counts)
  }, [counts])

  return engineRef
}
