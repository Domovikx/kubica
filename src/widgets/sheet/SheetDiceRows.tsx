// Строки степперов в шторке: глиф, имя, подсказка, −/количество/+ по
// каждому типу кости (лимиты — MAX_PER_DIE/MAX_TOTAL, блок при броске).
// Живёт внутри общей обёртки .mtableRows (порядок DOM 1-в-1 с легаси).
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch } from '@/app'
import { DIE_IDS, DIE_HINTS, dieGlyph } from '@/shared'
import type { DieId } from '@/shared'
import { setupActions, MAX_PER_DIE, MAX_TOTAL, type TableCounts } from '@/features'

import { sheetStyles as s } from './Sheet.stylex'

export const SheetDiceRows = (props: {
  counts: TableCounts
  total: number
  rolling: boolean
}): React.JSX.Element => {
  const { counts, total, rolling } = props
  const dispatch = useAppDispatch()

  const sxRow = stylex.props(s.row)
  const sxGlyphSvg = stylex.props(s.glyphSvg)
  const sxName = stylex.props(s.name)
  const sxDesc = stylex.props(s.desc)
  const sxStep = stylex.props(s.step)
  const sxN = stylex.props(s.n)

  return (
    <div>
      {DIE_IDS.map((die: DieId) => {
        const n = counts[die] ?? 0
        // Строка набрана → глиф красный (row.on ставит React; раньше глобал
        // .mtableRow.on .mtableGlyph).
        const sxRowGlyph = stylex.props(s.glyph, n > 0 && s.glyphOn)
        return (
          <div
            key={die}
            {...sxRow}
            className={`mtableRow${n > 0 ? ' on' : ''} ${sxRow.className ?? ''}`}
            data-testid="mtable-row"
          >
            <span
              {...sxRowGlyph}
              className={`mtableGlyph ${sxRowGlyph.className ?? ''}`}
              data-testid="mtable-glyph"
            >
              {dieGlyph(die, sxGlyphSvg.className)}
            </span>
            <span
              {...sxName}
              className={`mtableName ${sxName.className ?? ''}`}
              data-testid="mtable-name"
            >
              {die}
            </span>
            <span
              {...sxDesc}
              className={`mtableDesc ${sxDesc.className ?? ''}`}
              data-testid="mtable-desc"
            >
              {DIE_HINTS[die]}
            </span>
            <button
              type="button"
              {...sxStep}
              className={`mtableStep ${sxStep.className ?? ''}`}
              data-testid="mtable-step-minus"
              aria-label={`Убрать ${die}`}
              disabled={rolling || n <= 0}
              onClick={() => dispatch(setupActions.add({ die, delta: -1 }))}
            >
              −
            </button>
            <span
              {...sxN}
              className={`mtableN ${sxN.className ?? ''}`}
              data-testid="mtable-step-count"
            >
              {n}
            </span>
            <button
              type="button"
              {...sxStep}
              className={`mtableStep ${sxStep.className ?? ''}`}
              data-testid="mtable-step-plus"
              aria-label={`Добавить ${die}`}
              disabled={rolling || n >= MAX_PER_DIE || total >= MAX_TOTAL}
              onClick={() => dispatch(setupActions.add({ die, delta: 1 }))}
            >
              +
            </button>
          </div>
        )
      })}
    </div>
  )
}
