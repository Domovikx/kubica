// ВРЕМЕННЫЙ универсальный решатель кадров (Wahba, МНК замкнутой формы).
// Сначала самопроверка на d20 (должен выйти M), затем пары остальных.
// Удалить после калибровки.
import { describe, it } from 'vitest'
import { faceNormals, type DieId, type Vec3 } from '@/entities/dice-geometry/geometry'
import { applyQuatToVec, faceIndexForValue } from './face-orient'
import type { Quat } from './readout'

const tiltOf = (die: DieId, q: Quat): { name: string; cos: number } => {
  const normals = faceNormals(die)
  let best = -2
  let bestFi = -1
  normals.forEach((n, fi) => {
    const w = applyQuatToVec(n, q)
    const l = Math.hypot(w[0], w[1], w[2]) || 1
    const c = w[1] / l
    if (c > best) {
      best = c
      bestFi = fi
    }
  })
  return { name: `${die}:fi${bestFi}`, cos: best }
}

type M3 = number[][]
const zeros3 = (): M3 => [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
]
const det3 = (a: M3): number =>
  a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
  a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
  a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])
const inv3 = (a: M3): M3 => {
  const d = det3(a)
  const c: M3 = [
    [
      a[1][1] * a[2][2] - a[1][2] * a[2][1],
      a[0][2] * a[2][1] - a[0][1] * a[2][2],
      a[0][1] * a[1][2] - a[0][2] * a[1][1],
    ],
    [
      a[1][2] * a[2][0] - a[1][0] * a[2][2],
      a[0][0] * a[2][2] - a[0][2] * a[2][0],
      a[0][2] * a[1][0] - a[0][0] * a[1][2],
    ],
    [
      a[1][0] * a[2][1] - a[1][1] * a[2][0],
      a[0][1] * a[2][0] - a[0][0] * a[2][1],
      a[0][0] * a[1][1] - a[0][1] * a[1][0],
    ],
  ]
  return c.map((row) => row.map((x) => x / d))
}
const mul = (a: M3, b: M3): M3 => {
  const r = zeros3()
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]
  return r
}
const transpose = (a: M3): M3 => [
  [a[0][0], a[1][0], a[2][0]],
  [a[0][1], a[1][1], a[2][1]],
  [a[0][2], a[1][2], a[2][2]],
]

const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

const solve = (die: DieId, pairs: Array<[seen: number, req: number]>): void => {
  const normals = faceNormals(die)
  const at = (fi: number): Vec3 => unit(normals[fi])
  const A = zeros3()
  const B = zeros3()
  for (const [seen, req] of pairs) {
    const t = at(faceIndexForValue(die, req))
    const f = at(faceIndexForValue(die, seen))
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) {
        A[r][c] += t[r] * f[c]
        B[r][c] += f[r] * f[c]
      }
  }
  const M = mul(A, inv3(B))
  // oxlint-disable-next-line no-console
  console.log(`${die} M_DET`, det3(M).toFixed(6))
  const ortho = mul(M, transpose(M))
  let orthoErr = 0
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      orthoErr = Math.max(orthoErr, Math.abs(ortho[r][c] - (r === c ? 1 : 0)))
  // oxlint-disable-next-line no-console
  console.log(`${die} M_ORTHO_ERR`, orthoErr.toExponential(2))
  // oxlint-disable-next-line no-console
  console.log(`${die} M_ROWS`, JSON.stringify(M.map((row) => row.map((x) => Number(x.toFixed(4))))))
  let maxDeg = 0
  for (const [seen, req] of pairs) {
    const t = at(faceIndexForValue(die, req))
    const f = at(faceIndexForValue(die, seen))
    const g: Vec3 = [
      M[0][0] * f[0] + M[0][1] * f[1] + M[0][2] * f[2],
      M[1][0] * f[0] + M[1][1] * f[1] + M[1][2] * f[2],
      M[2][0] * f[0] + M[2][1] * f[1] + M[2][2] * f[2],
    ]
    const cosA = Math.max(-1, Math.min(1, g[0] * t[0] + g[1] * t[1] + g[2] * t[2]))
    maxDeg = Math.max(maxDeg, (Math.acos(cosA) * 180) / Math.PI)
  }
  // oxlint-disable-next-line no-console
  console.log(`${die} M_MAX_RESIDUAL_DEG`, maxDeg.toFixed(4))
}

describe('scratch-solve', () => {
  it('d20 самопроверка (должен выйти M)', () => {
    solve('d20', [
      [11, 1],
      [10, 20],
      [1, 4],
      [20, 17],
      [17, 6],
      [4, 15],
      [6, 10],
      [15, 11],
    ])
  })

  it('ВРЕМЕННО: плоскость свежих логов (удалить)', () => {
    const data: Array<[DieId, string, Quat]> = [
      [
        'd8',
        'r0v8',
        [-0.600970292766935, 0.45929331072316565, -0.6538423677052732, 0.019352522578226342],
      ],
      [
        'd8',
        'r1v8',
        [0.8733286671903437, -0.3786487097416934, 0.16115884604436315, 0.260672246348049],
      ],
      [
        'd8',
        'r2v8',
        [0.5453418052750956, 0.05694259589014171, -0.7009118703618256, 0.45616050484284487],
      ],
      [
        'd10',
        'r0v9',
        [0.7069843418277356, -0.530157121663187, -0.013158441908576906, 0.4679032188035763],
      ],
      [
        'd10',
        'r1v0',
        [-0.5291160177756429, -0.7069533488380945, -0.46908021053579235, -0.014729507240432099],
      ],
      [
        'd10',
        'r2v6',
        [-0.6114436212486912, -0.3134821526136153, -0.7219479140852463, -0.08158950529928988],
      ],
      [
        'd12',
        'r0v2',
        [-0.18256643152137314, -0.5854658902302212, -0.45467151649260684, -0.6458893106011273],
      ],
      [
        'd12',
        'r1v12',
        [0.2664277517266254, 0.0756865409630505, 0.9243060409225484, 0.2625759763211946],
      ],
      [
        'd12',
        'r2v3',
        [-0.6400246820087807, 0.3863957046205105, 0.30061338363346257, -0.592197905645418],
      ],
    ]
    for (const [die, tag, q] of data) {
      const t = tiltOf(die, q)
      // oxlint-disable-next-line no-console
      console.log(`${tag} top=${t.name} cos=${t.cos.toFixed(4)}`)
    }
  })
})
