// Раскладка — чистая математика без DOM: фиксируем инварианты плана,
// чтобы переезд applyLayout (фаза D) и будущие правки не двигали камеры/
// границы молча.
import { describe, expect, it } from 'vitest'
import { computeLayout, type LayoutMetrics } from './layout'

const BASE: LayoutMetrics = {
  canvasW: 800,
  canvasH: 600,
  top: 60,
  bottom: 40,
  count: 4,
  biggest: 2,
}

describe('layout: план пачки на канве', () => {
  it('детерминирован: одинаковый вход → одинаковый план', () => {
    expect(computeLayout(BASE)).toEqual(computeLayout(BASE))
  })

  it('слоты: ровно count конечных позиций, пустая пачка — пусто', () => {
    const plan = computeLayout(BASE)
    expect(plan.slots).toHaveLength(BASE.count)
    for (const s of plan.slots) {
      expect(Number.isFinite(s.x)).toBe(true)
      expect(Number.isFinite(s.z)).toBe(true)
    }
    const empty = computeLayout({ ...BASE, count: 0 })
    expect(empty.slots).toEqual([])
    expect(empty.physBounds.hx).toBeGreaterThanOrEqual(1)
    expect(empty.physBounds.hz).toBeGreaterThanOrEqual(1)
  })

  it('границы физики держат крайний слот + полупоперечник кости', () => {
    const { slots, physBounds } = computeLayout(BASE)
    const pad = BASE.biggest + 3
    const maxSlotX = Math.max(...slots.map((s) => Math.abs(s.x)))
    const maxSlotZ = Math.max(...slots.map((s) => Math.abs(s.z)))
    expect(physBounds.hx).toBeGreaterThanOrEqual(maxSlotX + pad)
    expect(physBounds.hz).toBeGreaterThanOrEqual(maxSlotZ + pad)
  })

  it('fit живёт в одном масштабе по обеим осям (fit/canvas = m/2.5)', () => {
    const { fitW, fitH } = computeLayout(BASE)
    expect(fitW / BASE.canvasW).toBeCloseTo(fitH / BASE.canvasH, 12)
  })

  it('отступ шапки сдвигает центр сетки вниз (экран вниз → −Z мира)', () => {
    const meanZ = (m: LayoutMetrics): number => {
      const { slots } = computeLayout(m)
      return slots.reduce((a, s) => a + s.z, 0) / Math.max(1, slots.length)
    }
    // Больше отступ сверху → центр ниже → средний z меньше (ближе к −Z).
    expect(meanZ({ ...BASE, top: 120, bottom: 0 })).toBeLessThan(
      meanZ({ ...BASE, top: 0, bottom: 120 }),
    )
  })
})
