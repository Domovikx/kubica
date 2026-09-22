import { describe, expect, it } from 'vitest'
import { readRoll } from './readout'
import { createPhysicsWorld } from './physics'

const seeded = (seed: number) => {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

describe('physics (cannon-es, smoke)', () => {
  it('бросок d6 оседает и даёт значение 1..6', async () => {
    const world = await createPhysicsWorld()
    // В node нет rAF-цикла приложения — качаем мир вручную через интервал
    const pump = setInterval(() => world.tick(), 0)
    try {
      const { quat, settled, steps } = await world.roll('d6', seeded(42))
      // Кость обязана реально осесть (не fallback по таймауту) —
      // иначе тест ловит регрессии вроде сломанных коллизий со столом
      expect(settled).toBe(true)
      expect(steps).toBeLessThan(600)
      const v = readRoll('d6', quat)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
    } finally {
      clearInterval(pump)
      world.dispose()
    }
  }, 30000)
})
