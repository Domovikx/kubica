// Секция «История» в бургере: список последних бросков (реролл по строке),
// очистка — двухтап («Очистить» → «Точно?», 3 с — сброс в родителе).
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { formatLabel, formatParts, type HistoryEntry } from '@/entities/rollHistory/history'
import { historyActions } from '@/entities/rollHistory/historySlice'
import { mtUiActions } from '@/features/tableUi/mtUiSlice'
import { selectEntries, selectMtUi } from '../../selectors'
import { fmtTime, partClass } from '../../format'
import { overlayStyles } from '../overlay.stylex'
import { drawerStyles as s } from './Drawer.stylex'

export const DrawerHistorySection = (props: {
  onReroll: (entry: HistoryEntry) => void
}): React.JSX.Element => {
  const { onReroll } = props
  const dispatch = useAppDispatch()
  const entries = useAppSelector(selectEntries)
  const { clearArmed } = useAppSelector(selectMtUi)

  const sxSection = stylex.props(overlayStyles.section)
  const sxSectionHead = stylex.props(s.sectionHead)
  const sxLink = stylex.props(s.link)
  const sxHist = stylex.props(s.hist)
  const sxEmpty = stylex.props(s.empty)
  const sxHrow = stylex.props(s.hrow)
  const sxHv = stylex.props(s.hv)
  const sxHmeta = stylex.props(s.hmeta)
  const sxHp = stylex.props(s.hp)
  const sxHredo = stylex.props(s.hredo)

  return (
    <div
      {...sxSection}
      className={`mtableSection ${sxSection.className ?? ''}`}
      data-testid="mtable-history-section"
    >
      <div
        {...sxSectionHead}
        className={`mtableSectionHead ${sxSectionHead.className ?? ''}`}
        data-testid="mtable-history-head"
      >
        <span>История</span>
        <button
          type="button"
          {...sxLink}
          className={`mtableLink ${sxLink.className ?? ''}`}
          data-testid="mtable-link"
          onClick={() => {
            if (!clearArmed) {
              dispatch(mtUiActions.setClearArmed(true))
              return
            }
            dispatch(mtUiActions.setClearArmed(false))
            dispatch(historyActions.clear())
          }}
        >
          {clearArmed ? 'Точно?' : 'Очистить'}
        </button>
      </div>
      <div {...sxHist} className={`mtableHist ${sxHist.className ?? ''}`} data-testid="mtable-hist">
        {entries.length === 0 ? (
          <p
            {...sxEmpty}
            className={`mtableEmpty ${sxEmpty.className ?? ''}`}
            data-testid="mtable-history-empty"
          >
            Пока пусто — кинь кости
          </p>
        ) : (
          entries.slice(0, 5).map((entry, i) => {
            const texts = entry.parts ? formatParts(entry.parts) : []
            return (
              <button
                key={`${entry.at}-${i}`}
                type="button"
                {...sxHrow}
                className={`mtableHrow ${sxHrow.className ?? ''}`}
                data-testid="mtable-hrow"
                title="Повторить этот набор"
                onClick={() => onReroll(entry)}
              >
                <span
                  {...sxHv}
                  className={`mtableHv ${sxHv.className ?? ''}`}
                  data-testid="mtable-hv"
                >
                  {entry.display}
                </span>
                <span
                  {...sxHmeta}
                  className={`mtableHmeta ${sxHmeta.className ?? ''}`}
                  data-testid="mtable-hmeta"
                >
                  {entry.label
                    ? `${formatLabel(entry.label)} · ${fmtTime(entry.at)}`
                    : fmtTime(entry.at)}
                </span>
                <span
                  {...sxHp}
                  className={`mtableHp ${sxHp.className ?? ''}`}
                  data-testid="mtable-hp"
                >
                  {entry.parts?.map((p, j) => {
                    const cls = partClass(p) || (!p.kept ? 'partDrop' : '')
                    return (
                      <span key={j} className={cls || undefined}>
                        {texts[j]}
                      </span>
                    )
                  })}
                </span>
                <span
                  {...sxHredo}
                  className={`mtableHredo ${sxHredo.className ?? ''}`}
                  data-testid="mtable-hredo"
                >
                  ↻
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
