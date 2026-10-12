// Шторка «+ Кости»: заголовок/очистка/крестик-морф, пресеты-чипы (тап —
// выбор, удержание — удаление), SVG-ряды степперов, «Сохранить сет».
// Разметка/логика 1-в-1 из mobile-table.ts (блок шторки); состояние — RTK.
import { useEffect, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app'
import {
  setupActions,
  totalCount,
  loadCustomPresets,
  saveCustomPreset,
  uniquePresetName,
  mtUiActions,
  displaySets,
  sameCounts,
} from '@/features'
import { buzz as vibrate, clearAllIcon } from '@/shared'

import { selectCounts, selectMtUi, selectRolling, selectTotal } from '../../model/selectors'
import { shortSet } from '../../lib/format'
import { iconStyles } from '../mt.stylex'
import { OverlayHead } from '../OverlayHead'
import { useDirtyPanel } from '../useDirtyPanel'
import { overlayStyles } from '../overlay.stylex'
import { sheetStyles as s } from './Sheet.stylex'

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

  const closeRef = useRef<HTMLButtonElement>(null)
  // Ревизия пресетов: мутации (сохранение в шапке, тап/удаление чипов)
  // перечитывают localStorage — легаси renderPresets().
  const [presetRev, setPresetRev] = useState(0)
  const bumpPresets = (): void => setPresetRev((r) => r + 1)

  const short = shortSet(counts)
  const { onPanelClick, onPanelInput } = useDirtyPanel('sheet', closeRef)

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

  // Кнопка шапки шторки: clear — disabled при пустом наборе (opacity-30,
  // hover снят — как disabled:hover:bg-transparent в легаси-утилитах).
  const sxClear = stylex.props(
    iconStyles.btn,
    iconStyles.body,
    total === 0 ? iconStyles.disabled : iconStyles.hover,
    total === 0 && iconStyles.opacity30,
  )

  const sxSheet = stylex.props(s.sheet)
  const sxRows = stylex.props(overlayStyles.rows)
  const sxFormula = stylex.props(s.formulaRow)
  const sxOk = stylex.props(s.ok)

  const clearBtn = (
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
  )

  return (
    <div
      {...sxSheet}
      className={`mtableSheet ${sxSheet.className ?? ''}`}
      data-testid="mtable-sheet"
      hidden={!open}
      onClick={onPanelClick}
      onInput={onPanelInput}
    >
      <OverlayHead
        title={short || 'Выбор костей'}
        dirty={dirtySheet}
        closeLabel="Закрыть выбор костей"
        onClose={onClose}
        closeRef={closeRef}
        headTestId="mtable-sheet-head"
        closeTestId="mtable-sheet-close"
        leading={clearBtn}
      />
      <div {...sxRows} className={`mtableRows ${sxRows.className ?? ''}`} data-testid="mtable-rows">
        <SheetPresetsSection showToast={showToast} revision={presetRev} onMutate={bumpPresets} />
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
