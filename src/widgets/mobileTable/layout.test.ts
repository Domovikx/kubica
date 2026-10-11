// Раскладка — чистая математика без DOM: фиксируем инварианты плана,
// чтобы переезд applyLayout (фаза D) и будущие правки не двигали камеры/
// границы молча.
import { describe, expect, it } from 'vitest'
import { computeLayout, layoutSlots, slotsToWorld, type LayoutMetrics } from './layout'

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

describe('layoutSlots: рациональное деление канвы', () => {
  it('n ≤ 0 → пусто; 1 → центр; потолок ячейки уважается', () => {
    expect(layoutSlots(0, { w: 400, h: 600 }).slots).toEqual([])
    expect(layoutSlots(1, { w: 400, h: 600 }).slots).toEqual([{ x: 0, y: 0 }])
    // Потолок 360px: одиночная кость не растекается на весь экран.
    expect(layoutSlots(1, { w: 2000, h: 2000 }).cell).toBe(360)
    expect(layoutSlots(1, { w: 1000, h: 1000 }, { maxCell: 120 }).cell).toBe(120)
  })

  it('широкий кадр → ряд, портретный → колонка, квадрат → 2×2', () => {
    const wide = layoutSlots(4, { w: 1200, h: 400 })
    expect(wide.cols).toBe(4)
    expect(wide.rows).toBe(1)
    const port = layoutSlots(4, { w: 400, h: 1200 })
    expect(port.cols).toBe(1)
    expect(port.rows).toBe(4)
    const sq = layoutSlots(4, { w: 600, h: 600 })
    expect(sq.cols).toBe(2)
    expect(sq.rows).toBe(2)
  })

  it('телефон 390×700 на 10 костей → 2 колонки, всё в ректе', () => {
    const plan = layoutSlots(10, { w: 390, h: 700 })
    expect(plan.cols).toBe(2)
    expect(plan.rows).toBe(5)
    expect(plan.cell).toBeCloseTo(140, 6)
    expect(plan.slots).toHaveLength(10)
    for (const s of plan.slots) {
      expect(Math.abs(s.x) + plan.cell / 2).toBeLessThanOrEqual(390 / 2 + 1e-9)
      expect(Math.abs(s.y) + plan.cell / 2).toBeLessThanOrEqual(700 / 2 + 1e-9)
    }
  })

  it('порядок чтения сверху вниз: y не убывает по инстансам', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 8, 10]) {
      for (const rect of [
        { w: 390, h: 700 },
        { w: 1200, h: 400 },
        { w: 800, h: 800 },
      ]) {
        const slots = layoutSlots(n, rect).slots
        for (let i = 1; i < slots.length; i++) {
          expect(slots[i].y).toBeGreaterThanOrEqual(slots[i - 1].y - 1e-9)
        }
      }
    }
  })

  it('без наложений: центры ячеек ≥ cell на любом кадре', () => {
    for (const n of [2, 3, 4, 5, 6, 8, 10]) {
      for (const rect of [
        { w: 390, h: 700 },
        { w: 1200, h: 400 },
        { w: 800, h: 800 },
        { w: 320, h: 480 },
      ]) {
        const plan = layoutSlots(n, rect)
        expect(plan.slots).toHaveLength(n)
        for (let i = 0; i < plan.slots.length; i++) {
          for (let j = i + 1; j < plan.slots.length; j++) {
            const a = plan.slots[i]
            const b = plan.slots[j]
            const dist = Math.hypot(a.x - b.x, a.y - b.y)
            expect(dist).toBeGreaterThanOrEqual(plan.cell - 1e-9)
          }
        }
      }
    }
  })

  it('вырожденный рект не даёт NaN', () => {
    const plan = layoutSlots(5, { w: 0, h: 0 })
    expect(plan.slots).toHaveLength(5)
    for (const s of plan.slots) {
      expect(Number.isFinite(s.x)).toBe(true)
      expect(Number.isFinite(s.y)).toBe(true)
    }
  })
})

describe('slotsToWorld: px → мир', () => {
  // 1000×600 на 2 кости → ряд (ячейка 360): x = ±180, y = 0.
  const row = layoutSlots(2, { w: 1000, h: 600 })

  it('y вниз экрана → −Z, x → X (верх экрана = +Z)', () => {
    expect(row.cols).toBe(2)
    const world = slotsToWorld(row, 0.1, { x: 0, y: 0 })
    expect(world).toHaveLength(2)
    expect(world[0].x).toBeCloseTo(-18)
    expect(world[1].x).toBeCloseTo(18)
    expect(world[0].z).toBeCloseTo(0)
    expect(world[1].z).toBeCloseTo(0)
  })

  it('центр ректа ниже центра канвы → сетка ниже (−Z)', () => {
    const one = layoutSlots(1, { w: 400, h: 400 })
    const [s] = slotsToWorld(one, 0.5, { x: 0, y: 40 })
    expect(s.x).toBeCloseTo(0)
    expect(s.z).toBeCloseTo(-20)
  })

  it('порядок инстансов в мире: z монотонно не возрастает', () => {
    const plan = layoutSlots(10, { w: 390, h: 700 })
    const world = slotsToWorld(plan, 0.2, { x: 0, y: 10 })
    expect(world).toHaveLength(10)
    for (let i = 1; i < world.length; i++) {
      expect(world[i].z).toBeLessThanOrEqual(world[i - 1].z + 1e-9)
    }
  })
})
