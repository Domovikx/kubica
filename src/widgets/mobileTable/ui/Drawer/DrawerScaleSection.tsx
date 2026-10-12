// Секция «Масштаб интерфейса» в бургере: пилюли 80–140 % (persist + стор,
// тост + лёгкая вибрация на подтверждение).
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app'
import { UI_SCALES, setUiScale, type UiScale, uiScaleActions } from '@/features'

import { buzz as vibrate } from '@/shared'
import { selectUiScale } from '../../model/selectors'
import { overlayStyles } from '../overlay.stylex'
import { drawerStyles as s } from './Drawer.stylex'

export const DrawerScaleSection = (props: {
  showToast: (msg: string) => void
}): React.JSX.Element => {
  const { showToast } = props
  const dispatch = useAppDispatch()
  const scale = useAppSelector(selectUiScale)

  const sxSection = stylex.props(overlayStyles.section)
  const sxSectionTitle = stylex.props(s.sectionTitle)
  const sxScaleRow = stylex.props(s.scaleRow)
  const sxScale = stylex.props(s.scale)

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
        {UI_SCALES.map((sc: UiScale) => {
          const pct = Math.round(sc * 100)
          return (
            <button
              key={sc}
              type="button"
              {...sxScale}
              className={`mtableScale${sc === scale ? ' on' : ''} ${sxScale.className ?? ''}`}
              data-testid="mtable-scale"
              aria-label={`Масштаб интерфейса ${pct}%`}
              aria-pressed={sc === scale}
              onClick={() => {
                setUiScale(sc)
                dispatch(uiScaleActions.setScale(sc))
                showToast(`Масштаб ${pct}%`)
                vibrate(15)
              }}
            >
              {`${pct}%`}
            </button>
          )
        })}
      </div>
    </div>
  )
}
