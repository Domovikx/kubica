// Общие стили трёх центрированных оверлеев (шторка «+ Кости», меню-бургер,
// карточка музыки): шапка, тело-скролл, секции, wide-кнопки. Перенос из
// mobile-table.css (волна W2); hover/.on — глобальные правила в styles.css
// (порядок при равной специфике: hover до .on, как в легаси).
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
  },
})
