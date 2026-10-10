// Симуляция пула костей: RollExpr (2.1) + один физический мир на весь пул.
// kh/kl/dh/dl применяются внутри своего терма; d100 до 2.5 — крипто-RNG 1..100
// (физической пары d10+d% ещё нет), остальные кости — телами cannon-es.
// Суммы/сортировка — через scoreValue: у d10 грань «0» читается как 10.
import type { DieId } from '@/entities/dice-geometry/geometry'
import { normalize, type RollExpr } from '@/entities/dice-notation/notation'
import type { PoolPart } from '@/entities/roll-history/history'
import { cryptoRandom, type PhysicsWorld } from '@/shared/dice/physics'
import { displayValue, readRoll, scoreValue } from '@/shared/dice/readout'
import { playThock } from '@/shared/dice/sound'

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
        // Сортировка по scoreValue: d10 с гранью «0» (= 10) должна быть
        // старше «9», иначе kh/kl выберет неверную кость.
        const score = (i: number): number => scoreValue(entries[i].die, entries[i].value)
        const desc = entries.map((_, i) => i).sort((a, b) => score(b) - score(a))
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
  // Итог по scoreValue (d10: грань «0» = 10) — совпадает с display в частях.
  const total = flat.reduce((sum, p) => sum + (p.kept ? p.sign * scoreValue(p.die, p.value) : 0), 0)
  return {
    total,
    parts: flat.map(({ die, value, display, kept }) => ({ die, value, display, kept })),
    label: label ?? normalize(expr),
  }
}

/**
 * Драйвер поверх одного физмира. d100 — RNG 1..100 до задачи 2.5
 * (там появится физическая пара d10+d%).
 * Стук — от живых ударов каждой кости (горсть слышно), в полёте тишина.
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
    const { quat } = await world.roll(die, {
      onCollide: (i) => playThock(die, i),
    })
    const value = readRoll(die, quat)
    return { value, display: displayValue(die, value) }
  },
})
