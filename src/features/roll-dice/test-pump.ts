// Синхронный насос физмира для тестов: крутит синтетическое время,
// пока задача не разрешится. Без setInterval — быстро (миллисекунды),
// детерминировано и не голодает в воркере vitest.
import type { PhysicsWorld } from './physics'

export const pumpUntilSettled = async <T>(world: PhysicsWorld, task: Promise<T>): Promise<T> => {
  let result: T | undefined
  let done = false
  void task.then((v) => {
    result = v
    done = true
  })
  let simNow = 0
  for (let i = 0; i < 3000 && !done; i++) {
    world.tick((simNow += 1000 / 60))
    await Promise.resolve()
  }
  if (!done) throw new Error('physics task did not finish within step budget')
  return result as T
}
