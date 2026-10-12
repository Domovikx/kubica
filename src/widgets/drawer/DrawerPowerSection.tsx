// Секция «Сила броска» в бургере: выбор мощности импульса (persist + стор).
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app'
import { THROW_POWERS, setThrowPower, powerActions } from '@/features'

import { selectPower } from '@/features'
import { overlayStyles } from '@/shared'
import { drawerStyles as s } from './Drawer.stylex'

export const DrawerPowerSection = (): React.JSX.Element => {
  const dispatch = useAppDispatch()
  const power = useAppSelector(selectPower)

  const sxSection = stylex.props(overlayStyles.section)
  const sxSectionTitle = stylex.props(s.sectionTitle)
  const sxWide = stylex.props(overlayStyles.wide)
  const sxWideGap = stylex.props(overlayStyles.wide, s.wideGap)
  const sxSectionHint = stylex.props(overlayStyles.sectionHint)

  return (
    <div
      {...sxSection}
      className={`mtableSection ${sxSection.className ?? ''}`}
      data-testid="mtable-power-section"
    >
      <span
        {...sxSectionTitle}
        className={`mtableSectionTitle ${sxSectionTitle.className ?? ''}`}
        data-testid="mtable-power-title"
      >
        Сила броска
      </span>
      {THROW_POWERS.map((p, pi) => {
        const sxP = pi > 0 ? sxWideGap : sxWide
        return (
          <button
            key={p.mode}
            type="button"
            {...sxP}
            className={`mtableWide${p.mode === power ? ' on' : ''} ${sxP.className ?? ''}`}
            data-testid="mtable-wide"
            onClick={() => {
              setThrowPower(p.mode)
              dispatch(powerActions.setMode(p.mode))
            }}
          >
            {p.name}
          </button>
        )
      })}
      <p
        {...sxSectionHint}
        className={`mtableSectionHint ${sxSectionHint.className ?? ''}`}
        data-testid="mtable-power-hint"
      >
        Кость заряжается удержанием 3–5 с — сильнее бросок (и флик при отпускании)
      </p>
    </div>
  )
}
