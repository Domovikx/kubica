// Блок пресетов в шторке: «Быстрые»/«Мои» чипы (тап — выбор, удержание 3 с —
// удаление), подсказка и пустое состояние. Перечитывание localStorage —
// по ревизии из родителя (легаси renderPresets()).
import { useMemo } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { deleteCustomPreset, hideBuiltIn } from '@/features/tableSetup/model/presets'
import { setupActions } from '@/features/tableSetup/model/setupSlice'
import { buzz as vibrate } from '@/shared/dice/sound'
import { mtUiActions } from '@/features/tableUi/model/mtUiSlice'
import { selectMtUi } from '../../selectors'
import { Chip } from '../Chip'
import { sheetStyles as s } from './Sheet.stylex'
import {
  BUILT_IN_NAMES,
  displaySets,
  type PresetEntry,
} from '@/features/tableSetup/model/presetDisplay.utils'

const ChipGroup = (props: {
  title: string
  titleTestId: string
  groupTestId: string
  /** Класс-маркер группы (mtableFast/mtableMine — контракт CSS/e2e). */
  marker: string
  sets: PresetEntry[]
  activeSet: string | null
  /** Прятать контейнер при пустом наборе («Мои»; «Быстрые» — всегда виден). */
  hideWhenEmpty?: boolean
  onTap: (p: PresetEntry) => void
  onDelete: (name: string) => void
}): React.JSX.Element => {
  const { title, titleTestId, groupTestId, marker, sets, activeSet, onTap, onDelete } = props
  const sxPreCap = stylex.props(s.preCap)
  const sxSets = stylex.props(s.sets)
  return (
    <>
      <span
        {...sxPreCap}
        className={`mtablePreCap ${sxPreCap.className ?? ''}`}
        data-testid={titleTestId}
        hidden={sets.length === 0}
      >
        {title}
      </span>
      <div
        {...sxSets}
        className={`mtableSets ${marker} ${sxSets.className ?? ''}`}
        data-testid={groupTestId}
        hidden={props.hideWhenEmpty === true && sets.length === 0}
      >
        {sets.map((p) => (
          <Chip
            key={p.name}
            name={p.name}
            counts={p.counts}
            active={activeSet === p.name}
            onTap={() => onTap(p)}
            onDelete={() => onDelete(p.name)}
          />
        ))}
      </div>
    </>
  )
}

export const SheetPresetsSection = (props: {
  showToast: (msg: string) => void
  /** Локальная ревизия пресетов (мутация → bump в родителе). */
  revision: number
  onMutate: () => void
}): React.JSX.Element => {
  const { showToast, revision, onMutate } = props
  const dispatch = useAppDispatch()
  const { activeSet } = useAppSelector(selectMtUi)

  const sets = useMemo(() => {
    void revision
    return displaySets()
  }, [revision])

  const toggleSelect = (p: PresetEntry): void => {
    if (activeSet === p.name) {
      dispatch(mtUiActions.setActiveSet(null))
    } else {
      dispatch(mtUiActions.setActiveSet(p.name))
      dispatch(setupActions.setAll(p.counts))
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
  const sxPreHint = stylex.props(s.preHint)
  const sxEmpty = stylex.props(s.empty)

  return (
    <div
      {...sxPreBlock}
      className={`mtablePreBlock ${sxPreBlock.className ?? ''}`}
      data-testid="mtable-pre-block"
    >
      <ChipGroup
        title="Быстрые"
        titleTestId="mtable-fast-cap"
        groupTestId="mtable-fast"
        marker="mtableFast"
        sets={sets.fast}
        activeSet={activeSet}
        onTap={toggleSelect}
        onDelete={deleteSet}
      />
      <ChipGroup
        title="Мои"
        titleTestId="mtable-mine-cap"
        groupTestId="mtable-mine"
        marker="mtableMine"
        sets={sets.mine}
        activeSet={activeSet}
        hideWhenEmpty
        onTap={toggleSelect}
        onDelete={deleteSet}
      />
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
