// Стили бургер-меню (дроуэра): панель, тело-скролл, секции, строки истории,
// масштаб-бегунок, ссылки. .on-визуал — global.css (чекеры ставят .on
// программно, вне слоёв); общая шапка/секции оверлеев — в ../overlay.stylex.
import * as stylex from '@stylexjs/stylex'

/** Поп оверлея: кадры локально (stylex не умеет keyframes через импорт —
 * плагин требует локальный вызов stylex.keyframes; бывший глобальный
 * @keyframes mtablePop). */
const popFrames = stylex.keyframes({
  from: { opacity: 0, transform: 'translate(-50%, -50%) scale(0.96)' },
  to: { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
})

export const drawerStyles = stylex.create({
  drawer: {
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
    // Поп оверлея: кадры popFrames — локальный stylex.keyframes (см. выше).
    animationName: popFrames,
    animationDuration: '0.16s',
    animationTimingFunction: 'ease-out',
    '@media (max-width: 600px)': {
      width: 'calc(100% - 24px)',
      maxHeight: 'calc(100% - 32px)',
    },
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    // Тонкий скролл: стандартные свойства здесь; -webkit-псевдо живут в
    // global.css (Chrome не красит вендор-псевдо внутри @layer — см. там).
    scrollbarWidth: 'thin',
    scrollbarColor: '#3a3f49 transparent',
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  sectionHead: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    fontWeight: 800,
    fontSize: 'var(--fs-body)',
  },
  sectionTitle: {
    display: 'block',
    padding: '8px 0',
    fontWeight: 800,
    fontSize: 'var(--fs-body)',
  },
  /** Заголовок секции «Звук и вибрация»: на ≤360 остаются только иконки. */
  soundTitle: {
    '@media (max-width: 360px)': {
      display: 'none',
    },
  },
  /** Полная подпись («Выключить звук» и т.п.) — на ≤360 спрятана. */
  soundLong: {
    '@media (max-width: 360px)': {
      display: 'none',
    },
  },
  /** ≤360: секция «Звук» — компактный ряд иконок-кнопок вместо столбика пилюль. */
  soundRow: {
    '@media (max-width: 360px)': {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
  },
  /** ≤360: .mtableWide превращается в иконку-плитку, заполняющую треть ряда;
   *  marginTop: 0 гасит wideGap — в ряде отступ задаёт gap секции. */
  iconBtn: {
    '@media (max-width: 360px)': {
      flex: '1 1 0',
      width: 'auto',
      padding: 0,
      marginTop: 0,
    },
  },
  link: {
    minHeight: 'var(--tap)',
    padding: '0 12px',
    marginRight: -12,
    borderWidth: 'medium',
    borderStyle: 'none',
    borderColor: 'currentColor',
    backgroundColor: 'transparent',
    color: '#9aa0aa',
    fontFamily: 'inherit',
    fontSize: 'var(--fs-sec)',
    cursor: 'pointer',
  },
  hist: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  empty: {
    color: '#9aa0aa',
    fontSize: 'var(--fs-sec)',
    lineHeight: 1.4,
    margin: '4px 0',
  },
  hrow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    width: '100%',
    textAlign: 'left',
    backgroundColor: '#1d2026',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 12,
    padding: '9px 12px',
    color: '#f0f2f5',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  hv: {
    color: '#ef3124',
    fontWeight: 800,
    fontSize: 'var(--fs-title)',
  },
  hmeta: {
    color: '#9aa0aa',
    fontSize: 'var(--fs-meta)',
    // ≤360 (официальный минимум 260): мета «d4 d6 · 13:49» выкинута — в строке
    // истории остаются результат, броски и ↻.
    '@media (max-width: 360px)': {
      display: 'none',
    },
  },
  hp: {
    marginLeft: 'auto',
    color: '#9aa0aa',
    fontSize: 'var(--fs-meta)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '45%',
  },
  hredo: {
    color: '#9aa0aa',
    fontSize: 'var(--fs-body)',
    marginLeft: 2,
  },
  // Разбивка истории: min/макс/сброс — условные stylex-классы; маркеры
  // partMin/partMax/partDrop остаются в className (контракт partClass()).
  pMin: {
    color: '#ff8a7a',
    fontWeight: 800,
  },
  pMax: {
    color: '#ffd166',
    fontWeight: 800,
  },
  pDrop: {
    opacity: 0.4,
    color: '#9a9da4',
    textDecoration: 'line-through',
  },
  wideGap: {
    marginTop: 8,
  },
  scaleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  scaleTrackCol: {
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  // Бегунок масштаба: тап-бокс = --tap (44 базовых), element-level. Трек/
  // боббин — вендор-псевдо в global.css (Chrome не красит ::-webkit-slider-*
  // из @layer), --fill ставит React инлайном.
  scaleRange: {
    flex: '1 1 auto',
    minWidth: 0,
    width: '100%',
    height: 'var(--tap)',
    margin: 0,
    appearance: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    ':focus-visible': {
      outline: '2px solid #ef3124',
      outlineOffset: '-4px',
    },
  },
  scaleTicks: {
    display: 'flex',
    justifyContent: 'space-between',
    // Фикс-px, не токен: подписи шагов — дублирующая декорация (aria-hidden,
    // значение объявляет сам бегунок), иначе ×200% они рвут 1.4.10 по ширине.
    fontSize: 12,
    lineHeight: 1.2,
    color: '#9aa0aa',
    userSelect: 'none',
  },
  about: {
    fontSize: 'var(--fs-sec)',
    color: '#9aa0aa',
    margin: 0,
    lineHeight: 1.5,
  },
  social: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    minHeight: 'var(--tap)',
    padding: '0 12px',
    borderRadius: 12,
    backgroundColor: '#1d2026',
    color: '#f0f2f5',
    fontSize: 'var(--fs-body)',
    fontWeight: 700,
    textDecoration: 'none',
    ':hover': {
      backgroundColor: '#242832',
    },
    ':focus-visible': {
      outline: '2px solid #fff',
      outlineOffset: 2,
    },
  },
  socialGap: {
    marginTop: 8,
  },
  /** Svg-ребёнок .mtableSocial: шкала --icon-wide, не сжимается. */
  socialSvg: {
    display: 'block',
    width: 'var(--icon-wide)',
    height: 'var(--icon-wide)',
    flex: 'none',
  },
  /** Звезда оценки репо (ссылка с маркером mtableStar): svg красный. */
  socialStar: {
    color: '#ef3124',
  },
  /** Название внутри ссылки соцсети (маркер mtableSocialName — чекеры). */
  socialName: {
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  /** ≤360: длинное имя звезды «Оценить репозиторий» спрятано — короткое
   *  «Оценить» (socialNameShort), иначе обрезка ellipsis'ом. */
  socialNameLong: {
    '@media (max-width: 360px)': {
      display: 'none',
    },
  },
  socialNameShort: {
    display: 'none',
    '@media (max-width: 360px)': {
      display: 'inline',
    },
  },
  /** Хендл/счётчик внутри ссылки (маркер mtableSocialMeta — чекеры). */
  socialMeta: {
    marginLeft: 'auto',
    color: '#9aa0aa',
    fontSize: 'var(--fs-sec)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  /** ≤360: хендл @DomovikX спрятан — имя «GitHub»/«Telegram» само себя
   *  опознаёт, экономим ширину (иначе имя режется в «Git...»). */
  socialMetaHide: {
    '@media (max-width: 360px)': {
      display: 'none',
    },
  },
})
