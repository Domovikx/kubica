import { describe, expect, it } from 'vitest'
import {
  digitUp,
  faceNormals,
  faceValue,
  faceVertIndices,
  normalizedVerts,
  type DieId,
  type Vec3,
} from '@/entities/dice-geometry/geometry'
import {
  applyQuatToVec,
  faceIndexForValue,
  quatForD4VertexUp,
  quatForValueUp,
  toModelFrame,
} from './face-orient'

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (v: Vec3): number => Math.hypot(v[0], v[1], v[2])

const screenUpOf = (v: Vec3, dir: Vec3): Vec3 => {
  const d = dot(v, dir)
  return [v[0] - dir[0] * d, v[1] - dir[1] * d, v[2] - dir[2] * d]
}

describe('face-orient: грань плашмя вверх + цифра от зрителя', () => {
  const cam: Vec3 = [0.58, 0.36, 0.73]
  const up: Vec3 = [0, 1, 0]
  // Горизонталь «от зрителя»: туда должен смотреть верх цифры
  const chL = Math.hypot(cam[0], cam[2])
  const away: Vec3 = [-cam[0] / chL, 0, -cam[2] / chL]

  for (const die of ['d6', 'd8', 'd10', 'd12', 'd20'] as const) {
    it(`${die}: каждая грань — строго вверх, верх цифры — от зрителя`, () => {
      const normals = faceNormals(die)
      normals.forEach((_, fi) => {
        const value = faceValue(die, fi)
        const q = quatForValueUp(die, value, cam)
        // Грань точно вверх (в кадре модели)
        const n = toModelFrame(die, normals[faceIndexForValue(die, value)])
        const w = applyQuatToVec(n, q)
        expect(w[1] / norm(w)).toBeGreaterThan(0.999)
        // Верх цифры — горизонтально от зрителя (включая верхние/нижние грани)
        const upDigit = applyQuatToVec(toModelFrame(die, digitUp(die, fi)), q)
        expect(Math.abs(upDigit[1])).toBeLessThan(0.01)
        expect(dot(upDigit, away) / norm(upDigit)).toBeGreaterThan(0.999)
      })
    })
  }

  it('d4: вершина строго вверх, цифра — вверх экрана', () => {
    const dir: Vec3 = [cam[0] / norm(cam), cam[1] / norm(cam), cam[2] / norm(cam)]
    const faces = faceVertIndices('d4')
    for (let value = 1; value <= 4; value++) {
      const q = quatForD4VertexUp(value, cam)
      const verts = normalizedVerts('d4')
      const w = applyQuatToVec(toModelFrame('d4', verts[value - 1]), q)
      expect(w[1] / norm(w)).toBeGreaterThan(0.999)
      // Верх цифры (к вершине) — вверх экрана
      const fj = faces.findIndex((f) => f.includes(value - 1))
      const c = vdCentroid(value - 1, fj)
      const bv = vdUp(value - 1, c)
      const upDigit = applyQuatToVec(toModelFrame('d4', bv), q)
      const pDigit = screenUpOf(upDigit, dir)
      const pUp = screenUpOf(up, dir)
      expect(dot(pDigit, pUp) / (norm(pDigit) * norm(pUp))).toBeGreaterThan(0.999)
    }
  })

  it('faceIndexForValue бросает на мусоре', () => {
    expect(() => faceIndexForValue('d6' as DieId, 99)).toThrowError(RangeError)
    expect(() => quatForD4VertexUp(9, cam)).toThrowError(RangeError)
  })
})

// Хелперы зеркала digits_d4: цифра у вершины vi на грани fj, верх — к вершине
const vdCentroid = (vi: number, fj: number): Vec3 => {
  const verts = normalizedVerts('d4')
  const faces = faceVertIndices('d4')
  const f = faces[fj]
  void vi
  const c: Vec3 = [0, 0, 0]
  for (const k of f) {
    c[0] += verts[k][0]
    c[1] += verts[k][1]
    c[2] += verts[k][2]
  }
  return [c[0] / f.length, c[1] / f.length, c[2] / f.length]
}

const vdUp = (vi: number, c: Vec3): Vec3 => {
  const verts = normalizedVerts('d4')
  return [verts[vi][0] - c[0], verts[vi][1] - c[1], verts[vi][2] - c[2]]
}

describe('face-orient: калибровка кадра GLB (репорт пользователя, d20)', () => {
  // Пары «запрошено → реально было показано» до фикса; toModelFrame обязана
  // переводить normal(seen) в normal(req) — иначе фикс сломан.
  const pairs: Array<[req: number, seen: number]> = [
    [1, 11],
    [20, 10],
    [4, 1],
    [17, 20],
    [6, 17],
    [15, 4],
    [10, 6],
    [11, 15],
  ]

  for (const [req, seen] of pairs) {
    it(`toModelFrame: seen ${seen} → req ${req}`, () => {
      const normals = faceNormals('d20')
      const from = normals[faceIndexForValue('d20', seen)]
      const to = normals[faceIndexForValue('d20', req)]
      const got = toModelFrame('d20', from)
      const l = norm(got)
      const t = norm(to)
      expect(dot(got, to) / (l * t)).toBeGreaterThan(0.9999)
    })
  }
})

describe('face-orient: калибровка кадра GLB (репорт пользователя, d4)', () => {
  // Связь кадров: M2·v_req = M·v_seen (M — общий фикс, M2 — кадр d4).
  // Пары «запрошено → показано» (значения, вершина = value-1).
  // 4→1 — прогноз решённого поворота (180° о рёберной оси), ждёт визуального
  // подтверждения; остальные три — наблюдённые.
  const pairs: Array<[req: number, seen: number]> = [
    [1, 4],
    [2, 3],
    [3, 2],
    [4, 1],
  ]

  for (const [req, seen] of pairs) {
    it(`кадр d4: M2·v${req - 1} = M·v${seen - 1}`, () => {
      const verts = normalizedVerts('d4')
      const got = toModelFrame('d4', verts[req - 1])
      const want = toModelFrame('d20', verts[seen - 1])
      const l = norm(got)
      const t = norm(want)
      expect(dot(got, want) / (l * t)).toBeGreaterThan(0.9999)
    })
  }
})
