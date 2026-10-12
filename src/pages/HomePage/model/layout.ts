// Чистая раскладка пачки на канве: DOM-измерения (размер канвы, отступы
// шапки/футера) делает вызывающий, тут — план: слоты, масштаб камеры и
// границы физики. Масштаб m (ед./px) = шаг ячейки в мире / шаг в px: сетка,
// камера и границы физики живут в одном масштабе — кость занимает свою
// ячейку одинаково на любом экране, а одиночная кость не растекается
// (потолок ячейки).
/** Внутренний прямоугольник канвы под раскладку (px): канва минус отступы. */
export interface LayoutRect {
  w: number
  h: number
}

export interface SlotPlan {
  /** Шаг ячейки (px) — квадрат, в который вписывается кость с запасом. */
  cell: number
  cols: number
  rows: number
  /** Центры ячеек: px от центра rect, y вниз (экранная ориентация). */
  slots: Array<{ x: number; y: number }>
}

/** Потолок ячейки (px): одиночная кость не разливается на весь экран. */
const MAX_CELL_PX = 360

/**
 * Рациональное деление канвы на n костей (pure): inner-прямоугольник rect
 * (px) → сетка cols×rows квадратных ячеек (шаг по обеим осям, повёрнутый
 * ромб влезает с запасом). Кандидаты cols = 1..n, rows = ⌈n/cols⌉, ячейка
 * = min(w/cols, h/rows) с потолком opts.maxCell. Выбираем наибольшую
 * ячейку — кости занимают отведённое место целиком; при равенстве — меньше
 * пустых ячеек, затем пропорция сетки ближе к пропорции rect (широкий кадр
 * вырождается в ряд, портретный — в колонку). Слоты читаются сверху вниз,
 * последний ряд центрируется. n ≤ 0 → пустая раскладка (cell — под камеру
 * пустого стола).
 */
export const layoutSlots = (n: number, rect: LayoutRect, opts?: { maxCell?: number }): SlotPlan => {
  const w = Math.max(1, rect.w)
  const h = Math.max(1, rect.h)
  const maxCell = Math.max(1, Math.min(opts?.maxCell ?? MAX_CELL_PX, w, h))
  if (n <= 0) return { cell: maxCell, cols: 0, rows: 0, slots: [] }
  const EPS = 1e-9
  let cols = 1
  let rows = n
  let cell = maxCell
  let bestCell = -1
  let bestEmpties = 0
  let bestAspectErr = 0
  for (let c = 1; c <= n; c++) {
    const r = Math.ceil(n / c)
    const fit = Math.min(w / c, h / r)
    if (!(fit > 0)) continue
    const cellC = Math.min(fit, maxCell)
    const empties = c * r - n
    const aspectErr = Math.abs(Math.log(c / r / (w / h)))
    const better =
      bestCell < 0 ||
      cellC > bestCell + EPS ||
      (Math.abs(cellC - bestCell) <= EPS &&
        (empties < bestEmpties || (empties === bestEmpties && aspectErr < bestAspectErr - EPS)))
    if (better) {
      bestCell = cellC
      bestEmpties = empties
      bestAspectErr = aspectErr
      cols = c
      rows = r
      cell = cellC
    }
  }
  const slots: Array<{ x: number; y: number }> = []
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(cols, n - r * cols)
    for (let c = 0; c < inRow; c++) {
      slots.push({ x: (c - (inRow - 1) / 2) * cell, y: (r - (rows - 1) / 2) * cell })
    }
  }
  return { cell, cols, rows, slots }
}

/**
 * План → мировые координаты: m — мировых единиц на пиксель (шаг ячейки в
 * мире / шаг в px), center — смещение центра rect от центра канвы (px,
 * y вниз). Верх экрана = +Z (камера стола снизу вверх), поэтому экранное
 * «вниз» отдаём в −Z: первый ряд (y минимальный) получает максимальный z,
 * порядок инстансов читается сверху вниз, как в футере расшифровки.
 */
export const slotsToWorld = (
  plan: SlotPlan,
  m: number,
  center: { x: number; y: number },
): Array<{ x: number; z: number }> =>
  plan.slots.map((s) => ({ x: (s.x + center.x) * m, z: -(s.y + center.y) * m }))

export interface LayoutMetrics {
  /** Известный размер канвы в px (уже с Math.max(1, …) у вызывающего). */
  canvasW: number
  canvasH: number
  /** Отступы шапки/футера внутри канвы в px (футер меряется с заглушкой). */
  top: number
  bottom: number
  /** Число костей пачки и размер самой крупной (мировые единицы). */
  count: number
  biggest: number
}

export interface LayoutPlan {
  /** Мировые координаты слотов (как у instances: индекс = индексу пачки). */
  slots: Array<{ x: number; z: number }>
  /** table.setFit: при fit = размер·m/2.5 frameCamera даёт ровно 1 px ↔ m ед. */
  fitW: number
  fitH: number
  /** Полуэкстенты «стола» броска: канва минус врезка, но не ближе крайнего слота. */
  physBounds: { hx: number; hz: number }
}

export const computeLayout = ({
  canvasW,
  canvasH,
  top,
  bottom,
  count,
  biggest,
}: LayoutMetrics): LayoutPlan => {
  const rect = { w: canvasW, h: Math.max(1, canvasH - top - bottom) }
  const gap = Math.max(24, biggest * 1.55)
  const plan = layoutSlots(count, rect)
  const m = gap / plan.cell
  const slots = slotsToWorld(plan, m, { x: 0, y: top + rect.h / 2 - canvasH / 2 })
  // Врезка под кромку, но не больше ячейки (иначе борт упирается в лежащую
  // у кости кость).
  const inset = Math.min(8, plan.cell * 0.15)
  // Борт отстоит от крайнего слота не меньше чем на полупоперечник кости
  // (иначе спавн/каток у стены клинит — «покой в воздухе» и слабая
  // раскрутка от выдавливания солвером). pad — по самой крупной кости пачки.
  const pad = biggest + 3
  const maxSlotX = slots.reduce((a, s) => Math.max(a, Math.abs(s.x)), 0)
  const maxSlotZ = slots.reduce((a, s) => Math.max(a, Math.abs(s.z)), 0)
  return {
    slots,
    fitW: (canvasW * m) / 2.5,
    fitH: (canvasH * m) / 2.5,
    physBounds: {
      hx: Math.max(1, (rect.w / 2 - inset) * m, maxSlotX + pad),
      hz: Math.max(1, (rect.h / 2 - inset) * m, maxSlotZ + pad),
    },
  }
}
