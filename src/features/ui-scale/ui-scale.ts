// Масштаб интерфейса (2.20): шаги 100–200% — WCAG 1.4.4/G178 (контрол
// увеличения текста до 200% без потери контента), выбор в меню-бургере.
// Персист dice-uiscale; применение — через CSS-переменную --ui-scale
// (токены --fs-*/--icon-* и тап-боксы умножаются; кости 3D не зависят).

export const UI_SCALES = [1, 1.25, 1.5, 1.75, 2] as const
export type UiScale = (typeof UI_SCALES)[number]

const SCALE_KEY = 'dice-uiscale'

/** Текущий масштаб; битое/чужое значение — 1 (100%). */
export const uiScale = (): UiScale => {
  try {
    const v = Number(localStorage.getItem(SCALE_KEY))
    return (UI_SCALES as readonly number[]).includes(v) ? (v as UiScale) : 1
  } catch {
    return 1
  }
}

/** Пишет --ui-scale на <html> (токены читают его через наследование). */
export const applyUiScale = (s: UiScale): void => {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--ui-scale', String(s))
}

export const setUiScale = (s: UiScale): void => {
  try {
    localStorage.setItem(SCALE_KEY, String(s))
  } catch {
    // ignore
  }
  applyUiScale(s)
}
