import { describe, expect, it } from 'vitest'
import { parseNotation } from '@/entities/dice-notation/notation'
import { formatParts } from '@/entities/roll-history/history'
import { createWorldDriver, simulatePool, type PoolDriver } from './pool'
import { createPhysicsWorld, type PhysicsWorld } from '@/features/roll-dice/physics'
import { pumpUntilSettled } from '@/features/roll-dice/test-pump'

/** Детерминированный драйвер: значения выдаются по очереди вызовов. */
const stubDriver = (values: number[]): PoolDriver => {
  let i = 0
  return {
    rollDie: async () => {
      const value = values[i++ % values.length]
      return { value, display: String(value) }
    },
  }
}

describe('pool: keep/drop и сумма', () => {
  it('2d20kh1 оставляет максимум', async () => {
    const result = await simulatePool(parseNotation('2d20kh1'), stubDriver([3, 17]))
    expect(result.total).toBe(17)
    expect(result.parts).toHaveLength(2)
    expect(result.parts.map((p) => p.kept)).toEqual([false, true])
    expect(result.label).toBe('2d20kh1')
  })

  it('приёмка 2.3: advantage [7, 19] → поп «19 [(7) 19]», 7 сброшена', async () => {
    const result = await simulatePool(parseNotation('2d20kh1'), stubDriver([7, 19]))
    expect(result.total).toBe(19)
    expect(result.parts.map((p) => [p.display, p.kept])).toEqual([
      ['7', false],
      ['19', true],
    ])
    // Текстовая строка попа: сумма + разбивка (визуально 7 приглушена классом)
    expect(`${result.total} [${formatParts(result.parts).join(' ')}]`).toBe('19 [(7) 19]')
  })

  it('4d6dl1 суммирует без минимума', async () => {
    const result = await simulatePool(parseNotation('4d6dl1'), stubDriver([4, 1, 6, 3]))
    expect(result.total).toBe(13)
    expect(result.parts.map((p) => p.kept)).toEqual([true, false, true, true])
  })

  it('3d6kl1 оставляет минимум, 3d6dh1 сбрасывает максимум', async () => {
    const kl = await simulatePool(parseNotation('3d6kl1'), stubDriver([5, 2, 6]))
    expect(kl.total).toBe(2)
    const dh = await simulatePool(parseNotation('3d6dh1'), stubDriver([5, 2, 6]))
    expect(dh.total).toBe(7)
  })

  it('модификаторы и знаки: 2d6-1d4+3', async () => {
    const result = await simulatePool(parseNotation('2d6-1d4+3'), stubDriver([2, 4, 2]))
    // (2+4) - 2 + 3 = 7; частей: 2 кости + 1 кость + константа
    expect(result.total).toBe(7)
    expect(result.parts).toHaveLength(4)
  })

  it('канонический label по умолчанию', async () => {
    const result = await simulatePool(parseNotation('2D20 KH1 + 5'), stubDriver([10, 4]))
    expect(result.label).toBe('2d20kh1+5')
    expect(result.total).toBe(15)
  })
})

describe('pool: d100 через RNG (до 2.5)', () => {
  const fakeWorld = {
    roll: async () => {
      throw new Error('physics must not be used for d100')
    },
    tick: () => undefined,
    dispose: () => undefined,
  } as unknown as PhysicsWorld

  it('границы 1 и 100 достижимы', async () => {
    const lo = await simulatePool(
      parseNotation('d100'),
      createWorldDriver(fakeWorld, () => 0),
    )
    expect(lo.total).toBe(1)
    const hi = await simulatePool(
      parseNotation('d100'),
      createWorldDriver(fakeWorld, () => 0.999999),
    )
    expect(hi.total).toBe(100)
  })

  it('середина диапазона', async () => {
    const mid = await simulatePool(
      parseNotation('d100'),
      createWorldDriver(fakeWorld, () => 0.5),
    )
    expect(mid.total).toBe(51)
    expect(mid.parts[0].die).toBe('d100')
  })
})

describe('pool: живой физмир (интеграция, приёмка 2.2)', () => {
  it('Fireball 8d6: 8 значений, сумма сходится', async () => {
    const world = await createPhysicsWorld()
    // В node нет rAF-цикла приложения — качаем мир синхронно (быстро, без таймеров)
    try {
      const result = await pumpUntilSettled(
        world,
        simulatePool(parseNotation('8d6'), createWorldDriver(world), '8d6'),
      )
      expect(result.parts).toHaveLength(8)
      expect(result.parts.every((p) => p.kept)).toBe(true)
      for (const p of result.parts) {
        expect(p.value).toBeGreaterThanOrEqual(1)
        expect(p.value).toBeLessThanOrEqual(6)
      }
      expect(result.total).toBe(result.parts.reduce((s, p) => s + p.value, 0))
    } finally {
      world.dispose()
    }
  }, 60000)
})
