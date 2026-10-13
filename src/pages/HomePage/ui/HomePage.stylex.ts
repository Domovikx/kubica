import * as stylex from '@stylexjs/stylex'

/**
 * Хост-оболочка страницы-стола `main.viewers#viewers` — тот же DOM, что был
 * в index.html. Бывший base-глобал `body[data-mode='mtable'] .viewers`
 * (styles.css): стол всегда активен (mode-селектор и data-mode выпилены) —
 * селектор развернут в plain-стили хоста. clip (а не hidden) запрещает и
 * программный скролл (фокус в шторке); списки скроллятся сами.
 */
export const homeStyles = stylex.create({
  viewers: {
    display: 'block',
    marginLeft: 0,
    // Фолбэки по порядку: vh — старые браузеры без dvh, dvh — канон.
    height: ['100vh', '100dvh'],
    overflow: ['hidden', 'clip'],
    overscrollBehavior: 'none',
  },
})
