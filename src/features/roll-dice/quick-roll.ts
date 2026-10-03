// Быстрый бросок без привязки к панели: общий ленивый физмир + очередь
// (броски исполняются последовательно, тела не пересекаются).
// Используют и тап по панели, и реролл из истории.
import type { DieId } from '@/entities/dice-geometry/geometry'
import { getHistoryStore } from '@/entities/roll-history/history'
import { showResult } from '@/shared/ui/result-pop'
import { createPhysicsWorld, type PhysicsWorld, type StepCallback } from './physics'
import { createRollStore, type RollResult } from './roll-store'
import { playThock, stopRattle } from './sound'

let worldHex: Promise<PhysicsWorld> | null = null
let worldRect: Promise<PhysicsWorld> | null = null
let queue: Promise<unknown> = Promise.resolve()

const getWorld = (rect: boolean): Promise<PhysicsWorld> => {
  if (rect) {
    if (!worldRect) worldRect = createPhysicsWorld({ bounds: 'rect' })
    return worldRect
  }
  if (!worldHex) worldHex = createPhysicsWorld()
  return worldHex
}

/** Продвинуть висящие броски. Вызывает rAF-цикл приложения каждый кадр. */
export const tickRolls = (): void => {
  if (worldHex) {
    void worldHex.then((world) => world.tick())
  }
  if (worldRect) {
    void worldRect.then((world) => world.tick())
  }
}

/**
 * Сила релиза фиджета (pure): floor 1.0 — любой отпуск = полный бросок
 * (gentle-drop для подгадывания грани закрыт); заряд +0..0.5, флик +0..0.4;
 * кап 1.6. Честность — от хаоса кувырка, сила трогает только начальные условия.
 */
export const releasePower = (charge: number, flickSpeed: number): number => {
  const c = Math.max(0, Math.min(1, charge))
  const f = Math.max(0, Math.min(0.4, flickSpeed * 0.1))
  return Math.min(1.6, 1.0 + 0.5 * c + f)
}

export const quickRoll = (
  die: DieId,
  opts?: {
    silent?: boolean
    power?: number
    onStep?: StepCallback
    onCollide?: (intensity: number) => void
    spawnPos?: [number, number, number]
    spawnQuat?: [number, number, number, number]
    fling?: { x: number; z: number }
    area?: number
    /** Прямоугольные границы стекла (отдельный мир) + вертикальный подброс. */
    rect?: boolean
    launchUp?: number
    /**
     * Пересчёт значения для истории/попа без смены физики: стекло показывает
     * низ (а д4 — верхнюю-на-экране вершину), а тело то же самое.
     */
    mapHistory?: (r: RollResult) => { value: number; display: string }
  },
): Promise<RollResult> => {
  const silent = opts?.silent ?? false
  const power = opts?.power ?? 1
  const rect = opts?.rect ?? false
  const run = async (): Promise<RollResult> => {
    const store = createRollStore({
      roll: async (d) =>
        (await getWorld(rect)).roll(d, {
          power,
          onStep: opts?.onStep,
          onCollide: opts?.onCollide,
          area: opts?.area,
          fling: opts?.fling,
          launchUp: opts?.launchUp,
          spawn: opts?.spawnPos ? { pos: opts.spawnPos, quat: opts.spawnQuat } : undefined,
        }),
    })
    // Без таймерного рокота: в полёте тишина (только живые удары через
    // onCollide, если переданы), финальный тук — в момент settle
    try {
      const result = await store.roll(die)
      // История пишется всегда; поп и звук — только для бросков без витрины
      // (тап с витриной показывает их в момент settle — см. viewer-grid)
      const mapped = opts?.mapHistory?.(result)
      getHistoryStore().add(
        mapped ? { ...result, value: mapped.value, display: mapped.display } : result,
      )
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
