// Шторка «+ Кости»: заголовок/очистка/крестик-морф, SVG-ряды степперов,
// пресеты-чипы (тап — выбор, удержание — удаление), «Сохранить сет».
// Разметка/логика 1-в-1 из mobile-table.ts (блок шторки); состояние — RTK.
import { useEffect, useMemo, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { DIE_IDS, type DieId } from '@/entities/dice-geometry/geometry'
import { setupActions } from '@/features/table-setup/setup-slice'
import {
  MAX_PER_DIE,
  MAX_TOTAL,
  totalCount,
  type TableCounts,
} from '@/features/table-setup/table-setup'
import {
  BUILT_IN_PRESETS,
  deleteCustomPreset,
  hideBuiltIn,
  loadCustomPresets,
  loadHiddenBuiltIns,
  saveCustomPreset,
  uniquePresetName,
} from '@/features/table-setup/presets'
import { DIE_HINTS, dieGlyph } from '@/shared/ui/die-glyph'
import { buzz as vibrate } from '@/shared/dice/sound'
import { checkIcon, clearAllIcon, closeIcon } from '@/shared/ui/md-icon'
import { mtUiActions } from '../mt-ui-slice'
import { selectCounts, selectMtUi, selectRolling, selectTotal } from '../selectors'
import { shortSet } from '../format'
import { iconStyles } from '../mt-styles'
import { overlayStyles } from './overlay-styles'
import { Chip } from './Chip'

const BUILT_IN_NAMES = new Set(BUILT_IN_PRESETS.map((p) => p.name))

const styles = stylex.create({
  sheet: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 21,
    width: 'min(calc(360px * var(--ui-scale)), calc(100% - 48px))',
    maxHeight: 'calc(100% - 48px)',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#121419',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#2a2e36',
    borderRadius: 14,
    overflow: 'hidden',
    paddingBottom: 'env(safe-area-inset-bottom)',
    // Узкие экраны (≤600): карточка шире — поля 12px (тот же блок на троих
    // в легаси; специфика stylex-медиа бьёт базу того же объекта).
    '@media (max-width: 600px)': {
      width: 'calc(100% - 24px)',
      maxHeight: 'calc(100% - 32px)',
    },
  },
  preBlock: {
    padding: '6px 14px 8px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#1d2026',
  },
  preCap: {
    display: 'block',
    padding: '6px 0 0',
    fontSize: 'var(--fs-cap)',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#9aa0aa',
  },
  preHint: {
    margin: '8px 0 0',
    fontSize: 'var(--fs-meta)',
    lineHeight: 1.4,
    color: '#9aa0aa',
  },
  sets: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  empty: {
    color: '#9aa0aa',
    fontSize: 'var(--fs-sec)',
    lineHeight: 1.4,
    margin: '4px 0',
  },
  row: {
    display: 'flex',
    // wrap: при масштабе ≥150% степперы/глиф не влезают в строку 320.
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    padding: '8px 14px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#1d2026',
  },
  glyph: {
    display: 'flex',
    width: 'calc(var(--icon-row) + 8px)',
    justifyContent: 'center',
    color: '#c9cdd4',
    flexShrink: 0,
  },
  name: {
    fontWeight: 800,
    fontSize: 'var(--fs-title)',
    width: 'calc(40px * var(--ui-scale))',
  },
  desc: {
    fontSize: 'var(--fs-meta)',
    lineHeight: 1.35,
    color: '#9aa0aa',
    flex: 1,
  },
  step: {
    width: 'var(--tap)',
    height: 'var(--tap)',
    borderRadius: 12,
    borderWidth: 'medium',
    borderStyle: 'none',
    borderColor: 'currentColor',
    backgroundColor: '#22262e',
    color: '#f0f2f5',
    fontSize: 'var(--fs-headline)',
    fontFamily: 'inherit',
    cursor: 'pointer',
    flexShrink: 0,
    ':hover': {
      backgroundColor: '#2a2f38',
    },
    ':disabled': {
      opacity: 0.3,
      cursor: 'default',
    },
  },
  n: {
    fontWeight: 800,
    minWidth: 'calc(28px * var(--ui-scale))',
    textAlign: 'center',
    fontSize: 'var(--fs-headline)',
  },
  formulaRow: {
    display: 'flex',
    gap: 8,
    padding: '12px 14px 4px',
  },
  ok: {
    // Сохранение занимает всю строку (инпута имени больше нет) — flex:1
    // из descendant-правила .mtableFormulaRow .mtableOk (Ok всегда внутри).
    flex: 1,
    minHeight: 'var(--tap)',
    padding: '0 18px',
    borderWidth: 'medium',
    borderStyle: 'none',
    borderColor: 'currentColor',
    borderRadius: 12,
    // Фон CTA: #d92b1c вместо бренда — см. .mtableChip.on.
    backgroundColor: '#d92b1c',
    color: '#fff',
    fontFamily: 'inherit',
    fontSize: 'var(--fs-body)',
    fontWeight: 800,
    cursor: 'pointer',
    ':disabled': {
      opacity: 0.45,
    },
  },
})

const sameCounts = (a: TableCounts, b: TableCounts): boolean =>
  DIE_IDS.every((die) => (a[die] ?? 0) === (b[die] ?? 0))

/** Отображаемые наборы: встроенные (с учётом своих переопределений) + свои. */
const displaySets = (): {
  fast: Array<{ name: string; counts: TableCounts }>
  mine: Array<{ name: string; counts: TableCounts }>
} => {
  const customs = loadCustomPresets()
  const hidden = new Set(loadHiddenBuiltIns())
  const shadow = new Map(
    customs.filter((p) => BUILT_IN_NAMES.has(p.name)).map((p) => [p.name, p.counts]),
  )
  const fast = BUILT_IN_PRESETS.filter((p) => !hidden.has(p.name)).map((p) => ({
    name: p.name,
    counts: shadow.get(p.name) ?? p.counts,
  }))
  const mine = customs
    .filter((p) => !BUILT_IN_NAMES.has(p.name))
    .map((p) => ({ name: p.name, counts: p.counts }))
  return { fast, mine }
}

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

  // Пресеты перечитываются из localStorage после мутаций — локальный ревизион
  // счётчик (легаси renderPresets()).
  const [presetRev, setPresetRev] = useState(0)
  const holdFiredRef = useRef(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const bump = (): void => setPresetRev((r) => r + 1)

  const sets = useMemo(() => {
    void presetRev
    return displaySets()
  }, [presetRev])

  const short = shortSet(counts)

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  const toggleSelect = (name: string, chipCounts: TableCounts): void => {
    if (activeSet === name) {
      dispatch(mtUiActions.setActiveSet(null))
    } else {
      dispatch(mtUiActions.setActiveSet(name))
      dispatch(setupActions.setAll(chipCounts))
    }
    bump()
  }

  const deleteSet = (name: string): void => {
    deleteCustomPreset(name)
    if (BUILT_IN_NAMES.has(name)) hideBuiltIn(name)
    if (activeSet === name) dispatch(mtUiActions.setActiveSet(null))
    vibrate(35)
    showToast('Набор удалён')
    bump()
  }

  const onSave = (): void => {
    if (rolling || totalCount(counts) === 0) return
    if (activeSet) {
      saveCustomPreset(activeSet, counts)
      showToast('Набор обновлён')
    } else {
      const { fast, mine } = displaySets()
      const dup = [...fast, ...mine].find((s) => sameCounts(s.counts, counts))
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
    bump()
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

  const sxSheet = stylex.props(styles.sheet)
  const sxHead = stylex.props(overlayStyles.head)
  const sxTitle = stylex.props(overlayStyles.headTitle)
  const sxRows = stylex.props(overlayStyles.rows)
  const sxPreBlock = stylex.props(styles.preBlock)
  const sxPreCap = stylex.props(styles.preCap)
  const sxSets = stylex.props(styles.sets)
  const sxPreHint = stylex.props(styles.preHint)
  const sxEmpty = stylex.props(styles.empty)
  const sxRow = stylex.props(styles.row)
  const sxGlyph = stylex.props(styles.glyph)
  const sxName = stylex.props(styles.name)
  const sxDesc = stylex.props(styles.desc)
  const sxStep = stylex.props(styles.step)
  const sxN = stylex.props(styles.n)
  const sxFormula = stylex.props(styles.formulaRow)
  const sxOk = stylex.props(styles.ok)

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
            {sets.fast.map((s) => (
              <Chip
                key={s.name}
                name={s.name}
                counts={s.counts}
                active={activeSet === s.name}
                holdFiredRef={holdFiredRef}
                onTap={() => toggleSelect(s.name, s.counts)}
                onDelete={() => deleteSet(s.name)}
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
            {sets.mine.map((s) => (
              <Chip
                key={s.name}
                name={s.name}
                counts={s.counts}
                active={activeSet === s.name}
                holdFiredRef={holdFiredRef}
                onTap={() => toggleSelect(s.name, s.counts)}
                onDelete={() => deleteSet(s.name)}
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
        {/* Обёртка без класса — как legacy `rows` (порядок DOM 1-в-1). */}
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
