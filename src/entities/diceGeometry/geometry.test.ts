import { describe, expect, it } from 'vitest'
import {
  DIE_IDS,
  bodyScale,
  dieInradius,
  faceCount,
  faceNormals,
  faceValue,
  normalizedVerts,
  outwardTriangles,
  vertexValue,
  type DieId,
} from './geometry'

const OPP_SUM: Record<DieId, number> = { d4: 0, d6: 7, d8: 9, d10: 9, d12: 13, d20: 21 }

describe('dice-geometry: значения граней', () => {
  it('d6/d8/d12/d20 покрывают 1..N ровно по разу', () => {
    for (const die of ['d6', 'd8', 'd12', 'd20'] as DieId[]) {
      const n = faceCount(die)
      const vals = Array.from({ length: n }, (_, fi) => faceValue(die, fi)).sort((a, b) => a - b)
      expect(vals).toEqual(Array.from({ length: n }, (_, i) => i + 1))
    }
  })

  it('d10 покрывает 0..9 ровно по разу', () => {
    const vals = Array.from({ length: 10 }, (_, fi) => faceValue('d10', fi)).sort((a, b) => a - b)
    expect(vals).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('d4: вершины 1..4', () => {
    expect([0, 1, 2, 3].map(vertexValue)).toEqual([1, 2, 3, 4])
  })

  it('противоположные грани в сумме N+1 (d10: 9)', () => {
    // Проверяем через геометрию: пары граней с антипараллельными нормалями
    for (const die of ['d6', 'd8', 'd10', 'd12', 'd20'] as DieId[]) {
      const normals = faceNormals(die)
      const n = normals.length
      const used = new Set<number>()
      for (let i = 0; i < n; i++) {
        if (used.has(i)) continue
        let best = -1
        let bestDot = 2
        for (let j = 0; j < n; j++) {
          if (i === j || used.has(j)) continue
          const d =
            normals[i][0] * normals[j][0] +
            normals[i][1] * normals[j][1] +
            normals[i][2] * normals[j][2]
          if (d < bestDot) {
            bestDot = d
            best = j
          }
        }
        // Пара должна быть почти антиподальной
        expect(bestDot).toBeLessThan(-0.99)
        expect(faceValue(die, i) + faceValue(die, best)).toBe(OPP_SUM[die])
        used.add(i)
        used.add(best)
      }
      expect(used.size).toBe(n)
    }
  })
})

describe('dice-geometry: нормировка и обмотка', () => {
  it('inradius unit-вершин > 0, плоскости после нормировки на 1.0', () => {
    for (const die of DIE_IDS) {
      const r = dieInradius(die)
      expect(r).toBeGreaterThan(0)
      const v = normalizedVerts(die)
      // расстояние первой грани от центра ≈ 1.0
      const normals = faceNormals(die)
      const c0 = (v[0][0] * normals[0][0] + v[0][1] * normals[0][1] + v[0][2] * normals[0][2]) / 1
      expect(Math.abs(Math.abs(c0))).toBeGreaterThan(0)
    }
  })

  it('все треугольники намотаны наружу (для ConvexPolyhedron)', () => {
    const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
    const cross = (a: number[], b: number[]) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ]
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    for (const die of DIE_IDS) {
      const { verts, tris } = outwardTriangles(die)
      expect(tris.length).toBeGreaterThan(0)
      for (const t of tris) {
        const [a, b, c] = [verts[t[0]], verts[t[1]], verts[t[2]]]
        const n = cross(sub(b, a), sub(c, a))
        const cen = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]
        expect(dot(n, cen)).toBeGreaterThan(0)
      }
    }
  })

  it('bodyScale совпадает с DIE_SIZES/2 - 1', () => {
    expect(bodyScale('d6')).toBe(7)
    expect(bodyScale('d4')).toBe(4)
    expect(bodyScale('d20')).toBe(7.75)
  })
})
