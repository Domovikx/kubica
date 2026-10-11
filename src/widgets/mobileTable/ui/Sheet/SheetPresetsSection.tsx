// Блок пресетов в шторке: «Быстрые»/«Мои» чипы (тап — выбор, удержание 3 с —
// удаление), подсказка и пустое состояние. Перечитывание localStorage —
// по ревизии из родителя (легаси renderPresets()).
import { useMemo } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { deleteCustomPreset, hideBuiltIn } from '@/features/tableSetup/presets'
import { setupActions } from '@/features/tableSetup/setupSlice'
import type { TableCounts } from '@/features/tableSetup/tableSetup'
import { buzz as vibrate } from '@/shared/dice/sound'
import { mtUiActions } from '@/features/tableUi/mtUiSlice'
import { selectMtUi } from '../../selectors'
import { Chip } from '../Chip'
import { sheetStyles as s } from './Sheet.stylex'
import { BUILT_IN_NAMES, displaySets } from './sheetPresets.utils'

export const SheetPresetsSection = (props: {
  showToast: (msg: string) => void
  holdFiredRef: React.RefObject<boolean>
  /** Локальная ревизия пресетов (мутация → bump в родителе). */
  revision: number
  onMutate: () => void
}): React.JSX.Element => {
  const { showToast, holdFiredRef, revision, onMutate } = props
  const dispatch = useAppDispatch()
  const { activeSet } = useAppSelector(selectMtUi)

  const sets = useMemo(() => {
    void revision
    return displaySets()
  }, [revision])

  const toggleSelect = (name: string, chipCounts: TableCounts): void => {
    if (activeSet === name) {
      dispatch(mtUiActions.setActiveSet(null))
    } else {
      dispatch(mtUiActions.setActiveSet(name))
      dispatch(setupActions.setAll(chipCounts))
    }
    onMutate()
  }

  const deleteSet = (name: string): void => {
    deleteCustomPreset(name)
    if (BUILT_IN_NAMES.has(name)) hideBuiltIn(name)
    if (activeSet === name) dispatch(mtUiActions.setActiveSet(null))
    vibrate(35)
    showToast('Набор удалён')
    onMutate()
  }

  const sxPreBlock = stylex.props(s.preBlock)
  const sxPreCap = stylex.props(s.preCap)
  const sxSets = stylex.props(s.sets)
  const sxPreHint = stylex.props(s.preHint)
  const sxEmpty = stylex.props(s.empty)

  return (
    <div
      {...sxPreBlock}
      className={`mtablePreBlock ${sxPreBlock.className ?? ''}`}
      data-testid="mtable-pre-block"
    >
      <span
        {...sxPreCap}
        className={`mtablePreCap ${sxPreCap.className ?? ''}`}
        data-testid="mtable-fast-cap"
        hidden={sets.fast.length === 0}
      >
        Быстрые
      </span>
      <div
        {...sxSets}
        className={`mtableSets mtableFast ${sxSets.className ?? ''}`}
        data-testid="mtable-fast"
      >
        {sets.fast.map((p) => (
          <Chip
            key={p.name}
            name={p.name}
            counts={p.counts}
            active={activeSet === p.name}
            holdFiredRef={holdFiredRef}
            onTap={() => toggleSelect(p.name, p.counts)}
            onDelete={() => deleteSet(p.name)}
          />
        ))}
      </div>
      <span
        {...sxPreCap}
        className={`mtablePreCap ${sxPreCap.className ?? ''}`}
        data-testid="mtable-mine-cap"
        hidden={sets.mine.length === 0}
      >
        Мои
      </span>
      <div
        {...sxSets}
        className={`mtableSets mtableMine ${sxSets.className ?? ''}`}
        data-testid="mtable-mine"
        hidden={sets.mine.length === 0}
      >
        {sets.mine.map((p) => (
          <Chip
            key={p.name}
            name={p.name}
            counts={p.counts}
            active={activeSet === p.name}
            holdFiredRef={holdFiredRef}
            onTap={() => toggleSelect(p.name, p.counts)}
            onDelete={() => deleteSet(p.name)}
          />
        ))}
      </div>
      <p
        {...sxPreHint}
        className={`mtablePreHint ${sxPreHint.className ?? ''}`}
        data-testid="mtable-pre-hint"
      >
        Тап — набор · удерживай 3 с — удалить
      </p>
      <p
        {...sxEmpty}
        className={`mtableEmpty ${sxEmpty.className ?? ''}`}
        data-testid="mtable-preset-empty"
        hidden={sets.fast.length + sets.mine.length > 0}
      >
        Пока нет — набери кости и жми «Сохранить сет»
      </p>
    </div>
  )
}
