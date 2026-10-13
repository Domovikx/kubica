// Чип пресета в шторке: тап — выбор, удержание 3 с (с паузой-грейсом 1 с) —
// удаление. Состав костей — React-глифы (волна Whtml, стили — stylex ниже);
// отсчёт/заливка — use-chip-hold. Состояния on/holding — токены в маркере
// (e2e ждёт toHaveClass); .on-визуал — app/styles/global.css (чекеры добавляют
// .on программно), счётчик — условный stylex по hold.holding.
import * as stylex from '@stylexjs/stylex'
import { DIE_IDS, dieGlyph } from '@/shared'

import type { TableCounts } from '@/features'
import { shortSet } from '@/features'
import { useChipHold } from './useChipHold'

export interface ChipProps {
  name: string
  counts: TableCounts
  active: boolean
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
    ':hover': {
      backgroundColor: '#242832',
    },
    whiteSpace: 'nowrap',
    touchAction: 'manipulation',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    // ≤360 (минимум 260): в сетке 2×N (s.sets) чип — плитка во всю ячейку,
    // глифы по центру, чтобы не было пустоты справа, как у сырых flex-wrap.
    '@media (max-width: 360px)': {
      justifyContent: 'center',
    },
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
  // Отсчёт удержания: виден только в состоянии holding (раньше глобалы
  // .mtableChipCount + .mtableChip.holding .mtableChipCount).
  count: {
    display: 'none',
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--fs-body)',
    fontWeight: 800,
    color: '#fff',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
    pointerEvents: 'none',
  },
  countShow: {
    display: 'flex',
  },
  // Состав костей глифами (раньше глобалы .mtableChipDie/.mtableChipDie svg/
  // .mtableChipN); .on-перебивка счётчика остаётся глобалом — чекеры ставят
  // чипу .on программно.
  die: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 1,
  },
  dieSvg: {
    display: 'block',
    width: 'var(--icon-chip)',
    height: 'var(--icon-chip)',
  },
  chipN: {
    fontSize: 'var(--fs-cap)',
    fontWeight: 800,
    color: '#9aa0aa',
  },
})

export const Chip = (props: ChipProps): React.JSX.Element => {
  const { name, counts, active, onTap, onDelete } = props
  const hold = useChipHold(onDelete, onTap)
  const label = shortSet(counts)

  const sxChip = stylex.props(styles.chip)
  const sxFill = stylex.props(styles.fill)
  const sxDice = stylex.props(styles.dice)
  const sxCount = stylex.props(styles.count, hold.holding && styles.countShow)
  const sxDie = stylex.props(styles.die)
  const sxDieSvg = stylex.props(styles.dieSvg)
  const sxChipN = stylex.props(styles.chipN)

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
      >
        {DIE_IDS.map((die) => {
          const n = counts[die] ?? 0
          if (n <= 0) return null
          return (
            <span
              key={die}
              {...sxDie}
              className={`mtableChipDie ${sxDie.className ?? ''}`}
              data-testid="mtable-chip-die"
            >
              {dieGlyph(die, sxDieSvg.className)}
              {n > 1 && (
                <span
                  {...sxChipN}
                  className={`mtableChipN ${sxChipN.className ?? ''}`}
                  data-testid="mtable-chip-n"
                >
                  {`×${n}`}
                </span>
              )}
            </span>
          )
        })}
      </span>
      <span
        {...sxCount}
        className={`mtableChipCount ${sxCount.className ?? ''}`}
        data-testid="mtable-chip-count"
        aria-hidden="true"
      >
        {hold.countdown}
      </span>
    </button>
  )
}
