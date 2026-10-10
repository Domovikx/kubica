// Футер разбивки: пробелы по низу («4 3 1 6 4 8 8 1 10 5»), виден когда
// есть итог и не крутится. Текст пишем императивно через ref (не React-
// children): движок (applyLayout) временно перезаписывает textContent для
// замера — с React-текстом узлы бы отцеплялись.
import { useEffect } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppSelector } from '@/app/hooks'
import { formatParts } from '@/entities/roll-history/history'
import { selectLastResult, selectRolling } from '../selectors'

const styles = stylex.create({
  foot: {
    position: 'absolute',
    bottom: 'calc(12px + env(safe-area-inset-bottom))',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 6,
    display: 'flex',
    width: 'max-content',
    maxWidth: 'calc(100% - 24px)',
    pointerEvents: 'none',
  },
  footParts: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: 'var(--fs-headline)',
    fontWeight: 800,
    color: '#c9cdd4',
  },
})

export interface FootProps {
  footRef: React.RefObject<HTMLDivElement | null>
  footPartsRef: React.RefObject<HTMLSpanElement | null>
}

export const Foot = ({ footRef, footPartsRef }: FootProps): React.JSX.Element => {
  const lastResult = useAppSelector(selectLastResult)
  const rolling = useAppSelector(selectRolling)
  const visible = lastResult !== null && !rolling
  const breakdown = visible && lastResult ? formatParts(lastResult.parts).join(' ') : ''

  useEffect(() => {
    if (footPartsRef.current) footPartsRef.current.textContent = breakdown
  }, [breakdown, footPartsRef])

  const sxFoot = stylex.props(styles.foot)
  const sxParts = stylex.props(styles.footParts)

  return (
    <div
      ref={footRef}
      {...sxFoot}
      className={`mtableFoot ${sxFoot.className ?? ''}`}
      data-testid="mtable-foot"
      hidden={!visible}
      aria-hidden="true"
      title={breakdown || undefined}
    >
      <span
        ref={footPartsRef}
        {...sxParts}
        className={`mtableFootParts ${sxParts.className ?? ''}`}
        data-testid="mtable-foot-parts"
      />
    </div>
  )
}
