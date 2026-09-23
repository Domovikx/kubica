// Ориентация результата гранью в камеру (чистая математика, без three.js).
// Практика 3D-дайсов: физ-бросок даёт значение, витрина дотягивает модель
// так, чтобы нужная грань смотрела прямо в камеру, а цифра была строго
// вертикально, затем slerp (ср. three.js Quaternion.setFromUnitVectors,
// setFromRotationMatrix, slerpQuaternions).
//
// Привязка цифры — из генератора, а не эвристика: dice_set.scad кладёт цифру
// в центр грани «верхом» к первой вершине грани (digits_centered), у d4 —
// «верхом» к вершине (digits_d4). Поэтому строим полный базис грани
// (нормаль + верх цифры) и отображаем его в экранный базис — вырожденных
// случаев нет: верх цифры всегда ⊥ нормали.
// d4 — отдельный кейс: цифры у вершин, нужная вершина ставится вверх,
// грань с цифрой — лицом к зрителю.
//
// Калибровка кадра: GLB из пайплайна dice_set.scad → STL → Blender → glTF лежат
// в кадре, повёрнутом на -90° about X относительно таблиц geometry.ts
// (SCAD Z-up против Y-up; см. tools/blender-stl-to-glb.py).
// Матрица M: (x, y, z) -> (x, z, -y) — решена численно (задача Wahba, МНК
// в замкнутой форме) из 8 пар «запрошено → показано» на d20:
// 1→11, 20→10, 4→1, 17→20, 6→17, 15→4, 10→6, 11→15.
// Exact fit: det=+1, ортогональность ~1e-16, невязка 0.0000° — регрессия в тесте.
// Пайплайн у всего набора общий, поэтому фикс общий для всех костей;
// если для какой-то кости разойдётся — станет per-die таблицей.
import {
  digitUp,
  faceNormals,
  faceValue,
  faceVertIndices,
  normalizedVerts,
  type DieId,
} from '@/entities/dice-geometry/geometry'

export type Vec3 = [number, number, number]
export type Quat = [number, number, number, number]
export type Mat3 = [[number, number, number], [number, number, number], [number, number, number]]

const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const norm = (v: Vec3): number => Math.hypot(v[0], v[1], v[2])
const normalize = (v: Vec3): Vec3 => {
  const l = norm(v)
  return l < 1e-12 ? [0, 1, 0] : [v[0] / l, v[1] / l, v[2] / l]
}

/** Перевод вектора из кадра geometry.ts в кадр GLB-модели.
 * База — R_x(-90°): SCAD Z-up против Y-up (см. шапку). d4 шла другим экспортом:
 * её кадр (x,y,z)->(-x,z,y) решён из репорта 1→4, 2→3, 3→2 (exact fit, det=+1,
 * прогноз 4→1 — регрессия в тесте). Остальные кости — тем же пайплайном, что d20.
 */
type FrameFix = (v: Vec3) => Vec3
const MODEL_FIX: Record<DieId, FrameFix> = {
  d4: (v) => [-v[0], v[2], v[1]],
  d6: (v) => [v[0], v[2], -v[1]],
  d8: (v) => [v[0], v[2], -v[1]],
  d10: (v) => [v[0], v[2], -v[1]],
  d12: (v) => [v[0], v[2], -v[1]],
  d20: (v) => [v[0], v[2], -v[1]],
}
export const toModelFrame = (die: DieId, v: Vec3): Vec3 => MODEL_FIX[die](v)

/** Кратчайший поворот вектора a в b (аналог THREE.Quaternion.setFromUnitVectors). */
export const quatFromUnitVectors = (a: Vec3, b: Vec3): Quat => {
  const v0 = normalize(a)
  const v1 = normalize(b)
  const d = Math.max(-1, Math.min(1, dot(v0, v1)))
  if (d > 1 - 1e-9) return [0, 0, 0, 1]
  if (d < -1 + 1e-9) {
    // Антипод: любая перпендикулярная ось
    const fallback: Vec3 = Math.abs(v0[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
    const axis = normalize(cross(v0, fallback))
    return [axis[0], axis[1], axis[2], 0]
  }
  const axis = cross(v0, v1)
  const s = Math.sqrt((1 + d) * 2)
  const inv = 1 / s
  return [axis[0] * inv, axis[1] * inv, axis[2] * inv, s / 2]
}

export const applyQuatToVec = (v: Vec3, q: Quat): Vec3 => {
  const [x, y, z] = v
  const [qx, qy, qz, qw] = q
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

/** Кватернион из матрицы поворота 3x3 (ветвление по следу — ср. three.js). */
const quatFromMatrix = (m: Mat3): Quat => {
  const trace = m[0][0] + m[1][1] + m[2][2]
  let x: number
  let y: number
  let z: number
  let w: number
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    w = 0.25 / s
    x = (m[2][1] - m[1][2]) * s
    y = (m[0][2] - m[2][0]) * s
    z = (m[1][0] - m[0][1]) * s
  } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const s = 2 * Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2])
    w = (m[2][1] - m[1][2]) / s
    x = 0.25 * s
    y = (m[0][1] + m[1][0]) / s
    z = (m[0][2] + m[2][0]) / s
  } else if (m[1][1] > m[2][2]) {
    const s = 2 * Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2])
    w = (m[0][2] - m[2][0]) / s
    x = (m[0][1] + m[1][0]) / s
    y = 0.25 * s
    z = (m[1][2] + m[2][1]) / s
  } else {
    const s = 2 * Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1])
    w = (m[1][0] - m[0][1]) / s
    x = (m[0][2] + m[2][0]) / s
    y = (m[1][2] + m[2][1]) / s
    z = 0.25 * s
  }
  const l = Math.hypot(x, y, z, w)
  return [x / l, y / l, z / l, w / l]
}

/** Поворот, переводящий ортонормированный базис L в базис W (R = W · Lᵀ). */
const quatFromBases = (xL: Vec3, yL: Vec3, zL: Vec3, xW: Vec3, yW: Vec3, zW: Vec3): Quat => {
  const m: Mat3 = [
    [
      xW[0] * xL[0] + yW[0] * yL[0] + zW[0] * zL[0],
      xW[0] * xL[1] + yW[0] * yL[1] + zW[0] * zL[1],
      xW[0] * xL[2] + yW[0] * yL[2] + zW[0] * zL[2],
    ],
    [
      xW[1] * xL[0] + yW[1] * yL[0] + zW[1] * zL[0],
      xW[1] * xL[1] + yW[1] * yL[1] + zW[1] * zL[1],
      xW[1] * xL[2] + yW[1] * yL[2] + zW[1] * zL[2],
    ],
    [
      xW[2] * xL[0] + yW[2] * yL[0] + zW[2] * zL[0],
      xW[2] * xL[1] + yW[2] * yL[1] + zW[2] * zL[1],
      xW[2] * xL[2] + yW[2] * yL[2] + zW[2] * zL[2],
    ],
  ]
  return quatFromMatrix(m)
}

/** Индекс грани с нужным значением (d10: 0–9, остальные 1–N). Бросает при нет значения. */
export const faceIndexForValue = (die: DieId, value: number): number => {
  const normals = faceNormals(die)
  for (let fi = 0; fi < normals.length; fi++) {
    if (faceValue(die, fi) === value) return fi
  }
  throw new RangeError(`no face with value ${value} on ${die}`)
}

/**
 * Кватернион: грань со значением value смотрит прямо в dirWorld (направление
 * на камеру), верх цифры — строго вверх экрана (без вырожденных случаев:
 * верх цифры всегда ⊥ нормали грани).
 */
export const quatForValueToCamera = (
  die: Exclude<DieId, 'd4'>,
  value: number,
  dirWorld: Vec3,
  screenUp: Vec3 = [0, 1, 0],
): Quat => {
  const fi = faceIndexForValue(die, value)
  const zL = normalize(toModelFrame(die, faceNormals(die)[fi]))
  const yL = normalize(toModelFrame(die, digitUp(die, fi)))
  const xL = normalize(cross(yL, zL))
  const zW = normalize(dirWorld)
  const candidates: Vec3[] = [screenUp, [0, 0, 1], [1, 0, 0]]
  let yW: Vec3 = [0, 1, 0]
  for (const c of candidates) {
    const cn = normalize(c)
    const d = dot(cn, zW)
    const p: Vec3 = [cn[0] - zW[0] * d, cn[1] - zW[1] * d, cn[2] - zW[2] * d]
    if (norm(p) > 1e-6) {
      yW = normalize(p)
      break
    }
  }
  const xW = normalize(cross(yW, zW))
  return quatFromBases(xL, yL, zL, xW, yW, zW)
}

/**
 * Кватернион d4: вершина со значением value строго вверх (+Y), грань с её
 * цифрой — лицом к зрителю (цифра читается снизу вверх, верхом к вершине).
 */
export const quatForD4VertexUp = (value: number, viewDir: Vec3): Quat => {
  const vi = value - 1
  const verts = normalizedVerts('d4')
  if (vi < 0 || vi >= verts.length) throw new RangeError(`bad d4 value ${value}`)
  const faces = faceVertIndices('d4')
  const fj = faces.findIndex((f) => f.includes(vi))
  if (fj < 0) throw new RangeError(`no face for d4 vertex ${vi}`)
  const yL = normalize(toModelFrame('d4', verts[vi]))
  const nv = normalize(toModelFrame('d4', faceNormals('d4')[fj]))
  const d = dot(nv, yL)
  const zL = normalize([nv[0] - yL[0] * d, nv[1] - yL[1] * d, nv[2] - yL[2] * d])
  const xL = normalize(cross(yL, zL))
  const yW: Vec3 = [0, 1, 0]
  const c = normalize(viewDir)
  const cd = dot(c, yW)
  let ch: Vec3 = [c[0] - yW[0] * cd, c[1] - yW[1] * cd, c[2] - yW[2] * cd]
  if (norm(ch) < 1e-6) ch = [0, 0, 1]
  const zW = normalize(ch)
  const xW = normalize(cross(yW, zW))
  return quatFromBases(xL, yL, zL, xW, yW, zW)
}
