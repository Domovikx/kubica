import { describe, expect, it } from 'vitest'
import {
  faceNormals,
  faceValue,
  normalizedVerts,
  toModelFrame,
  vertexValue,
  type DieId,
} from '@/entities/dice-geometry/geometry'
import { displayValue, readRoll, topFaceIndex, topVertexIndex, type Quat } from './readout'

const IDENTITY: Quat = [0, 0, 0, 1]

// Тестовая сторона — тоже кадр модели (как глаз и физика): сравниваем readout
// с MODEL-нормалями, иначе тест проверяет CAD-враки вместо истины.
const modelNormals = (die: DieId): Array<[number, number, number]> =>
  faceNormals(die).map((n) => toModelFrame(die, n))
const modelVerts = (): Array<[number, number, number]> =>
  normalizedVerts('d4').map((v) => toModelFrame('d4', v))

const maxYNormals = (die: DieId): number => {
  const normals = modelNormals(die)
  let best = 0
  let bestY = -Infinity
  normals.forEach((n, fi) => {
    if (n[1] > bestY) {
      bestY = n[1]
      best = fi
    }
  })
  return best
}

describe('readout: верхняя грань/вершина', () => {
  it('identity даёт грань с максимальной Y-нормалью', () => {
    for (const die of ['d6', 'd8', 'd10', 'd12', 'd20'] as DieId[]) {
      expect(topFaceIndex(die, IDENTITY)).toBe(maxYNormals(die))
    }
  })

  it('каждую грань можно выставить наверх — читается её значение', () => {
    // Кватернион, переводящий нормаль грани точно в +Y (axis-angle)
    const quatToUp = (n: [number, number, number]): Quat => {
      const up: [number, number, number] = [0, 1, 0]
      const d = Math.max(-1, Math.min(1, n[0] * up[0] + n[1] * up[1] + n[2] * up[2]))
      if (d > 1 - 1e-9) return [0, 0, 0, 1]
      const axis: [number, number, number] =
        d < -1 + 1e-9
          ? [1, 0, 0] // антипод: любая перпендикулярная ось
          : [n[1] * up[2] - n[2] * up[1], n[2] * up[0] - n[0] * up[2], n[0] * up[1] - n[1] * up[0]]
      const l = Math.hypot(axis[0], axis[1], axis[2])
      const half = Math.acos(d) / 2
      const s = Math.sin(half) / l
      return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)]
    }
    for (const die of ['d6', 'd8', 'd12', 'd20'] as DieId[]) {
      const normals = modelNormals(die)
      const seen = new Set<number>()
      normals.forEach((n, fi) => {
        expect(topFaceIndex(die, quatToUp(n))).toBe(fi)
        seen.add(faceValue(die, fi))
      })
      // Все значения 1..N достижимы
      expect([...seen].sort((a, b) => a - b)).toEqual(
        Array.from({ length: normals.length }, (_, i) => i + 1),
      )
    }
  })

  it('readRoll возвращает значения в диапазоне', () => {
    expect(readRoll('d6', IDENTITY)).toBeGreaterThanOrEqual(1)
    expect(readRoll('d6', IDENTITY)).toBeLessThanOrEqual(6)
    expect(readRoll('d20', IDENTITY)).toBeGreaterThanOrEqual(1)
    expect(readRoll('d20', IDENTITY)).toBeLessThanOrEqual(20)
    expect(readRoll('d10', IDENTITY)).toBeGreaterThanOrEqual(0)
    expect(readRoll('d10', IDENTITY)).toBeLessThanOrEqual(9)
    const v4 = readRoll('d4', IDENTITY)
    expect(v4).toBeGreaterThanOrEqual(1)
    expect(v4).toBeLessThanOrEqual(4)
  })

  it('d4: верхняя вершина identity — вершина с макс. Y', () => {
    const verts = modelVerts()
    let best = 0
    let bestY = -Infinity
    verts.forEach((v, vi) => {
      if (v[1] > bestY) {
        bestY = v[1]
        best = vi
      }
    })
    expect(topVertexIndex(IDENTITY)).toBe(best)
    expect(vertexValue(best)).toBe(readRoll('d4', IDENTITY))
  })

  it('displayValue: d10 ноль читается как 10', () => {
    expect(displayValue('d10', 0)).toBe('10')
    expect(displayValue('d10', 7)).toBe('7')
    expect(displayValue('d6', 3)).toBe('3')
  })
})
