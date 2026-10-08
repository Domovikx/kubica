// Чтение результата по финальной ориентации (кватернион [x, y, z, w]).
// Чистая математика без three.js — тестируется моками.
// ВАЖНО: всё в кадре МОДЕЛИ (toModelFrame): тело cannon-es строится из
// MODEL-вершин и меш показывает MODEL-геометрию — читать в CAD-кадре
// значило бы врать на 90° (тело плашмя, поп с чужой грани).
import {
  faceNormals,
  faceValue,
  faceVertIndices,
  normalizedVerts,
  toModelFrame,
  vertexValue,
  type DieId,
  type Vec3,
} from '@/entities/dice-geometry/geometry'
import { applyQuatToVec, quatFromUnitVectors, quatMul, quatYaw } from './face-orient'

export type Quat = [number, number, number, number]

/** Индекс верхней грани (макс. проекция нормали на +Y). Нормали — кадр модели. */
export const topFaceIndex = (die: DieId, quat: Quat): number => {
  const normals = faceNormals(die).map((n) => toModelFrame(die, n))
  let best = 0
  let bestDot = -Infinity
  normals.forEach((n, fi) => {
    const w = applyQuatToVec(n, quat)
    const d = w[1]
    if (d > bestDot) {
      bestDot = d
      best = fi
    }
  })
  return best
}

/** Индекс верхней вершины (только d4 — цифры у вершин). Вершины — кадр модели. */
export const topVertexIndex = (quat: Quat): number => {
  const verts = normalizedVerts('d4').map((v) => toModelFrame('d4', v))
  let best = 0
  let bestY = -Infinity
  verts.forEach((v, vi) => {
    const w = applyQuatToVec(v, quat)
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

/**
 * Индекс нижней грани (макс. проекция нормали на −Y — грань на столе).
 * Для камеры под стеклянным столом: что видно, то и результат.
 */
export const bottomFaceIndex = (die: DieId, quat: Quat): number => {
  const normals = faceNormals(die).map((n) => toModelFrame(die, n))
  let best = 0
  let bestDot = Infinity
  normals.forEach((n, fi) => {
    const w = applyQuatToVec(n, quat)
    const d = w[1]
    if (d < bestDot) {
      bestDot = d
      best = fi
    }
  })
  return best
}

/**
 * Значение броска по нижней грани (камера снизу).
 * d4: нижняя грань лежит на столе и несёт то же значение, что верхняя
 * вершина (грань fi противоположна вершине vi при fi === vi, обе дают +1),
 * так что низ = верху — пирамидка из-под стола читается лицом в лицо.
 */
export const readBottomRoll = (die: DieId, quat: Quat): number =>
  faceValue(die, bottomFaceIndex(die, quat))

/**
 * Верх экрана в мировых осях: горизонталь направления взгляда.
 * Камера под столом смотрит вверх с эпсилоном к +Z — верх экрана ≈ +Z.
 */
export const screenUpWorld = (viewDir: Vec3): Vec3 => {
  const l = Math.hypot(viewDir[0], viewDir[2])
  if (l < 1e-6) return [0, 0, 1]
  return [viewDir[0] / l, 0, viewDir[2] / l]
}

/**
 * Вершина нижней грани с макс. проекцией на screenUp (верхняя на экране).
 * Правило д4 снизу: грань на столе видна лицом, upright-цифра — у верхней
 * на экране вершины. Это НЕ верхняя вершина (та смотрит вверх, её не видно):
 * результат зависит от доворота вокруг Y — yaw-презентация запрещена.
 */
export const screenTopVertexIndex = (die: DieId, quat: Quat, screenUp: Vec3): number => {
  const fi = bottomFaceIndex(die, quat)
  const face = faceVertIndices(die)[fi]
  const verts = normalizedVerts(die).map((v) => toModelFrame(die, v))
  let best = face[0]
  let bestS = -Infinity
  for (const vi of face) {
    const w = applyQuatToVec(verts[vi], quat)
    const s = w[0] * screenUp[0] + w[1] * screenUp[1] + w[2] * screenUp[2]
    if (s > bestS) {
      bestS = s
      best = vi
    }
  }
  return best
}

/** Значение д4 снизу: цифра вершины нижней грани, верхней на экране. */
export const readD4ScreenTop = (quat: Quat, screenUp: Vec3): number =>
  vertexValue(screenTopVertexIndex('d4', quat, screenUp))

export interface D4BelowPose {
  /**
   * Финальная поза: нижняя грань ровно внизу + winning-вершина ровно наверху
   * экрана. Значение обязано считаться от неё, не от исходной.
   */
  target: Quat
  value: number
  /** true — был наклон, поза выровнена (показывать длинной медленной укладкой). */
  flattened: boolean
}

const quatDot = (a: Quat, b: Quat): number =>
  Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))

/**
 * Полный пайплайн д4 снизу: нижняя грань ровно вниз кратчайшей дугой
 * (грань та же — она и так самая нижняя) + winning-вершина ровно наверх экрана.
 * Любая посадка (включая вис на стене) заканчивается плоской читаемой позой
 * одним движением; значение — от финала. Физика не трогается: она и так
 * считает честно, выравнивание — дело презентации.
 */
export const resolveD4Below = (quat: Quat, screenUp: Vec3): D4BelowPose => {
  const fi = bottomFaceIndex('d4', quat)
  const n = toModelFrame('d4', faceNormals('d4')[fi])
  const w = applyQuatToVec(n, quat)
  const l = Math.hypot(w[0], w[1], w[2]) || 1
  const flat = quatMul(quatFromUnitVectors([w[0] / l, w[1] / l, w[2] / l], [0, -1, 0]), quat)
  // Микро-наклоны (<2° — невидимо) не выравниваем движением, только yaw.
  const flattened = 2 * Math.acos(quatDot(quat, flat)) > 0.035
  const base = flattened ? flat : quat
  const delta = yawDeltaToScreenTop(base, screenUp)
  const target = quatMul(quatYaw(delta), base)
  return { target, value: readD4ScreenTop(target, screenUp), flattened }
}

/**
 * Доворот вокруг мирового Y, ставящий winning-вершину ровно наверх экрана.
 * Значение сохраняется: поворачиваем к уже выигравшей вершине (|δ| ≤ 60°),
 * она остаётся единственно верхней. После доворота её цифра стоит прямо.
 */
export const yawDeltaToScreenTop = (quat: Quat, screenUp: Vec3): number => {
  const vi = screenTopVertexIndex('d4', quat, screenUp)
  const v = toModelFrame('d4', normalizedVerts('d4')[vi])
  const w = applyQuatToVec(v, quat)
  let delta = Math.atan2(screenUp[0], screenUp[2]) - Math.atan2(w[0], w[2])
  while (delta > Math.PI) delta -= 2 * Math.PI
  while (delta < -Math.PI) delta += 2 * Math.PI
  return delta
}

/**
 * Числовое значение результата для сумм/итогов. Единственное исключение —
 * **d10**: у канонической d10 грани промаркированы 0–9 (не 1–10), и «0» при
 * одиночном броске читается как 10, т.е. грань даёт число 1..10. Для всех
 * остальных костей значение не меняется.
 *
 * Результаты веб-исследования (2026-10, записано здесь, чтобы вопрос не
 * всплывал снова):
 *
 * - Wikipedia «Dice notation» → Standard notation: «The faces are numbered
 *   from 1 to s … A notable exception is the d10, which is labeled from 0
 *   to 9, though the 0 can also be read as a 10».
 * - Wikipedia «Pentagonal trapezohedron» → 10-sided dice: «Ten-sided dice
 *   are commonly numbered from 0 to 9 … Ten-sided dice may also be marked
 *   1 to 10 when a random number in this range is desirable».
 *
 * Оговорки:
 *
 * - Проценты — исключение из исключения: в паре d10+d% (десятки/единицы) 0
 *   остаётся нулём (00 может читаться как 100 по правилам конкретной
 *   системы). В Kubica d100 — отдельная кость (крипто-RNG 1..100,
 *   `dice-pool/pool.ts`), физическая пара d10+d% — задача 2.5: там появится
 *   своя типизация, нормализация d10 к ней применяться не будет.
 * - 3D-грань печатается «0», как на настоящей кости; «10» — то, что
 *   показывает отображение (`displayValue`). Любые СУММЫ (красная сумма в
 *   шапке стола, итог пула, история, сортировка kh/kl) обязаны складывать
 *   `scoreValue`, а не сырые `value` — иначе сумма в шапке расходится с
 *   футером/историей, которые печатают `display`.
 *
 * @see displayValue — та же нормализация, но строкой.
 */
export const scoreValue = (die: string, value: number): number =>
  die === 'd10' && value === 0 ? 10 : value

/** Отображаемое значение: на d10 ноль читается как 10 (см. scoreValue). */
export const displayValue = (die: DieId, value: number): string => String(scoreValue(die, value))
