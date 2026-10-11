// Шторка «+ Кости»: заголовок/очистка/крестик-морф, пресеты-чипы (тап —
// выбор, удержание — удаление), SVG-ряды степперов, «Сохранить сет».
// Разметка/логика 1-в-1 из mobile-table.ts (блок шторки); состояние — RTK.
import { useEffect, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { setupActions } from '@/features/tableSetup/setupSlice'
import { totalCount } from '@/features/tableSetup/tableSetup'
import {
  loadCustomPresets,
  saveCustomPreset,
  uniquePresetName,
} from '@/features/tableSetup/presets'
import { buzz as vibrate } from '@/shared/dice/sound'
import { checkIcon, clearAllIcon, closeIcon } from '@/shared/ui/mdIcon.utils'
import { mtUiActions } from '@/features/tableUi/mtUiSlice'
import { selectCounts, selectMtUi, selectRolling, selectTotal } from '../../selectors'
import { shortSet } from '../../format'
import { iconStyles } from '../../mt.stylex'
import { overlayStyles } from '../overlay.stylex'
import { sheetStyles as s } from './Sheet.stylex'
import { displaySets, sameCounts } from './sheetPresets.utils'
import { SheetPresetsSection } from './SheetPresetsSection'
import { SheetDiceRows } from './SheetDiceRows'

export interface SheetProps {
  /** Тосты корня (снятие/удаление сета). */
  showToast: (msg: string) => void
  onClose: () => void
  /** Открыта ли шторка (фокус на крестике). */
  open: boolean
}

export const Sheet = ({ showToast, onClose, open }: SheetProps): React.JSX.Element => {
  const dispatch = useAppDispatch()
  const counts = useAppSelector(selectCounts)
  const total = useAppSelector(selectTotal)
  const rolling = useAppSelector(selectRolling)
  const { activeSet, dirtySheet } = useAppSelector(selectMtUi)

  const holdFiredRef = useRef(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  // Ревизия пресетов: мутации (сохранение в шапке, тап/удаление чипов)
  // перечитывают localStorage — легаси renderPresets().
  const [presetRev, setPresetRev] = useState(0)
  const bumpPresets = (): void => setPresetRev((r) => r + 1)

  const short = shortSet(counts)

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  const onSave = (): void => {
    if (rolling || totalCount(counts) === 0) return
    if (activeSet) {
      saveCustomPreset(activeSet, counts)
      showToast('Набор обновлён')
    } else {
      const { fast, mine } = displaySets()
      const dup = [...fast, ...mine].find((p) => sameCounts(p.counts, counts))
      if (dup) {
        dispatch(mtUiActions.setActiveSet(dup.name))
        showToast('Такой набор уже есть')
      } else {
        const name = uniquePresetName(loadCustomPresets())
        saveCustomPreset(name, counts)
        dispatch(mtUiActions.setActiveSet(name))
        showToast('Набор сохранён')
      }
    }
    vibrate(15)
    bumpPresets()
  }

  // Грязное = тап по контролу (кнопка/инпут, кроме самого крестика и ссылок)
  // либо input; React-делегат на панели.
  const onPanelClick = (e: React.MouseEvent): void => {
    const t = e.target
    if (!(t instanceof Element)) return
    if (t.closest('a') || t.closest('button') === closeRef.current) return
    if (t.closest('button') || t.closest('input'))
      dispatch(mtUiActions.setDirty({ kind: 'sheet', dirty: true }))
  }
  const onPanelInput = (): void => {
    dispatch(mtUiActions.setDirty({ kind: 'sheet', dirty: true }))
  }

  // Кнопки шапки шторки: clear — disabled при пустом наборе (opacity-30,
  // hover снят — как disabled:hover:bg-transparent в легаси-утилитах).
  const sxClear = stylex.props(
    iconStyles.btn,
    iconStyles.body,
    total === 0 ? iconStyles.disabled : iconStyles.hover,
    total === 0 && iconStyles.opacity30,
  )
  const sxClose = stylex.props(iconStyles.btn, iconStyles.body, iconStyles.hover)

  const sxSheet = stylex.props(s.sheet)
  const sxHead = stylex.props(overlayStyles.head)
  const sxTitle = stylex.props(overlayStyles.headTitle)
  const sxRows = stylex.props(overlayStyles.rows)
  const sxFormula = stylex.props(s.formulaRow)
  const sxOk = stylex.props(s.ok)

  return (
    <div
      {...sxSheet}
      className={`mtableSheet ${sxSheet.className ?? ''}`}
      data-testid="mtable-sheet"
      hidden={!open}
      onClick={onPanelClick}
      onInput={onPanelInput}
    >
      <div
        {...sxHead}
        className={`mtableSheetHead ${sxHead.className ?? ''}`}
        data-testid="mtable-sheet-head"
      >
        <span {...sxTitle} className={sxTitle.className ?? undefined}>
          {short || 'Выбор костей'}
        </span>
        <button
          type="button"
          {...sxClear}
          className={`mtableIcon mtableSheetClear ${sxClear.className ?? ''}`}
          data-testid="mtable-sheet-clear"
          title="Убрать все"
          aria-label="Убрать все"
          disabled={total === 0}
          dangerouslySetInnerHTML={{ __html: clearAllIcon() }}
          onClick={() => {
            dispatch(mtUiActions.setActiveSet(null))
            dispatch(setupActions.clear())
          }}
        />
        <button
          ref={closeRef}
          type="button"
          {...sxClose}
          className={`mtableIcon${dirtySheet ? ' mtableMorph' : ''} ${sxClose.className ?? ''}`}
          data-testid="mtable-sheet-close"
          aria-label={dirtySheet ? 'Готово' : 'Закрыть выбор костей'}
          title={dirtySheet ? 'Готово' : 'Закрыть выбор костей'}
          dangerouslySetInnerHTML={{ __html: dirtySheet ? checkIcon() : closeIcon() }}
          onClick={onClose}
        />
      </div>
      <div {...sxRows} className={`mtableRows ${sxRows.className ?? ''}`} data-testid="mtable-rows">
        <SheetPresetsSection
          showToast={showToast}
          holdFiredRef={holdFiredRef}
          revision={presetRev}
          onMutate={bumpPresets}
        />
        <SheetDiceRows counts={counts} total={total} rolling={rolling} />
        <div
          {...sxFormula}
          className={`mtableFormulaRow ${sxFormula.className ?? ''}`}
          data-testid="mtable-formula-row"
        >
          <button
            type="button"
            {...sxOk}
            className={`mtableOk ${sxOk.className ?? ''}`}
            data-testid="mtable-ok"
            disabled={rolling || total === 0}
            onClick={onSave}
          >
            {activeSet ? 'Обновить набор' : 'Сохранить сет'}
          </button>
        </div>
      </div>
    </div>
  )
}
