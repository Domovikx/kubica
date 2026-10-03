// Chi-square честности маппинга ориентация→значение (PLAN.md 1.6).
// N равномерных случайных кватернионов → topFace/topVertex → равномерность по граням.
// Это тест МАППИНГА (каждая ориентация равновероятна → каждая грань равновероятна),
// а не аудит RNG: честность броска — от crypto.getRandomValues на импульсе (physics.ts).
// RNG сидирован (mulberry32): тест детерминирован, флаков alpha-уровня нет;
// равномерность выборки от сида не зависит.
import { describe, expect, it } from 'vitest'
import { faceCount, type DieId } from '@/entities/dice-geometry/geometry'
import { topFaceIndex, topVertexIndex, type Quat } from './readout'

const mulberry32 = (seed: number): (() => number) => {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(0xc10c)

const randn = (): number => {
  let u = 0
  let v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

const randomQuat = (): Quat => {
  const q: Quat = [randn(), randn(), randn(), randn()]
  const l = Math.hypot(q[0], q[1], q[2], q[3])
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}

// Критические значения chi-square, alpha=0.01 (df → χ²)
const CRITICAL_001: Record<number, number> = {
  3: 11.34,
  5: 15.09,
  7: 18.48,
  9: 21.67,
  11: 24.72,
  19: 36.19,
}

const N = 4000
const DICE: DieId[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']

describe('fairness: равномерность граней при случайных ориентациях', () => {
  for (const die of DICE) {
    it(`${die} проходит chi-square (alpha=0.01, N=${N})`, () => {
      const n = faceCount(die)
      const counts = new Array<number>(n).fill(0)
      for (let i = 0; i < N; i++) {
        const q = randomQuat()
        counts[die === 'd4' ? topVertexIndex(q) : topFaceIndex(die, q)]++
      }
      const expected = N / n
      let chi2 = 0
      for (const c of counts) chi2 += ((c - expected) * (c - expected)) / expected
      expect(chi2).toBeLessThan(CRITICAL_001[n - 1])
    })
  }
})
