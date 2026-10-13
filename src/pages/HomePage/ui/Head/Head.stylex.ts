// Стили шапки стола: три колонки (звук/музыка, «+»/бургер, Star), кнопки
// add/burger/star. База иконок — ../../mt.stylex (iconStyles.btn/body/hover).
import * as stylex from '@stylexjs/stylex'

/** Спиннер загрузки: кадры (бывший глобальный @keyframes mtableSpin). */
const spinFrames = stylex.keyframes({
  to: { transform: 'rotate(360deg)' },
})

export const headStyles = stylex.create({
  head: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 6,
    display: 'grid',
    gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
    alignItems: 'center',
    gap: 10,
    paddingTop: 'calc(8px + env(safe-area-inset-top))',
    paddingLeft: 12,
    paddingRight: 12,
    paddingBottom: 8,
  },
  headLeft: {
    gridColumn: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    justifySelf: 'start',
  },
  headCtl: {
    position: 'relative',
    gridColumn: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  headSide: {
    gridColumn: 3,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    justifySelf: 'end',
  },
  /** Ряд Star: своя база (min-w:0, шкала --icon-like), ссылка, не кнопка. */
  star: {
    display: 'inline-flex',
    minWidth: 0,
    minHeight: 'var(--tap)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 0,
    paddingBottom: 0,
    // Shorthand `border` stylex молча не компилирует (0.19.1) — суб-свойства.
    borderWidth: 'medium',
    borderStyle: 'none',
    borderColor: 'currentColor',
    borderRadius: 12,
    backgroundColor: 'transparent',
    color: '#f0f2f5',
    fontFamily: 'inherit',
    fontSize: 'var(--fs-body)',
    fontWeight: 800,
    textDecorationLine: 'none',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    ':active': {
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    ':focus-visible': {
      outline: '2px solid #fff',
      outlineOffset: 2,
    },
  },
  /** Кнопка набора: «+» / текст состава (p-0 из iconStyles.body не нужен). */
  add: {
    display: 'inline-flex',
    minWidth: 'var(--tap)',
    minHeight: 'var(--tap)',
    alignItems: 'center',
    justifyContent: 'center',
    // Shorthand `border` stylex молча не компилирует (0.19.1) — суб-свойства.
    borderWidth: 'medium',
    borderStyle: 'none',
    borderColor: 'currentColor',
    borderRadius: 12,
    backgroundColor: 'transparent',
    color: '#f0f2f5',
    fontFamily: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    ':active': {
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 0,
    paddingBottom: 0,
    fontSize: 'min(var(--fs-sec), calc(16px * var(--ui-scale)))',
    whiteSpace: 'nowrap',
    maxWidth: 'calc(100vw - 48px - var(--tap))',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  /** Бургер: сумма/меню/лоадер, headline-шкала (base — iconStyles.btn). */
  burger: {
    padding: 0,
    fontSize: 'var(--fs-headline)',
  },
  burgerSum: {
    color: '#ef3124',
  },
  /** Музыка включена (легаси onstate:text-...). */
  musicOn: {
    color: '#ef3124',
  },
  /** Спиннер загрузки (бургер/музыка): span с маркером mtableSpin (e2e). */
  spin: {
    width: 'var(--icon-wide)',
    height: 'var(--icon-wide)',
    borderWidth: '3px',
    borderStyle: 'solid',
    borderColor: 'rgba(240, 242, 245, 0.25)',
    borderTopColor: '#ef3124',
    borderRadius: '50%',
    animationName: spinFrames,
    animationDuration: '0.7s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
  /** Svg звёздочки: своя шкала --icon-like (доп. к iconStyles.svgHead). */
  starSvg: {
    width: 'var(--icon-like)',
    height: 'var(--icon-like)',
  },
  /** Подпись Star (span-маркер mtableHeadStarLabel — чекеры audit-fonts). */
  starLabel: {
    fontSize: 'var(--fs-sec)',
    fontWeight: 700,
    lineHeight: 1,
    // Узкие экраны (≤360): подпись сжимается — как в легаси.
    '@media (max-width: 360px)': {
      display: 'none',
    },
  },
  /** Пилюля счётчика Star (span-маркер mtableHeadStarCount — чекеры). */
  starCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 'calc(var(--fs-cap) + 10px)',
    height: 'calc(var(--fs-cap) + 8px)',
    padding: '0 5px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'rgba(240, 242, 245, 0.28)',
    borderRadius: 6,
    fontSize: 'var(--fs-cap)',
    fontWeight: 700,
    lineHeight: 1,
  },
})
