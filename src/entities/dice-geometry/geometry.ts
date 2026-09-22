// Геометрия костей для физики и чтения результата.
// Зеркало tools/dice_set.scad (unit-вершины, грани, opposite-таблицы, values_for).
// Чистый TS без three-зависимостей: вершины — [x, y, z], грани — индексы.
// Нормировка как в SCAD: вершины делятся на inradius → плоскости граней на 1.0.

export type Vec3 = [number, number, number]
export type DieId = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20'

const PHI = (1 + Math.sqrt(5)) / 2

const ICOSA_V: Vec3[] = [
  [-1, PHI, 0],
  [1, PHI, 0],
  [-1, -PHI, 0],
  [1, -PHI, 0],
  [0, -1, PHI],
  [0, 1, PHI],
  [0, -1, -PHI],
  [0, 1, -PHI],
  [PHI, 0, -1],
  [PHI, 0, 1],
  [-PHI, 0, -1],
  [-PHI, 0, 1],
]

const ICOSA_F: number[][] = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
]

const TETRA_V: Vec3[] = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
]
const TETRA_F: number[][] = [
  [1, 2, 3],
  [0, 2, 3],
  [0, 1, 3],
  [0, 1, 2],
]

const OCTA_V: Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]
const OCTA_F: number[][] = [
  [0, 4, 2],
  [0, 2, 5],
  [0, 5, 3],
  [0, 3, 4],
  [1, 4, 3],
  [1, 3, 5],
  [1, 5, 2],
  [1, 2, 4],
]

const CUBE_V: Vec3[] = [
  [-1, -1, -1],
  [1, -1, -1],
  [-1, 1, -1],
  [1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [-1, 1, 1],
  [1, 1, 1],
]
const CUBE_F: number[][] = [
  [0, 1, 3, 2],
  [4, 6, 7, 5],
  [2, 3, 7, 6],
  [0, 1, 5, 4],
  [0, 2, 6, 4],
  [1, 3, 7, 5],
]

// Полярный дуал правильной антипризмы (плоские кайты), зеркало TRAPEZO_V/F
const TRAPEZO_V: Vec3[] = [
  [0.0, 0.0, 1.1764706],
  [-0.0, -0.0, -1.1764706],
  [0.8944272, 0.6498394, 0.1242033],
  [0.3416408, 1.0514622, -0.1242033],
  [-0.3416408, 1.0514622, 0.1242033],
  [-0.8944272, 0.6498394, -0.1242033],
  [-1.1055728, 0.0, 0.1242033],
  [-0.8944272, -0.6498394, -0.1242033],
  [-0.3416408, -1.0514622, 0.1242033],
  [0.3416408, -1.0514622, -0.1242033],
  [0.8944272, -0.6498394, 0.1242033],
  [1.1055728, -0.0, -0.1242033],
]
const TRAPEZO_F: number[][] = [
  [0, 10, 11, 2],
  [1, 2, 3, 11],
  [0, 2, 3, 4],
  [1, 4, 5, 3],
  [0, 4, 5, 6],
  [1, 6, 7, 5],
  [0, 6, 7, 8],
  [1, 8, 9, 7],
  [0, 8, 9, 10],
  [1, 10, 11, 9],
]

const OPP: Record<'d6' | 'd8' | 'd12' | 'd20', number[]> = {
  d6: [1, 0, 3, 2, 5, 4],
  d8: [5, 4, 7, 6, 1, 0, 3, 2],
  d12: [3, 2, 1, 0, 7, 6, 5, 4, 11, 10, 9, 8],
  d20: [13, 12, 11, 10, 14, 17, 18, 19, 15, 16, 3, 2, 1, 0, 4, 8, 9, 5, 6, 7],
}
const OPP_D10 = [5, 6, 7, 8, 9, 0, 1, 2, 3, 4]

// Face-to-face размеры (мм), зеркало DIE_SIZES из dice_set.scad
const DIE_SIZES: Record<DieId, number> = {
  d4: 10,
  d6: 16,
  d8: 12,
  d10: 16,
  d12: 17.5,
  d20: 17.5,
}
const EDGE_R = 1

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (v: Vec3): number => Math.sqrt(dot(v, v))
const centroidOf = (verts: Vec3[], face: number[]): Vec3 => {
  const c: Vec3 = [0, 0, 0]
  for (const i of face) {
    c[0] += verts[i][0]
    c[1] += verts[i][1]
    c[2] += verts[i][2]
  }
  return [c[0] / face.length, c[1] / face.length, c[2] / face.length]
}

const unitVerts = (die: DieId): Vec3[] => {
  switch (die) {
    case 'd4':
      return TETRA_V
    case 'd6':
      return CUBE_V
    case 'd8':
      return OCTA_V
    case 'd10':
      return TRAPEZO_V
    case 'd20':
      return ICOSA_V
    case 'd12': {
      // Дуал икосаэдра: вершина = нормированный центроид грани × 1.5
      return ICOSA_F.map((f) => {
        const c = centroidOf(ICOSA_V, f)
        const l = norm(c)
        return [c[0] / l, c[1] / l, c[2] / l].map((x) => x * 1.5) as Vec3
      })
    }
  }
}

const rawFaces = (die: DieId): number[][] => {
  switch (die) {
    case 'd4':
      return TETRA_F
    case 'd6':
      return CUBE_F
    case 'd8':
      return OCTA_F
    case 'd10':
      return TRAPEZO_F
    case 'd20':
      return ICOSA_F
    case 'd12': {
      // Грань додекаэдра = кольцо граней икосаэдра вокруг его вершины
      const ring: number[][] = ICOSA_V.map(() => [])
      ICOSA_F.forEach((f, fi) => {
        for (const vi of f) ring[vi].push(fi)
      })
      return ring
    }
  }
}

const faceNormalOf = (verts: Vec3[], face: number[]): Vec3 => {
  const [a, b, c] = [verts[face[0]], verts[face[1]], verts[face[2]]]
  const n = cross(sub(b, a), sub(c, a))
  const l = norm(n)
  const cen = centroidOf(verts, face)
  const s = dot(n, cen) < 0 ? -1 : 1
  return [n[0] / l, n[1] / l, n[2] / l].map((x) => x * s) as Vec3
}

/** Inradius unit-вершин (= расстояние плоскости грани от центра). */
export const dieInradius = (die: DieId): number => {
  const v = unitVerts(die)
  return Math.min(...rawFaces(die).map((f) => Math.abs(dot(centroidOf(v, f), faceNormalOf(v, f)))))
}

/** Вершины, нормированные как в SCAD (verts = unit / inradius, плоскости на 1.0). */
export const normalizedVerts = (die: DieId): Vec3[] => {
  const r = dieInradius(die)
  return unitVerts(die).map(([x, y, z]) => [x / r, y / r, z / r])
}

/** Значение на грани fi (зеркало values_for). d10: 0–9, остальные 1–N. */
export const faceValue = (die: DieId, fi: number): number => {
  const n = rawFaces(die).length
  if (die === 'd10') {
    const o = OPP_D10[fi]
    return fi < o ? fi : n - 1 - o
  }
  if (die === 'd4') return fi + 1
  const o = OPP[die][fi]
  return fi < o ? fi + 1 : n - o
}

/** Значение на вершине vi для d4 (цифры у вершин): вершина vi → vi+1. */
export const vertexValue = (vi: number): number => vi + 1

/** Масштаб тела для физики: центры сфер hull = normalized × s (зеркало body()). */
export const bodyScale = (die: DieId): number => DIE_SIZES[die] / 2 - EDGE_R

/** Нормали граней (наружу) в нормированных координатах. */
export const faceNormals = (die: DieId): Vec3[] => {
  const v = normalizedVerts(die)
  return rawFaces(die).map((f) => faceNormalOf(v, f))
}

/**
 * Треугольники граней с обмоткой наружу (для ConvexPolyhedron):
 * квады/пятиугольники режутся веером от вершины 0.
 */
export const outwardTriangles = (die: DieId): { verts: Vec3[]; tris: number[][] } => {
  const verts = normalizedVerts(die)
  const tris: number[][] = []
  for (const f of rawFaces(die)) {
    for (let k = 1; k < f.length - 1; k++) {
      const tri = [f[0], f[k], f[k + 1]]
      const [a, b, c] = [verts[tri[0]], verts[tri[1]], verts[tri[2]]]
      const n = cross(sub(b, a), sub(c, a))
      const cen = centroidOf(verts, tri)
      if (dot(n, cen) < 0) tris.push([tri[0], tri[2], tri[1]])
      else tris.push(tri)
    }
  }
  return { verts, tris }
}

export const DIE_IDS: DieId[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']
export const faceCount = (die: DieId): number => rawFaces(die).length
