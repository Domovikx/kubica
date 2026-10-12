// Строки степперов в шторке: глиф, имя, подсказка, −/количество/+ по
// каждому типу кости (лимиты — MAX_PER_DIE/MAX_TOTAL, блок при броске).
// Живёт внутри общей обёртки .mtableRows (порядок DOM 1-в-1 с легаси).
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch } from '@/app/hooks'
import { DIE_IDS } from '@/shared/dice/geometry'
import type { DieId } from '@/shared/dice/dieId.utils'
import { setupActions } from '@/features/tableSetup/model/setupSlice'
import { MAX_PER_DIE, MAX_TOTAL, type TableCounts } from '@/features/tableSetup/model/tableSetup'
import { DIE_HINTS, dieGlyph } from '@/shared/ui/dieGlyph.utils'
import { sheetStyles as s } from './Sheet.stylex'

export const SheetDiceRows = (props: {
  counts: TableCounts
  total: number
  rolling: boolean
}): React.JSX.Element => {
  const { counts, total, rolling } = props
  const dispatch = useAppDispatch()

  const sxRow = stylex.props(s.row)
  const sxGlyph = stylex.props(s.glyph)
  const sxName = stylex.props(s.name)
  const sxDesc = stylex.props(s.desc)
  const sxStep = stylex.props(s.step)
  const sxN = stylex.props(s.n)

  return (
    <div>
      {DIE_IDS.map((die: DieId) => {
        const n = counts[die] ?? 0
        return (
          <div
            key={die}
            {...sxRow}
            className={`mtableRow${n > 0 ? ' on' : ''} ${sxRow.className ?? ''}`}
            data-testid="mtable-row"
          >
            <span
              {...sxGlyph}
              className={`mtableGlyph ${sxGlyph.className ?? ''}`}
              data-testid="mtable-glyph"
              dangerouslySetInnerHTML={{ __html: dieGlyph(die) }}
            />
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
