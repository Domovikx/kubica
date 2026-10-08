// Насос — единственный способ тестов крутить физмир без setInterval/таймеров.
// Фиксируем контракт: результат дожидается возврата по ходу прокачки,
// невыполнимая задача падает по бюджету шагов, а не виснет вечно.
import { describe, expect, it } from 'vitest'
import type { PhysicsWorld } from './physics'
import { pumpUntilSettled } from './test-pump'

const stubWorld = (onTick?: () => void): PhysicsWorld => ({
  roll: async () => ({ quat: [0, 0, 0, 1], settled: true, steps: 1 }),
  tick: () => onTick?.(),
  dispose: () => {},
})

describe('test-pump: синхронная прокачка мира', () => {
  it('возвращает результат задачи, разрешившейся на 3-м тике', async () => {
    let ticks = 0
    let finish: (value: number) => void = () => {}
    const task = new Promise<number>((resolve) => {
      finish = resolve
    })
    const world = stubWorld(() => {
      ticks++
      if (ticks === 3) finish(42)
    })
    const result = await pumpUntilSettled(world, task)
    expect(result).toBe(42)
    expect(ticks).toBe(3)
  })

  it('невыполнимая задача падает по бюджету шагов, а не виснет', async () => {
    const world = stubWorld()
    await expect(pumpUntilSettled(world, new Promise<never>(() => {}))).rejects.toThrow(
      'physics task did not finish within step budget',
    )
  })
})
