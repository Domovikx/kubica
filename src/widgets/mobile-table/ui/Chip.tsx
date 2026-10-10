// Чип пресета в шторке: тап — выбор, удержание 3 с (с паузой-грейсом 1 с) —
// удаление. Состав костей глифами (innerHTML); отсчёт/заливка — use-chip-hold.
// Состояния 'on'/'holding' — токен в маркере + глобальные правила в styles.css
// (чекеры добавляют .on программно, e2e ждёт токены в className).
import * as stylex from '@stylexjs/stylex'
import { DIE_IDS } from '@/entities/dice-geometry/geometry'
import { dieGlyph } from '@/shared/ui/die-glyph'
import type { TableCounts } from '@/features/table-setup/table-setup'
import { shortSet } from '../format'
import { useChipHold } from '../hooks/use-chip-hold'

export interface ChipProps {
  name: string
  counts: TableCounts
  active: boolean
  holdFiredRef: { current: boolean }
  onTap: () => void
  onDelete: () => void
}

const styles = stylex.create({
  chip: {
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 'var(--tap)',
    padding: '0 12px',
    borderWidth: 'medium',
    borderStyle: 'none',
    borderColor: 'currentColor',
    borderRadius: 999,
    backgroundColor: '#1d2026',
    color: '#f0f2f5',
    fontFamily: 'inherit',
    fontSize: 'var(--fs-sec)',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    touchAction: 'manipulation',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    pointerEvents: 'none',
  },
  dice: {
    position: 'relative',
    zIndex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
})

export const Chip = (props: ChipProps): React.JSX.Element => {
  const { name, counts, active, holdFiredRef, onTap, onDelete } = props
  const hold = useChipHold(onDelete, onTap, holdFiredRef)
  const label = shortSet(counts)

  const diceHtml = (() => {
    let html = ''
    for (const die of DIE_IDS) {
      const n = counts[die] ?? 0
      if (n <= 0) continue
      html += `<span class="mtableChipDie" data-testid="mtable-chip-die">${dieGlyph(die)}`
      if (n > 1) html += `<span class="mtableChipN" data-testid="mtable-chip-n">×${n}</span>`
      html += '</span>'
    }
    return html
  })()

  const sxChip = stylex.props(styles.chip)
  const sxFill = stylex.props(styles.fill)
  const sxDice = stylex.props(styles.dice)

  return (
    <button
      type="button"
      {...sxChip}
      className={`mtableChip${active ? ' on' : ''}${hold.holding ? ' holding' : ''} ${sxChip.className ?? ''}`}
      data-testid="mtable-chip"
      data-set={name}
      title={label}
      aria-label={`Набор: ${label}`}
      aria-pressed={active}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={hold.onPointerDown}
      onPointerUp={hold.onPointerUp}
      onPointerCancel={hold.onPointerCancel}
      onClick={hold.onClick}
    >
      <span
        ref={hold.fillRef}
        {...sxFill}
        className={`mtableChipFill ${sxFill.className ?? ''}`}
        data-testid="mtable-chip-fill"
      />
      <span
        {...sxDice}
        className={`mtableChipDice ${sxDice.className ?? ''}`}
        data-testid="mtable-chip-dice"
        dangerouslySetInnerHTML={{ __html: diceHtml }}
      />
      <span className="mtableChipCount" data-testid="mtable-chip-count" aria-hidden="true">
        {hold.countdown}
      </span>
    </button>
  )
}
