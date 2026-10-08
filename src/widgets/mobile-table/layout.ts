// Чистая раскладка пачки на канве: DOM-измерения (размер канвы, отступы
// шапки/футера) делает вызывающий, тут — план: слоты, масштаб камеры и
// границы физики. Масштаб m (ед./px) = шаг ячейки в мире / шаг в px: сетка,
// камера и границы физики живут в одном масштабе — кость занимает свою
// ячейку одинаково на любом экране, а одиночная кость не растекается
// (потолок ячейки).
import { layoutSlots, slotsToWorld } from '@/features/table-roll/table-roll'

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
