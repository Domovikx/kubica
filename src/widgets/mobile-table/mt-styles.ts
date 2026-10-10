// Класс-константы виджета стола для React-разметки (волна A2). Маркеры
// .mtable* остаются в className (чекеры/e2e), stylex — рядом через spread
// (спред раньше className, иначе маркер теряется). Строки 1-в-1 из прежних
// билдеров (core/head/foot/overlays/watermark) — пиксельная идентичность.
// W1 (stylex): секция/канва/водяной знак/футер/тост/подложка переехали в
// свои tsx; иконки-кнопки (shared) — ниже на stylex; морф/спиннер/label/count
// и svg-дети — глобальные правила в styles.css (innerHTML-дети, stylex их
// не достигает); шапка (head/add/burger/star) — свой stylex в ui/Head.tsx.
// W2 (stylex): mobile-table.css удалён — оверлеи (Sheet/Drawer/MusicCard/
// Hint/Backdrop/Chip) на своём stylex, общее — ui/overlay-styles.ts;
// state-комбо (.on/.holding/partMin…) — глобал в styles.css (специфика
// stylex в @layer useCSSLayers:true).

import * as stylex from '@stylexjs/stylex'

/** Иконки-кнопки: общая база для шапки/шторки/дровера/карточки музыки. */
export const iconStyles = stylex.create({
  btn: {
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
  },
  /** Дочерний объект: `ICON_BTN_BODY` = база + p-0 + шкала body. */
  body: {
    padding: 0,
    fontSize: 'var(--fs-body)',
  },
  /** Наведение/нажатие: НЕ применять при disabled (как disabled:hover:bg-transparent). */
  hover: {
    ':hover': {
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    ':active': {
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
  },
  disabled: {
    cursor: 'default',
  },
  /** `aria-disabled="true"`: opacity-40, cursor-default, hover снят. */
  ariaOff: {
    cursor: 'default',
    opacity: 0.4,
    ':hover': {
      backgroundColor: 'transparent',
    },
  },
  /** `disabled:opacity-30` (кнопка «Убрать все»). */
  opacity30: {
    opacity: 0.3,
  },
})

/** Морф/спиннер/label/count и svg-дети кнопок — глобальные правила
 * `.mtableMorph > svg` / `.mtableSpin` / `.mtableHeadStarLabel` /
 * `.mtableHeadStarCount` / `.mtableIcon > svg` в styles.css. */
