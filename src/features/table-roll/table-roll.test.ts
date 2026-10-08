import { describe, expect, it } from 'vitest'
import type { DieId } from '@/entities/dice-geometry/geometry'
import { createPhysicsWorld, type PhysicsWorld } from '@/shared/dice/physics'
import { pumpUntilSettled } from '@/shared/dice/test-pump'
import type { Quat } from '@/shared/dice/readout'
import {
  labelTableResult,
  layoutSlots,
  rollTableDice,
  slotsToWorld,
  type TableDieResult,
} from './table-roll'

const IDENTITY: Quat = [0, 0, 0, 1]

/** Стаб-мир: отдаёт заготовленные кватернионы по порядку, дёргает колбэки. */
const stubWorld = (quats: Quat[]): PhysicsWorld => {
  let i = 0
  return {
    roll: async (_die, opts) => {
      const quat = quats[i++ % quats.length]
      opts?.onStep?.({
        pos: [0, 10, 0],
        quat,
        vel: [0, 0, 0],
        lin: 0,
        ang: 0,
      })
      opts?.onCollide?.(0.5)
      return { quat, settled: true, steps: 1 }
    },
    tick: () => {},
    dispose: () => {},
  }
}

const req = (die: DieId, key?: string) => ({
  key: key ?? `${die}#0`,
  die,
  spawnPos: [0, 10, 0] as [number, number, number],
})

describe('table-roll: пачка в одном мире', () => {
  it('порядок = порядку запросов, значения в диапазоне', async () => {
    const steps: DieId[] = []
    const results = await rollTableDice(
      stubWorld([IDENTITY]),
      [req('d4', 'd4#0'), req('d6', 'd6#0')],
      {
        onStep: (key, die) => {
          expect(typeof key).toBe('string')
          steps.push(die)
        },
      },
    )
    expect(results.map((r) => r.die)).toEqual(['d4', 'd6'])
    expect(steps).toEqual(['d4', 'd6'])
    for (const r of results) {
      expect(r.settled).toBe(true)
      expect(r.display).toBe(String(r.value))
    }
    const d6 = results.find((r) => r.die === 'd6') as TableDieResult
    expect(d6.value).toBeGreaterThanOrEqual(1)
    expect(d6.value).toBeLessThanOrEqual(6)
  })

  it('d4 читается правилом низа (верхняя-на-экране ∈ 1..4)', async () => {
    const results = await rollTableDice(stubWorld([IDENTITY]), [req('d4')], {
      screenUp: [0, 0, 1],
    })
    expect(results[0].value).toBeGreaterThanOrEqual(1)
    expect(results[0].value).toBeLessThanOrEqual(4)
  })

  it('labelTableResult: лейбл, сумма, части', () => {
    const labelled = labelTableResult([
      { key: 'd4#0', die: 'd4', value: 3, display: '3', quat: IDENTITY, settled: true, steps: 100 },
      { key: 'd6#0', die: 'd6', value: 5, display: '5', quat: IDENTITY, settled: true, steps: 120 },
    ])
    expect(labelled.label).toBe('d4+d6')
    expect(labelled.total).toBe(8)
    expect(labelled.parts).toEqual([
      { die: 'd4', value: 3, display: '3', kept: true },
      { die: 'd6', value: 5, display: '5', kept: true },
    ])
  })

  it('labelTableResult: дубли сворачиваются (2d6+d4), key сквозной', async () => {
    const results = await rollTableDice(stubWorld([IDENTITY]), [
      req('d6', 'd6#0'),
      req('d6', 'd6#1'),
      req('d4', 'd4#0'),
    ])
    expect(results.map((r) => r.key)).toEqual(['d6#0', 'd6#1', 'd4#0'])
    expect(labelTableResult(results).label).toBe('2d6+d4')
  })

  it('labelTableResult: d10 с гранью 0 в сумме считается 10 (см. scoreValue)', () => {
    const labelled = labelTableResult([
      {
        key: 'd10#0',
        die: 'd10',
        value: 0,
        display: '10',
        quat: IDENTITY,
        settled: true,
        steps: 1,
      },
      { key: 'd10#1', die: 'd10', value: 7, display: '7', quat: IDENTITY, settled: true, steps: 1 },
    ])
    expect(labelled.total).toBe(17)
    expect(labelled.label).toBe('2d10')
  })
})

describe('table-roll: энергия пачки оседает в бюджет', () => {
  const seeded = (seed: number) => {
    let s = seed >>> 0
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0
      return s / 0x100000000
    }
  }

  it('круглые кости (д10/д12/д20) с damping 0.3 оседают до лимита', async () => {
    // Репорт: д10/д12/д20 марафонили до таймаута в большой пачке.
    // Условия — как у стола: глухой фетр + хватка качения + охотный сон.
    const world = await createPhysicsWorld({
      bounds: 'rect',
      felt: { friction: 0.9, restitution: 0.05 },
      roll: { rate: 9, grab: 6 },
    })
    try {
      for (const [die, seed] of [
        ['d10', 5],
        ['d12', 6],
        ['d20', 7],
        ['d20', 17],
      ] as Array<[DieId, number]>) {
        const { quat, settled, steps } = await pumpUntilSettled(
          world,
          world.roll(die, {
            random: seeded(seed),
            spawn: { pos: [0, 10, 0] },
            power: 0.7,
            launchUp: 24,
            damping: 0.3,
            sleepLimit: 1.0,
          }),
        )
        expect(settled).toBe(true)
        expect(steps).toBeLessThan(720)
        void quat
      }
    } finally {
      world.dispose()
    }
  }, 120000)
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
