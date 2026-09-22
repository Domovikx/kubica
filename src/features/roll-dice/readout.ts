// Чтение результата по финальной ориентации (кватернион [x, y, z, w]).
// Чистая математика без three.js — тестируется моками.
import {
  faceNormals,
  faceValue,
  normalizedVerts,
  vertexValue,
  type DieId,
} from '@/entities/dice-geometry/geometry'

export type Quat = [number, number, number, number]

const rotateByQuat = (v: [number, number, number], q: Quat): [number, number, number] => {
  const [x, y, z] = v
  const [qx, qy, qz, qw] = q
  // v' = q * v * q^-1, развёрнуто для единичного кватерниона
  const ix = qw * x + qy * z - qz * y
  const iy = qw * y + qz * x - qx * z
  const iz = qw * z + qx * y - qy * x
  const iw = -qx * x - qy * y - qz * z
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ]
}

/** Индекс верхней грани (макс. проекция нормали на +Y). */
export const topFaceIndex = (die: DieId, quat: Quat): number => {
  const normals = faceNormals(die)
  let best = 0
  let bestDot = -Infinity
  normals.forEach((n, fi) => {
    const w = rotateByQuat(n, quat)
    const d = w[1]
    if (d > bestDot) {
      bestDot = d
      best = fi
    }
  })
  return best
}

/** Индекс верхней вершины (только d4 — цифры у вершин). */
export const topVertexIndex = (quat: Quat): number => {
  const verts = normalizedVerts('d4')
  let best = 0
  let bestY = -Infinity
  verts.forEach((v, vi) => {
    const w = rotateByQuat(v, quat)
    if (w[1] > bestY) {
      bestY = w[1]
      best = vi
    }
  })
  return best
}

/** Значение броска: d4 — по верхней вершине, остальные — по верхней грани. */
export const readRoll = (die: DieId, quat: Quat): number =>
  die === 'd4' ? vertexValue(topVertexIndex(quat)) : faceValue(die, topFaceIndex(die, quat))

/** Отображаемое значение: на d10 ноль читается как 10 (стандарт D&D). */
export const displayValue = (die: DieId, value: number): string =>
  die === 'd10' && value === 0 ? '10' : String(value)
