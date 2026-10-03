import { describe, expect, it } from 'vitest'
import type { DieId } from '@/entities/dice-geometry/geometry'
import { createPhysicsWorld, type PhysicsWorld } from '@/features/roll-dice/physics'
import { pumpUntilSettled } from '@/features/roll-dice/test-pump'
import type { Quat } from '@/features/roll-dice/readout'
import { labelTableResult, layoutSlots, rollTableDice, type TableDieResult } from './table-roll'

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

describe('layoutSlots: раскладка по центру', () => {
  it('1 → центр, 2 → пара по X с отступом', () => {
    expect(layoutSlots(1)).toEqual([{ x: 0, z: 0 }])
    expect(layoutSlots(2)).toEqual([
      { x: -11, z: 0 },
      { x: 11, z: 0 },
    ])
  })

  it('кастомный шаг раздвигает слоты пропорционально', () => {
    expect(layoutSlots(2, 30)).toEqual([
      { x: -15, z: 0 },
      { x: 15, z: 0 },
    ])
  })

  it('3 → треугольник, 4+ → сетка без наложений (dist ≥ gap)', () => {
    expect(layoutSlots(3)).toHaveLength(3)
    for (const n of [4, 5, 6]) {
      const slots = layoutSlots(n)
      expect(slots).toHaveLength(n)
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const dist = Math.hypot(slots[i].x - slots[j].x, slots[i].z - slots[j].z)
          expect(dist).toBeGreaterThanOrEqual(22 - 1e-9)
        }
      }
    }
  })

  it('aspect: широкий кадр — 4 в ряд, портрет — 2×2', () => {
    const wide = layoutSlots(4, 22, { aspect: 16 / 9 })
    expect(wide.map((s) => s.z)).toEqual([0, 0, 0, 0])
    const port = layoutSlots(4, 22, { aspect: 9 / 16 })
    expect(new Set(port.map((s) => s.z)).size).toBe(2)
    expect(new Set(port.map((s) => s.x)).size).toBe(2)
  })

  it('aspect: для любого кадра dist ≥ gap', () => {
    const gap = 24
    for (const aspect of [0.3, 0.5, 1, 16 / 9, 3]) {
      for (const n of [4, 5, 6, 8]) {
        const slots = layoutSlots(n, gap, { aspect })
        expect(slots).toHaveLength(n)
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            const dist = Math.hypot(slots[i].x - slots[j].x, slots[i].z - slots[j].z)
            expect(dist).toBeGreaterThanOrEqual(gap - 1e-9)
          }
        }
      }
    }
  })

  it('aspect ≤ 0 не роняет раскладку (fallback 1)', () => {
    expect(layoutSlots(4, 22, { aspect: 0 })).toHaveLength(4)
    expect(layoutSlots(4, 22, { aspect: NaN })).toHaveLength(4)
  })
})
