// Симуляция пула костей: RollExpr (2.1) + один физический мир на весь пул.
// kh/kl/dh/dl применяются внутри своего терма; d100 до 2.5 — крипто-RNG 1..100
// (физической пары d10+d% ещё нет), остальные кости — телами cannon-es.
import type { DieId } from '@/entities/dice-geometry/geometry'
import { normalize, type RollExpr } from '@/entities/dice-notation/notation'
import { getHistoryStore, type PoolPart } from '@/entities/roll-history/history'
import { createPhysicsWorld, cryptoRandom, type PhysicsWorld } from '@/features/roll-dice/physics'
import { displayValue, readRoll } from '@/features/roll-dice/readout'
import { playThock, startRattle, stopRattle } from '@/features/roll-dice/sound'
import { showResult } from '@/shared/ui/result-pop'

export type { PoolPart }

export interface PoolResult {
  total: number
  parts: PoolPart[]
  label: string
}

export interface PoolDieRoll {
  value: number
  display: string
}

export interface PoolDriver {
  rollDie: (sides: number) => Promise<PoolDieRoll>
}

interface BuiltPart extends PoolPart {
  sign: 1 | -1
}

/**
 * Разыграть выражение драйвером (порядок частей = порядку термов;
 * Promise.all сохраняет порядок, конкурентные тела живут в одном мире).
 */
export const simulatePool = async (
  expr: RollExpr,
  driver: PoolDriver,
  label?: string,
): Promise<PoolResult> => {
  const perTerm: BuiltPart[][] = await Promise.all(
    expr.terms.map(async (st): Promise<BuiltPart[]> => {
      if (st.term.kind === 'const') {
        return [
          {
            die: 'const',
            value: st.term.value,
            display: String(st.term.value),
            kept: true,
            sign: st.sign,
          },
        ]
      }
      const { count, sides, op, opN } = st.term
      const rolls = await Promise.all(Array.from({ length: count }, () => driver.rollDie(sides)))
      const entries: BuiltPart[] = rolls.map((r) => ({
        die: `d${sides}`,
        value: r.value,
        display: r.display,
        kept: true,
        sign: st.sign,
      }))
      if (op !== null && opN > 0 && opN < count) {
        const desc = entries.map((_, i) => i).sort((a, b) => entries[b].value - entries[a].value)
        const keptIdx =
          op === 'kh'
            ? desc.slice(0, opN)
            : op === 'kl'
              ? desc.slice(-opN)
              : op === 'dh'
                ? desc.slice(opN)
                : desc.slice(0, desc.length - opN)
        const kept = new Set(keptIdx)
        entries.forEach((e, i) => {
          e.kept = kept.has(i)
        })
      }
      return entries
    }),
  )
  const flat = perTerm.flat()
  const total = flat.reduce((sum, p) => sum + (p.kept ? p.sign * p.value : 0), 0)
  return {
    total,
    parts: flat.map(({ die, value, display, kept }) => ({ die, value, display, kept })),
    label: label ?? normalize(expr),
  }
}

/**
 * Драйвер поверх одного физмира. d100 — RNG 1..100 до задачи 2.5
 * (там появится физическая пара d10+d%).
 */
export const createWorldDriver = (
  world: PhysicsWorld,
  random: () => number = cryptoRandom,
): PoolDriver => ({
  rollDie: async (sides) => {
    if (sides === 100) {
      const value = 1 + Math.floor(random() * 100)
      return { value, display: String(value) }
    }
    const die = `d${sides}` as DieId
    const { quat } = await world.roll(die)
    const value = readRoll(die, quat)
    return { value, display: displayValue(die, value) }
  },
})

let poolWorld: Promise<PhysicsWorld> | null = null
let poolQueue: Promise<unknown> = Promise.resolve()

const getPoolWorld = (): Promise<PhysicsWorld> => {
  if (!poolWorld) poolWorld = createPhysicsWorld()
  return poolWorld
}

/** Продвинуть висящие броски пула. Вызывает rAF-цикл приложения каждый кадр. */
export const tickPoolWorld = (): void => {
  if (poolWorld) {
    void poolWorld.then((world) => world.tick())
  }
}

/** Бросок пула: общий ленивый физмир + очередь (как quickRoll для одиночных). */
export const rollPool = (expr: RollExpr, label?: string): Promise<PoolResult> => {
  const run = async (): Promise<PoolResult> => {
    const world = await getPoolWorld()
    startRattle()
    try {
      const result = await simulatePool(expr, createWorldDriver(world), label)
      const firstDie = expr.terms.find((t) => t.term.kind === 'dice')
      const entryDie =
        firstDie?.term.kind === 'dice' && firstDie.term.sides !== 100
          ? (`d${firstDie.term.sides}` as DieId)
          : ('d10' as DieId) // прокси для d100-пулов и констант до richer-истории
      playThock(entryDie)
      getHistoryStore().add({
        die: entryDie,
        value: result.total,
        display: String(result.total),
        at: Date.now(),
        label: result.label,
        parts: result.parts,
      })
      showResult(result.label, String(result.total), undefined, result.parts)
      return result
    } finally {
      stopRattle()
    }
  }
  const task = poolQueue.then(run, run)
  poolQueue = task.catch((err: unknown) => {
    console.error('[rollPool]', err)
    return undefined
  })
  return task
}
