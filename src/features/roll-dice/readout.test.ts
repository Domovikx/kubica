import { describe, expect, it } from 'vitest'
import {
  faceNormals,
  faceValue,
  normalizedVerts,
  toModelFrame,
  vertexValue,
  type DieId,
} from '@/entities/dice-geometry/geometry'
import { applyQuatToVec, quatMul, quatYaw } from './face-orient'
import {
  bottomFaceIndex,
  displayValue,
  readBottomRoll,
  readD4ScreenTop,
  readRoll,
  resolveD4Below,
  scoreValue,
  screenTopVertexIndex,
  screenUpWorld,
  yawDeltaToScreenTop,
  topFaceIndex,
  topVertexIndex,
  type Quat,
} from './readout'

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

  it('низ — антипод верха: bottomFaceIndex противоположен topFaceIndex', () => {
    // Кватернион, переводящий нормаль грани точно в −Y (грань на столе)
    const quatToDown = (n: [number, number, number]): Quat => {
      const down: [number, number, number] = [0, -1, 0]
      const d = Math.max(-1, Math.min(1, n[0] * down[0] + n[1] * down[1] + n[2] * down[2]))
      if (d > 1 - 1e-9) return [0, 0, 0, 1]
      const axis: [number, number, number] =
        d < -1 + 1e-9
          ? [1, 0, 0]
          : [
              n[1] * down[2] - n[2] * down[1],
              n[2] * down[0] - n[0] * down[2],
              n[0] * down[1] - n[1] * down[0],
            ]
      const l = Math.hypot(axis[0], axis[1], axis[2])
      const half = Math.acos(d) / 2
      const s = Math.sin(half) / l
      return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)]
    }
    for (const die of ['d6', 'd8', 'd12', 'd20'] as DieId[]) {
      const normals = modelNormals(die)
      const seen = new Set<number>()
      normals.forEach((n, fi) => {
        expect(bottomFaceIndex(die, quatToDown(n))).toBe(fi)
        seen.add(readBottomRoll(die, quatToDown(n)))
      })
      expect([...seen].sort((a, b) => a - b)).toEqual(
        Array.from({ length: normals.length }, (_, i) => i + 1),
      )
    }
  })

  it('d4: низ равен верху (нижняя грань ↔ верхняя вершина — одна цифра)', () => {
    // Детерминированный перебор поворотов: низ всегда совпадает с верхом
    const quats: Quat[] = [
      [0, 0, 0, 1],
      [0.5, 0.5, 0.5, 0.5],
      [1, 0, 0, 0],
      [0, 0.7071, 0, 0.7071],
      [0.3, -0.4, 0.5, 0.7071],
    ]
    for (const q of quats) {
      const l = Math.hypot(q[0], q[1], q[2], q[3])
      const qn: Quat = [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
      expect(readBottomRoll('d4', qn)).toBe(readRoll('d4', qn))
    }
  })

  it('д4 снизу: верхняя-на-экране вершина нижней грани (не верхняя вершина)', () => {
    // Грань 0 ровно вниз (независимый axis-angle хелпер, не код библиотеки)
    const n = modelNormals('d4')[0]
    const down: [number, number, number] = [0, -1, 0]
    const d = Math.max(-1, Math.min(1, n[0] * down[0] + n[1] * down[1] + n[2] * down[2]))
    const axis: [number, number, number] = [
      n[1] * down[2] - n[2] * down[1],
      n[2] * down[0] - n[0] * down[2],
      n[0] * down[1] - n[1] * down[0],
    ]
    const l = Math.hypot(axis[0], axis[1], axis[2])
    const half = Math.acos(d) / 2
    const s = Math.sin(half) / l
    const qFlat: Quat = [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)]
    const yaw = (deg: number): Quat => {
      const halfY = (deg * Math.PI) / 180 / 2
      // yaw вокруг Y после укладки: q = yaw * qFlat
      const [x, y, z, w] = qFlat
      const sy = Math.sin(halfY)
      const cy = Math.cos(halfY)
      return [x * cy + z * sy, y * cy + w * sy, z * cy - x * sy, w * cy - y * sy]
    }
    const screenUp = screenUpWorld([0, -1, 0.01])
    expect(screenUp).toEqual([0, 0, 1])
    // Доворот 0/120/240° перебирает все три нижние вершины — значения разные
    const got = [0, 120, 240].map((a) => readD4ScreenTop(yaw(a), screenUp))
    expect(new Set(got).size).toBe(3)
    for (const v of got) {
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(4)
    }
    // Хотя бы при одном довороте низ ≠ верху (правило yaw-зависимо)
    const tops = [0, 120, 240].map((a) => readRoll('d4', yaw(a)))
    expect(tops).toEqual([tops[0], tops[0], tops[0]])
    expect(got.some((v, i) => v !== tops[i])).toBe(true)
    // Вырожденный взгляд строго вниз — фолбэк +Z, без падения
    expect(screenUpWorld([0, -1, 0])).toEqual([0, 0, 1])
    expect(readD4ScreenTop(qFlat, [0, 0, 1])).toBeGreaterThanOrEqual(1)
  })

  it('д4 снизу: yaw-доворот ставит winning-вершину ровно наверх, значение то же', () => {
    const n = modelNormals('d4')[2]
    const down: [number, number, number] = [0, -1, 0]
    const d = Math.max(-1, Math.min(1, n[0] * down[0] + n[1] * down[1] + n[2] * down[2]))
    const axis: [number, number, number] = [
      n[1] * down[2] - n[2] * down[1],
      n[2] * down[0] - n[0] * down[2],
      n[0] * down[1] - n[1] * down[0],
    ]
    const l = Math.hypot(axis[0], axis[1], axis[2])
    const half = Math.acos(d) / 2
    const s = Math.sin(half) / l
    const qFlat: Quat = [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)]
    const screenUp: [number, number, number] = [0, 0, 1]
    for (const deg of [0, 37, 120, 200, 300]) {
      // yaw вокруг Y после укладки: q = yawDeg * qFlat
      const halfY = (deg * Math.PI) / 180 / 2
      const [x, y, z, w] = qFlat
      const sy = Math.sin(halfY)
      const cy = Math.cos(halfY)
      const q: Quat = [x * cy + z * sy, y * cy + w * sy, z * cy - x * sy, w * cy - y * sy]
      const before = readD4ScreenTop(q, screenUp)
      const delta = yawDeltaToScreenTop(q, screenUp)
      // Ближайшая вершина — не дальше 60°+запас
      expect(Math.abs(delta)).toBeLessThanOrEqual(Math.PI / 3 + 0.01)
      const aligned = quatMul(quatYaw(delta), q)
      // Значение сохранилось, вершина та же
      expect(readD4ScreenTop(aligned, screenUp)).toBe(before)
      // Азимут winning-вершины после доворота = азимут верха экрана
      // (независимый путь: modelVerts уже в кадре модели + applyQuatToVec)
      const vi = screenTopVertexIndex('d4', aligned, screenUp)
      const mv = modelVerts()[vi]
      const wv = applyQuatToVec(mv, aligned)
      expect(Math.atan2(wv[0], wv[2])).toBeCloseTo(Math.atan2(screenUp[0], screenUp[2]), 6)
    }
  })

  it('resolveD4Below: плоско — только yaw; наклон — flat той же гранью', () => {
    const screenUp: [number, number, number] = [0, 0, 1]
    const tiltAboutX = (base: Quat, deg: number): Quat => {
      const h = (deg * Math.PI) / 180 / 2
      const t: Quat = [Math.sin(h), 0, 0, Math.cos(h)]
      const [x, y, z, w] = base
      const [tx, ty, tz, tw] = t
      return [
        tw * x + tx * w + ty * z - tz * y,
        tw * y - tx * z + ty * w + tz * x,
        tw * z + tx * y - ty * x + tz * w,
        tw * w - tx * x - ty * y - tz * z,
      ]
    }
    // Плоская поза: грань 1 вниз (axis-angle из прошлого теста, свернём короче —
    // берём произвольную плоскую через bottomFaceIndex-инвариант ниже)
    const n = modelNormals('d4')[1]
    const down: [number, number, number] = [0, -1, 0]
    const d = Math.max(-1, Math.min(1, n[0] * down[0] + n[1] * down[1] + n[2] * down[2]))
    const axis: [number, number, number] = [
      n[1] * down[2] - n[2] * down[1],
      n[2] * down[0] - n[0] * down[2],
      n[0] * down[1] - n[1] * down[0],
    ]
    const l = Math.hypot(axis[0], axis[1], axis[2])
    const half = Math.acos(d) / 2
    const s = Math.sin(half) / l
    const qFlat: Quat = [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(half)]
    // Плоско: flattened=false, нижняя грань та же, значение консистентно
    const flat = resolveD4Below(qFlat, screenUp)
    expect(flat.flattened).toBe(false)
    expect(flat.value).toBe(readD4ScreenTop(flat.target, screenUp))
    // Наклон 10°: flattened=true, низ ровно внизу, грань та же
    const tilted = resolveD4Below(tiltAboutX(qFlat, 10), screenUp)
    expect(tilted.flattened).toBe(true)
    expect(bottomFaceIndex('d4', tilted.target)).toBe(bottomFaceIndex('d4', tiltAboutX(qFlat, 10)))
    const normals = modelNormals('d4')
    const downWorld = applyQuatToVec(normals[bottomFaceIndex('d4', tilted.target)], tilted.target)
    const ll = Math.hypot(downWorld[0], downWorld[1], downWorld[2])
    expect(downWorld[1] / ll).toBeLessThan(-0.999)
    expect(tilted.value).toBe(readD4ScreenTop(tilted.target, screenUp))
    // Наклон 40° (вис на стене): тоже кладём ровно — нижняя грань та же
    // (она и так самая нижняя), значение — от финала
    const steep = resolveD4Below(tiltAboutX(qFlat, 40), screenUp)
    expect(steep.flattened).toBe(true)
    expect(bottomFaceIndex('d4', steep.target)).toBe(bottomFaceIndex('d4', tiltAboutX(qFlat, 40)))
    const steepDown = applyQuatToVec(
      modelNormals('d4')[bottomFaceIndex('d4', steep.target)],
      steep.target,
    )
    const steepL = Math.hypot(steepDown[0], steepDown[1], steepDown[2])
    expect(steepDown[1] / steepL).toBeLessThan(-0.999)
    expect(steep.value).toBe(readD4ScreenTop(steep.target, screenUp))
  })

  it('displayValue: d10 ноль читается как 10', () => {
    expect(displayValue('d10', 0)).toBe('10')
    expect(displayValue('d10', 7)).toBe('7')
    expect(displayValue('d6', 3)).toBe('3')
  })

  it('scoreValue: в сумму d10 с гранью 0 идёт 10, остальные кости не меняются', () => {
    expect(scoreValue('d10', 0)).toBe(10)
    expect(scoreValue('d10', 9)).toBe(9)
    expect(scoreValue('d6', 0)).toBe(0)
    expect(scoreValue('d100', 0)).toBe(0)
    expect(scoreValue('const', 0)).toBe(0)
  })
})
