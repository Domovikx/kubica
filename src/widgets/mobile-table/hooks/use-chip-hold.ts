import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

const HOLD_MS = 3000
const HOLD_GRACE_MS = 1000

export const useChipHold = (
  onDelete: () => void,
  onTap: () => void,
  holdFiredRef: { current: boolean },
): {
  holding: boolean
  countdown: string
  fillRef: React.RefObject<HTMLSpanElement | null>
  onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => void
  onPointerUp: () => void
  onPointerCancel: () => void
  onClick: () => void
} => {
  const [holding, setHolding] = useState(false)
  const [countdown, setCountdown] = useState('3')
  const fillRef = useRef<HTMLSpanElement | null>(null)
  const raf = useRef(0)
  const cbRef = useRef({ onDelete, onTap })
  cbRef.current = { onDelete, onTap }

  const endHold = useCallback(() => {
    cancelAnimationFrame(raf.current)
    setHolding(false)
    setCountdown('3')
    if (fillRef.current) fillRef.current.style.width = '0%'
  }, [])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const startAt = performance.now()
      setHolding(true)
      setCountdown('')
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // синтетические события (тесты) — живём без захвата
      }
      const tick = (): void => {
        const el = performance.now() - startAt
        if (el < HOLD_GRACE_MS) {
          raf.current = requestAnimationFrame(tick)
          return
        }
        const p = Math.min(1, (el - HOLD_GRACE_MS) / HOLD_MS)
        if (fillRef.current) fillRef.current.style.width = `${(p * 100).toFixed(1)}%`
        setCountdown(String(Math.max(1, Math.ceil((1 - p) * (HOLD_MS / 1000)))))
        if (p >= 1) {
          endHold()
          holdFiredRef.current = true
          window.setTimeout(() => {
            holdFiredRef.current = false
          }, 600)
          cbRef.current.onDelete()
          return
        }
        raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    },
    [endHold, holdFiredRef],
  )

  const onClick = useCallback(() => {
    if (holdFiredRef.current) return
    cbRef.current.onTap()
  }, [holdFiredRef])

  return {
    holding,
    countdown,
    fillRef,
    onPointerDown,
    onPointerUp: endHold,
    onPointerCancel: endHold,
    onClick,
  }
}
