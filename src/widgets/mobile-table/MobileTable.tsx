// Корень виджета стола (волна A2): секция с data-phase (контракт чекеров/
// e2e), порядок DOM 1-в-1 из mountMobileTable — watermark, canvas, head, foot,
// hint, live, backdrop, sheet, drawer, musicCard, toast. Движок (three.js/
// физика/жесты) — use-table-engine; оверлеи/прочее UI — RTK (mt-ui-slice).
// Секция/канва — stylex; классы-состояния (sheetOpen) — маркеры в className
// (правил под них нет — мёртвые токены, оставлены как есть). Стили стола —
// stylex в ui/*.tsx + глобальный остаток в app/styles.css (волна W2).
import { useCallback, useEffect, useRef } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import type { HistoryEntry } from '@/entities/roll-history/history'
import { hideResult } from '@/shared/ui/result-pop'
import { disposeMusic, musicAvail, onMusicNotice, probeMusic } from '@/features/dnd-music/music'
import { mtUiActions } from './mt-ui-slice'
import { selectMtUi, selectPhase, selectTotal } from './selectors'
import { useToast } from './hooks/use-toast'
import { useTableEngine } from './hooks/use-table-engine'
import { loadStars } from './hooks/use-stars'
import { Watermark } from './ui/Watermark'
import { Head } from './ui/Head'
import { Foot } from './ui/Foot'
import { Hint } from './ui/Hint'
import { Live } from './ui/Live'
import { Backdrop } from './ui/Backdrop'
import { Sheet } from './ui/Sheet'
import { Drawer } from './ui/Drawer'
import { MusicCard } from './ui/MusicCard'
import { Toast } from './ui/Toast'

const styles = stylex.create({
  section: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'clip',
    overscrollBehavior: 'none',
    backgroundImage: 'linear-gradient(180deg,#23262d 0%,#14161a 55%,#0a0b0e 100%)',
  },
  canvas: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    display: 'block',
    width: '100%',
    height: '100%',
    touchAction: 'none',
    cursor: 'grab',
    ':active': {
      cursor: 'grabbing',
    },
  },
})

export const MobileTable = (): React.JSX.Element => {
  const dispatch = useAppDispatch()
  const phase = useAppSelector(selectPhase)
  const total = useAppSelector(selectTotal)
  const { sheetOpen, drawerOpen, musicCardOpen } = useAppSelector(selectMtUi)
  const { toast, showToast } = useToast()

  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const headCtlRef = useRef<HTMLDivElement>(null)
  const headStarRef = useRef<HTMLAnchorElement>(null)
  const soundRef = useRef<HTMLButtonElement>(null)
  const musicRef = useRef<HTMLButtonElement>(null)
  const footRef = useRef<HTMLDivElement>(null)
  const footPartsRef = useRef<HTMLSpanElement>(null)
  const liveRef = useRef<HTMLDivElement>(null)

  const engineRef = useTableEngine({
    canvasRef,
    sectionRef,
    footRef,
    footPartsRef,
    liveRef,
    headRef,
    showToast,
  })

  // Esc закрывает шит/меню/карточку (фокус-минимум без полного trap).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') dispatch(mtUiActions.closeOverlays())
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dispatch])

  // Доступность YouTube: ранняя проба того же ленивого скрипта API; повтор —
  // когда сеть вернулась. Dispose плеера — при размонтировании страницы.
  useEffect(() => {
    const onNetBack = (): void => {
      if (musicAvail() !== 'ok') void probeMusic()
    }
    window.addEventListener('online', onNetBack)
    void probeMusic()
    return () => {
      window.removeEventListener('online', onNetBack)
      disposeMusic()
    }
  }, [])

  // Тосты на разовые сообщения движка музыки (нет сети / повторный тап / ошибка).
  useEffect(() => {
    const unsub = onMusicNotice((n) => {
      showToast(
        n === 'offline'
          ? 'Нет сети — музыка недоступна'
          : n === 'blocked'
            ? 'Нажми ещё раз'
            : 'Не удалось запустить музыку',
      )
    })
    return unsub
  }, [showToast])

  // Счётчик звёзд — лениво при сборке (см. также первое открытие меню).
  useEffect(() => {
    loadStars()
  }, [])

  // Набор пуст — поп итога не актуален (как refreshChrome в легаси).
  useEffect(() => {
    if (total === 0) hideResult()
  }, [total])

  const closeOverlays = useCallback(() => dispatch(mtUiActions.closeOverlays()), [dispatch])
  // Кнопки шапки: «+» и бургер — тумблер (открыт → закрыть), музыка всегда
  // открывает карточку (2.23 — вход в меню, не тоггл).
  const onOpenSheet = useCallback(() => {
    if (sheetOpen) dispatch(mtUiActions.closeOverlays())
    else dispatch(mtUiActions.openOverlay('sheet'))
  }, [dispatch, sheetOpen])
  const onOpenDrawer = useCallback(() => {
    if (drawerOpen) dispatch(mtUiActions.closeOverlays())
    else dispatch(mtUiActions.openOverlay('drawer'))
  }, [dispatch, drawerOpen])
  const onOpenMusic = useCallback(() => dispatch(mtUiActions.openOverlay('music')), [dispatch])
  const onReroll = useCallback((entry: HistoryEntry) => engineRef.current?.reroll(entry), [])

  const anyOpen = sheetOpen || drawerOpen || musicCardOpen
  const sxSection = stylex.props(styles.section)
  const sxCanvas = stylex.props(styles.canvas)

  return (
    <section
      ref={sectionRef}
      className={`mtable ${sxSection.className ?? ''}${sheetOpen || musicCardOpen ? ' sheetOpen' : ''}`}
      data-testid="mtable"
      data-phase={phase}
    >
      <Watermark />
      <canvas
        ref={canvasRef}
        {...sxCanvas}
        className={`mtableCanvas ${sxCanvas.className ?? ''}`}
        data-testid="mtable-canvas"
        aria-hidden="true"
      />
      <Head
        headRef={headRef}
        headCtlRef={headCtlRef}
        headStarRef={headStarRef}
        soundRef={soundRef}
        musicRef={musicRef}
        onOpenSheet={onOpenSheet}
        onOpenDrawer={onOpenDrawer}
        onOpenMusic={onOpenMusic}
      />
      <Foot footRef={footRef} footPartsRef={footPartsRef} />
      <Hint />
      <Live liveRef={liveRef} />
      <Backdrop visible={anyOpen} />
      <Sheet open={sheetOpen} onClose={closeOverlays} showToast={showToast} />
      <Drawer
        open={drawerOpen}
        onClose={closeOverlays}
        showToast={showToast}
        onReroll={onReroll}
        onOpenMusic={onOpenMusic}
      />
      <MusicCard open={musicCardOpen} onClose={closeOverlays} />
      <Toast toast={toast} />
    </section>
  )
}
