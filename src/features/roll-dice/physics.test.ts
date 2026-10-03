import { describe, expect, it } from 'vitest'
import { bodyScale } from '@/entities/dice-geometry/geometry'
import { readRoll, topFaceIndex, topVertexIndex } from './readout'
import { createPhysicsWorld, diceOverlap, snapFlat, type DicePose } from './physics'
import { pumpUntilSettled } from './test-pump'
import { quatFromUnitVectors } from './face-orient'
import {
  faceNormals,
  normalizedVerts,
  toModelFrame,
  type DieId,
} from '@/entities/dice-geometry/geometry'
import type { Quat } from './readout'

const seeded = (seed: number) => {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

type V3 = [number, number, number]

const IDENTITY: Quat = [0, 0, 0, 1]

const axisAngle = (axis: V3, deg: number): Quat => {
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1
  const s = Math.sin((deg * Math.PI) / 180 / 2)
  return [
    (axis[0] / l) * s,
    (axis[1] / l) * s,
    (axis[2] / l) * s,
    Math.cos((deg * Math.PI) / 180 / 2),
  ]
}

const qMulT = (a: Quat, b: Quat): Quat => {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

const rotVec = (v: V3, q: Quat): V3 => {
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

describe('snapFlat: покой всегда плоский, исход тот же', () => {
  const tilted = (deg: number): Quat => qMulT(axisAngle([1, 0, 0], deg), [0, 0, 0, 1])

  for (const die of ['d6', 'd20'] as DieId[]) {
    it(`${die}: наклон 10° → та же грань ровно вверх`, () => {
      // Грань ровно вверх, затем наклон 10° вокруг горизонтальной оси:
      // детерминировано в любом кадре (наклон вслепую вокруг X давал
      // вырожденные ничьи на identity — было, чинили кадром).
      // Инвариант доснапа: текущая нижняя грань — ровно вниз.
      const fi = topFaceIndex(die, IDENTITY)
      const n0 = toModelFrame(die, faceNormals(die)[fi])
      const q0 = quatFromUnitVectors(n0, [0, 1, 0])
      const axis: V3 = Math.abs(n0[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]
      const q = qMulT(axisAngle(axis, 10), q0)
      const before = topFaceIndex(die, q)
      expect(before).toBe(fi)
      const snapped = snapFlat(die, q)
      expect(topFaceIndex(die, snapped)).toBe(before)
      // Снап вернул грань ровно вверх: identity-нормаль снова соосна +Y
      // (снап действует на текущую наклонённую нормаль, q входит один раз)
      const w = rotVec(n0, snapped)
      expect(w[1] / Math.hypot(w[0], w[1], w[2])).toBeGreaterThan(0.9999)
    })
  }

  it('d6: наклон 30° — руки прочь (соседи под 90°, снап не зона)', () => {
    const q = tilted(30)
    expect(snapFlat('d6', q)).toEqual(q)
  })

  it('d4: вершина почти вверх (8°) → та же вершина ровно вверх', () => {
    // В identity вершина в 54.7° от вертикали — базу ставим точным доворотом.
    // Кадр модели везде (доснап и глаз).
    const v0 = toModelFrame('d4', normalizedVerts('d4')[0])
    const l0 = Math.hypot(v0[0], v0[1], v0[2])
    const up0: [number, number, number] = [v0[0] / l0, v0[1] / l0, v0[2] / l0]
    const q = qMulT(axisAngle([1, 0, 0], 8), quatFromUnitVectors(up0, [0, 1, 0]))
    expect(topVertexIndex(q)).toBe(0)
    const snapped = snapFlat('d4', q)
    expect(topVertexIndex(snapped)).toBe(0)
    const w = rotVec(v0, snapped)
    expect(w[1] / Math.hypot(w[0], w[1], w[2])).toBeGreaterThan(0.9999)
  })
})

describe('physics (cannon-es, smoke)', () => {
  it('бросок d6 оседает и даёт значение 1..6', async () => {
    const world = await createPhysicsWorld()
    // В node нет rAF-цикла приложения — качаем мир синхронно (быстро, без таймеров)
    try {
      const { quat, settled, steps } = await pumpUntilSettled(
        world,
        world.roll('d6', { random: seeded(42) }),
      )
      // Кость обязана реально осесть (не fallback по таймауту) —
      // иначе тест ловит регрессии вроде сломанных коллизий со столом
      expect(settled).toBe(true)
      expect(steps).toBeLessThan(720)
      const v = readRoll('d6', quat)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
    } finally {
      world.dispose()
    }
  }, 30000)
  it('бросок с силой 1.6 оседает и даёт значение 1..6', async () => {
    const world = await createPhysicsWorld()
    try {
      const { quat, settled } = await pumpUntilSettled(
        world,
        world.roll('d6', { random: seeded(7), power: 1.6 }),
      )
      expect(settled).toBe(true)
      const v = readRoll('d6', quat)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
    } finally {
      world.dispose()
    }
  }, 30000)

  it('спавн стартует с места покоя (бесшовный бросок)', async () => {
    const world = await createPhysicsWorld()
    try {
      const seen: Array<{ x: number; y: number; z: number }> = []
      const { settled } = await pumpUntilSettled(
        world,
        world.roll('d6', {
          random: seeded(11),
          spawn: { pos: [5, 10, -3] },
          onStep: (s) => {
            if (seen.length === 0) seen.push({ x: s.pos[0], y: s.pos[1], z: s.pos[2] })
          },
        }),
      )
      expect(settled).toBe(true)
      expect(seen).toHaveLength(1)
      expect(Math.abs(seen[0].x - 5)).toBeLessThan(2)
      expect(Math.abs(seen[0].z + 3)).toBeLessThan(2)
      // Высота — с запасом над телом (boundR d6 ≈ 13.1), не точка покоя
      expect(seen[0].y).toBeGreaterThan(13)
      expect(seen[0].y).toBeLessThan(17)
    } finally {
      world.dispose()
    }
  }, 30000)

  it('пара из одной точки не застывает друг в друге (separation)', async () => {
    // Две кости из одной точки: глубокое начальное пересечение солвер
    // разбрасывает, а тихое доталкивание в покое растаскивает separation.
    // Инвариант: финальная дистанция центров не меньше 0.9 суммы инрадиусов.
    const world = await createPhysicsWorld({ bounds: 'rect' })
    try {
      const last: Record<'a' | 'b', [number, number, number]> = {
        a: [0, 0, 0],
        b: [0, 0, 0],
      }
      const [a, b] = await pumpUntilSettled(
        world,
        Promise.all([
          world.roll('d6', {
            random: seeded(21),
            spawn: { pos: [0, 8, 0] },
            power: 0.4,
            onStep: (s) => {
              last.a = [...s.pos]
            },
          }),
          world.roll('d6', {
            random: seeded(22),
            spawn: { pos: [0, 8, 0] },
            power: 0.4,
            onStep: (s) => {
              last.b = [...s.pos]
            },
          }),
        ]),
      )
      expect(a.settled).toBe(true)
      expect(b.settled).toBe(true)
      const dist = Math.hypot(last.a[0] - last.b[0], last.a[1] - last.b[1], last.a[2] - last.b[2])
      expect(dist).toBeGreaterThanOrEqual(0.9 * 2 * bodyScale('d6'))
    } finally {
      world.dispose()
    }
  }, 60000)

  it('осевая статика держит место: пачка не застывает друг в друге', async () => {
    // keepStatic (общий стол, как rollTable): пачка идёт конкурентно в одном
    // мире, осевшие становятся статикой до конца пачки. Инвариант: обе осели,
    // дистанция легальна (стопка грань-в-грань — ок), внутри друг друга — нет.
    // Пат-кейс «строго по оси сверху с малой силой» (баланс на углу) тут не
    // проверяем: в проде его закрывает ретрай table-roll (max 2), а не физика.
    const world = await createPhysicsWorld({ bounds: 'rect' })
    try {
      const last: Record<'a' | 'b', [number, number, number]> = {
        a: [0, 0, 0],
        b: [0, 0, 0],
      }
      const [a, b] = await pumpUntilSettled(
        world,
        Promise.all([
          world.roll('d6', {
            random: seeded(31),
            spawn: { pos: [-11, 8, 0] },
            power: 0.5,
            keepStatic: true,
            onStep: (s) => {
              last.a = [...s.pos]
            },
          }),
          world.roll('d6', {
            random: seeded(32),
            spawn: { pos: [11, 8, 0] },
            power: 0.5,
            keepStatic: true,
            onStep: (s) => {
              last.b = [...s.pos]
            },
          }),
        ]),
      )
      expect(a.settled).toBe(true)
      expect(b.settled).toBe(true)
      const dist = Math.hypot(last.a[0] - last.b[0], last.a[1] - last.b[1], last.a[2] - last.b[2])
      expect(dist).toBeGreaterThanOrEqual(0.9 * 2 * bodyScale('d6'))
    } finally {
      world.dispose()
    }
  }, 60000)

  it('diceOverlap: врозь/касание — нет, внахлёст — да', () => {
    const id: Quat = [0, 0, 0, 1]
    const d6 = (x: number, y = 7, z = 0, quat: Quat = id): DicePose => ({
      die: 'd6',
      pos: [x, y, z],
      quat,
    })
    const inR = bodyScale('d6')
    // Далеко — нет
    expect(diceOverlap(d6(0), d6(40))).toBe(false)
    // Касание грань-в-грань ровно — нет
    expect(diceOverlap(d6(0), d6(2 * inR))).toBe(false)
    // Соосный сдвиг 4 (глубоко) — да
    expect(diceOverlap(d6(0), d6(10))).toBe(true)
    // Совпали полностью — да
    expect(diceOverlap(d6(0), d6(0))).toBe(true)
    // Вершинный путь: кольцо дистанций [12.6, 20), где дистанционный тест
    // заведомо молчит (0.9 × 14 = 12.6) — ищем наклон, при котором угол
    // реально входит в грань. Найденное true = сработал именно вершинный путь.
    const yawPitch = (yawDeg: number, pitchDeg: number): Quat =>
      qMulT(axisAngle([0, 1, 0], yawDeg), axisAngle([1, 0, 0], pitchDeg))
    let found = 0
    for (const yaw of [20, 45]) {
      for (const pitch of [10, 20, 30]) {
        for (const dist of [13, 15, 18]) {
          if (diceOverlap(d6(0), d6(dist, 7, 0, yawPitch(yaw, pitch)))) found++
        }
      }
    }
    expect(found).toBeGreaterThan(0)
  })

  it('все кости оседают до лимита (без застывания в полёте)', async () => {
    // Регрессия: большая арена + слабые потери = марафон к бортам до MAX_STEPS,
    // тело удаляется, меш застывает в воздухе с показанным результатом
    const world = await createPhysicsWorld()
    try {
      const failures: string[] = []
      for (const die of ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'] as DieId[]) {
        for (const seed of [3, 17]) {
          const { quat, settled, steps } = await pumpUntilSettled(
            world,
            world.roll(die, {
              random: seeded(seed),
              spawn: { pos: [0, 10, 0] },
            }),
          )
          if (!settled || steps >= 720)
            failures.push(`${die}/${seed}: settled=${settled} steps=${steps}`)
          const v = readRoll(die, quat)
          if (!(v >= 1)) failures.push(`${die}/${seed}: bad value`)
        }
      }
      if (failures.length > 0) console.log('SETTLE FAILURES:', failures.join(' | '))
      expect(failures).toEqual([])
    } finally {
      world.dispose()
    }
  }, 60000)
})
