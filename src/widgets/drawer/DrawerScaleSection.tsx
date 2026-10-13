// Секция «Масштаб интерфейса» в бургере: бегунок 100–200 % со снапом к
// пресетам 100/125/150/175/200 (persist + стор, тост — при смене шага,
// вибрация — на отпускание). Трек/боббин — вендор-псевдо stylex (Drawer.stylex).
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app'
import { setUiScale, UI_SCALES, type UiScale, uiScaleActions } from '@/features'

import { buzz as vibrate } from '@/shared'
import { selectUiScale } from '@/features'
import { overlayStyles } from '@/shared'
import { drawerStyles as s } from './Drawer.stylex'

export const DrawerScaleSection = (props: {
  showToast: (msg: string) => void
}): React.JSX.Element => {
  const { showToast } = props
  const dispatch = useAppDispatch()
  const scale = useAppSelector(selectUiScale)
  const pct = Math.round(scale * 100)

  const sxSection = stylex.props(overlayStyles.section)
  const sxSectionTitle = stylex.props(s.sectionTitle)
  const sxScaleRow = stylex.props(s.scaleRow)
  const sxScaleTrackCol = stylex.props(s.scaleTrackCol)
  const sxScaleRange = stylex.props(s.scaleRange)
  const sxScaleTicks = stylex.props(s.scaleTicks)

  return (
    <div
      {...sxSection}
      className={`mtableSection ${sxSection.className ?? ''}`}
      data-testid="mtable-scale-section"
    >
      <span
        {...sxSectionTitle}
        className={`mtableSectionTitle ${sxSectionTitle.className ?? ''}`}
        data-testid="mtable-scale-title"
      >
        Масштаб интерфейса
      </span>
      <div
        {...sxScaleRow}
        className={`mtableScaleRow ${sxScaleRow.className ?? ''}`}
        data-testid="mtable-scale-row"
      >
        <div {...sxScaleTrackCol} className={sxScaleTrackCol.className ?? ''}>
          <input
            type="range"
            min={1}
            max={2}
            step={0.25}
            value={scale}
            {...sxScaleRange}
            className={`mtableScaleRange ${sxScaleRange.className ?? ''}`}
            data-testid="mtable-scale"
            aria-label="Масштаб интерфейса"
            aria-valuetext={`${pct}%`}
            style={{ ['--fill' as string]: `${((scale - 1) / 1) * 100}%` }}
            onChange={(e) => {
              const sc = e.target.valueAsNumber as UiScale
              setUiScale(sc)
              dispatch(uiScaleActions.setScale(sc))
              showToast(`Масштаб ${Math.round(sc * 100)}%`)
            }}
            onPointerUp={() => vibrate(15)}
            onKeyUp={() => vibrate(15)}
          />
          <div {...sxScaleTicks} className={sxScaleTicks.className ?? ''} aria-hidden="true">
            {UI_SCALES.map((sc) => (
              <span key={sc}>{Math.round(sc * 100)}%</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
