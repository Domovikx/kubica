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
  // вертикали, квадратный → под 45°. Угол и доступный бокс считаем от
  // контейнера (.mtable = вьюпорт, max-width 720 снят) — один источник,
  // без «угол от вьюпорта, длина от контейнера». Растягиваем почти во всю
  // доступную длину с эстетическим отступом от краёв, масштаб шрифта меряем
  // на лету.
  const fit = (): void => {
    const r = watermark.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return
    const aspect = r.width / Math.max(r.height, 1)
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
    // Меряем строку при 100px (без поворота): ширина w100 и высота бокса h100.
    wmText.style.transform = 'none'
    wmText.style.fontSize = '100px'
    const box = wmText.getBoundingClientRect()
    const w100 = box.width
    const h100 = box.height
    if (w100 < 1) return
    // Повёрнутый бокс строки — не нулевой толщины: W·cos + H·sin ≤ availW,
    // H·cos + W·sin ≤ availH (угол 0..90°, sin/cos ≥ 0). ratio = H/W при
    // 100px, отсюда fs = min(availW/(cos+ratio·sin), availH/(sin+ratio·cos))
    // / w100 · 100 — иначе длинная строка обрезалась по толщине строки.
    const ratio = h100 / w100
    const fs = (Math.min(availW / (cos + ratio * sin), availH / (sin + ratio * cos)) / w100) * 100
    wmText.style.fontSize = `${Math.floor(fs * 10) / 10}px`
    wmText.style.transform = angle > 0.05 ? `rotate(${angle}deg)` : 'none'
  }
  return { el: watermark, fit }
}
