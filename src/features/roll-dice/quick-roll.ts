// Быстрый бросок без привязки к панели: общий ленивый физмир + очередь
// (броски исполняются последовательно, тела не пересекаются).
// Используют и тап по панели, и реролл из истории.
import type { DieId } from '@/entities/dice-geometry/geometry'
import { getHistoryStore } from '@/entities/roll-history/history'
import { showResult } from '@/shared/ui/result-pop'
import { createPhysicsWorld, type PhysicsWorld } from './physics'
import { createRollStore, type RollResult } from './roll-store'
import { playThock, startRattle, stopRattle } from './sound'

let worldPromise: Promise<PhysicsWorld> | null = null
let queue: Promise<unknown> = Promise.resolve()

const getWorld = (): Promise<PhysicsWorld> => {
  if (!worldPromise) worldPromise = createPhysicsWorld()
  return worldPromise
}

/** Продвинуть висящие броски. Вызывает rAF-цикл приложения каждый кадр. */
export const tickRolls = (): void => {
  if (worldPromise) {
    void worldPromise.then((world) => world.tick())
  }
}

export const quickRoll = (die: DieId, opts?: { silent?: boolean }): Promise<RollResult> => {
  const silent = opts?.silent ?? false
  const run = async (): Promise<RollResult> => {
    const store = createRollStore({
      roll: async (d) => (await getWorld()).roll(d),
    })
    if (!silent) startRattle()
    try {
      const result = await store.roll(die)
      // История пишется всегда; поп и звук — только для бросков без витрины
      // (тап с витриной показывает их в момент settle — см. viewer-grid)
      getHistoryStore().add(result)
      if (!silent) {
        playThock(die)
        showResult(die, result.display)
      }
      return result
    } finally {
      if (!silent) stopRattle()
    }
  }
  const task = queue.then(run, run)
  queue = task.catch((err: unknown) => {
    // Временное диагностическое логирование (убрать после отладки E2E)
    console.error('[quickRoll]', err)
    return undefined
  })
  return task
}
