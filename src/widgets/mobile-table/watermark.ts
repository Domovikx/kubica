// Водяной знак (фидбэк: «если нельзя сделать маленьким — надо сделать
// большим»): гигантское «Kubica» почти во всю ширину `.mtable`, ПОД канвой
// (канва прозрачная, см. table.ts alpha) и под шапкой — фоновая подложка,
// как крупный логотип-призрак по центру сцены. Декор — только для глаз.
export interface Watermark {
  el: HTMLElement
  /** Адаптивка под экран: вызывать на resize/подготовку шрифтов. */
  fit: () => void
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export const createWatermark = (): Watermark => {
  const watermark = document.createElement('div')
  watermark.className = 'mtableWatermark'
  watermark.dataset.testid = 'mtable-watermark'
  watermark.setAttribute('aria-hidden', 'true')
  const wmText = document.createElement('span')
  wmText.className = 'mtableWatermarkText'
  wmText.textContent = 'Kubica'
  watermark.append(wmText)
  // Адаптивка под экран (фидбэк): широкий → по горизонтали, узкий → по
  // вертикали, квадратный → под 45°. Угол считаем от пропорций ВЬЮПОРТА
  // (контейнер на десктопе зажат max-width 720 — по нему «широта» не видна),
  // длину — по контейнеру: растягиваем почти во всю доступную длину с
  // эстетическим отступом от краёв, масштаб шрифта меряем на лету.
  const fit = (): void => {
    const r = watermark.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return
    const vw = window.innerWidth || r.width
    const vh = window.innerHeight || r.height
    const aspect = vw / Math.max(vh, 1)
    // ≥1.5 — широко → 0°; ровно 1 (квадрат) → 45°; ≤2/3 — узко → 90°.
    const angle =
      aspect >= 1
        ? 45 * clamp01((1.5 - aspect) / 0.5)
        : 45 + 45 * clamp01((1 - aspect) / (1 - 2 / 3))
    const rad = (angle * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const pad = Math.min(48, Math.max(16, Math.round(Math.min(r.width, r.height) * 0.06)))
    const availW = r.width - 2 * pad
    const availH = r.height - 2 * pad
    // Длина отрезка той же ориентации, что влезает в бокс (по диагонали —
    // min сторон / cos45).
    const along = Math.min(
      cos > 0.001 ? availW / cos : Number.POSITIVE_INFINITY,
      sin > 0.001 ? availH / sin : Number.POSITIVE_INFINITY,
    )
    // Меряем ширину строки при 100px (без поворота) → масштаб под `along`.
    wmText.style.transform = 'none'
    wmText.style.fontSize = '100px'
    const w100 = wmText.getBoundingClientRect().width
    if (w100 < 1) return
    const fs = (along / w100) * 100
    wmText.style.fontSize = `${Math.round(fs * 10) / 10}px`
    wmText.style.transform = angle > 0.05 ? `rotate(${angle}deg)` : 'none'
  }
  return { el: watermark, fit }
}
