// Общие стили трёх центрированных оверлеев (шторка «+ Кости», меню-бургер,
// карточка музыки): шапка, тело-скролл, секции, wide-кнопки. Перенос из
// mobile-table.css (волна W2); hover — здесь же, .on-визуал — global.css
// (порядок: .on вне слоёв бьёт stylex-hover — выбранная кнопка остаётся
// с акцентным фоном даже под курсором, как в легаси).
import * as stylex from '@stylexjs/stylex'

export const overlayStyles = stylex.create({
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: 'calc(12px + env(safe-area-inset-top)) 14px 6px',
    fontSize: 'var(--fs-title)',
    fontWeight: 800,
  },
  headTitle: {
    flex: 1,
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  rows: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    // Тонкий скролл: нативный ползунок (стандартные свойства) + -webkit-псевдо
    // (Chromium рисует свой; официальные псевдоэлементы stylex).
    scrollbarWidth: 'thin',
    scrollbarColor: '#3a3f49 transparent',
    '::-webkit-scrollbar': { width: 6 },
    '::-webkit-scrollbar-thumb': { background: '#3a3f49', borderRadius: 999 },
    '::-webkit-scrollbar-track': { background: 'transparent' },
  },
  section: {
    padding: '6px 14px 14px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#1d2026',
  },
  // Единственная секция внутри карточки музыки — разделитель снизу не нужен.
  sectionNoBorder: {
    borderBottomWidth: 'medium',
    borderBottomStyle: 'none',
    borderBottomColor: 'currentColor',
  },
  sectionHint: {
    margin: '8px 0 0',
    fontSize: 'var(--fs-meta)',
    lineHeight: 1.4,
    color: '#9aa0aa',
  },
  wide: {
    width: '100%',
    minHeight: 'var(--tap)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 'medium',
    borderStyle: 'none',
    borderColor: 'currentColor',
    borderRadius: 12,
    backgroundColor: '#1d2026',
    color: '#f0f2f5',
    fontFamily: 'inherit',
    fontSize: 'var(--fs-body)',
    fontWeight: 700,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: '#242832',
    },
  },
  // aria-disabled → визуал (раньше глобал .mtableWide[aria-disabled='true']).
  wideOff: {
    cursor: 'default',
    opacity: 0.4,
  },
  /** Svg-ребёнок .mtableWide: шкала --icon-wide (иконка + подпись рядом). */
  wideSvg: {
    display: 'block',
    width: 'var(--icon-wide)',
    height: 'var(--icon-wide)',
  },
})
