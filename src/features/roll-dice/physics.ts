// Физический мир броска на cannon-es. Загружается лениво (dynamic import),
// чтобы не раздувать главный бандл (см. PERF.md, STACK.md).
// Тела — ConvexPolyhedron из вершин hull (зеркало body() в SCAD, без скругления EDGE_R:
// для физики достаточно, визуал остаётся точным GLB).
import { bodyScale, outwardTriangles, type DieId } from '@/entities/dice-geometry/geometry'
import type { Quat } from './readout'

type Cannon = typeof import('cannon-es')

let cannonPromise: Promise<Cannon> | null = null

export const loadPhysics = (): Promise<Cannon> => {
  if (!cannonPromise) cannonPromise = import('cannon-es')
  return cannonPromise
}

export interface SettleInfo {
  quat: Quat
  /** true — тело успокоилось до лимита шагов; false — вернули как есть по таймауту */
  settled: boolean
  steps: number
}

export interface PhysicsWorld {
  roll: (die: DieId, random?: () => number) => Promise<SettleInfo>
  /** Продвинуть все висящие броски на несколько подшагов.
   * Вызывается из rAF-цикла приложения (а не из setTimeout):
   * в фоновых вкладках таймеры заморожены, а rAF и так стоит на паузе —
   * бросок просто ждёт возвращения вкладки, а не виснет. */
  tick: () => void
  dispose: () => void
}

const FIXED_STEP = 1 / 60
const MAX_STEPS = 600
const SETTLE_SPEED = 0.5
const SETTLE_STEPS = 30
/** Подшагов симуляции за один tick (кадр): бросок оседает за ~1–2 с реалтайма. */
const SUBSTEPS_PER_TICK = 8

export const cryptoRandom = (): number => {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] / 0x100000000
}

export const createPhysicsWorld = async (): Promise<PhysicsWorld> => {
  const C = await loadPhysics()
  const world = new C.World({ gravity: new C.Vec3(0, -30, 0) })
  // NB: без SAPBroadphase — он ломает коллизии со статическими Plane
  // (тело проваливается сквозь стол). Для горсти тел Naive достаточно.
  world.defaultContactMaterial.friction = 0.25
  world.defaultContactMaterial.restitution = 0.35

  const ground = new C.Body({ mass: 0, shape: new C.Plane() })
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  world.addBody(ground)

  // Стены-невидимки: кость не улетает со стола (размер под d20 с запасом)
  const wallDefs: Array<[number, number, number, number, number, number]> = [
    [0, 0, -14, 0, 0, 0],
    [0, 0, 14, 0, 0, 0],
    [-14, 0, 0, 0, 0, 0],
    [14, 0, 0, 0, 0, 0],
  ]
  for (const [x, y, z] of wallDefs) {
    const wall = new C.Body({ mass: 0, shape: new C.Plane() })
    wall.position.set(x, y, z)
    wall.quaternion.setFromEuler(0, Math.atan2(-x, -z), 0)
    world.addBody(wall)
  }

  let disposed = false

  interface Pending {
    body: InstanceType<Cannon['Body']>
    quiet: number
    steps: number
    finish: (settled: boolean) => void
  }
  const pending = new Set<Pending>()

  const isFiniteBody = (body: InstanceType<Cannon['Body']>): boolean =>
    Number.isFinite(body.position.x + body.position.y + body.position.z) &&
    Number.isFinite(body.velocity.x + body.velocity.y + body.velocity.z)

  const tick = () => {
    if (disposed) return
    for (const p of [...pending]) {
      for (let k = 0; k < SUBSTEPS_PER_TICK; k++) {
        if (!pending.has(p)) break
        try {
          world.step(FIXED_STEP)
        } catch {
          p.finish(false)
          break
        }
        p.steps++
        if (!isFiniteBody(p.body)) {
          p.finish(false)
          break
        }
        const lin = p.body.velocity.length() as number
        const ang = p.body.angularVelocity.length() as number
        p.quiet = lin < SETTLE_SPEED && ang < SETTLE_SPEED ? p.quiet + 1 : 0
        if (p.quiet >= SETTLE_STEPS) p.finish(true)
        else if (p.steps >= MAX_STEPS) p.finish(false)
      }
    }
  }

  return {
    roll(die, random = cryptoRandom): Promise<SettleInfo> {
      return new Promise<SettleInfo>((resolve) => {
        if (disposed) {
          resolve({ quat: [0, 0, 0, 1], settled: false, steps: 0 })
          return
        }
        const { verts, tris } = outwardTriangles(die)
        const s = bodyScale(die)
        const scaled = verts.map(([x, y, z]) => [x * s, y * s, z * s] as const)
        const shape = new C.ConvexPolyhedron({
          vertices: scaled.map(([x, y, z]) => new C.Vec3(x, y, z)),
          faces: tris,
        })
        // Ограничивающий радиус: спавним целиком над столом, иначе углы
        // стартуют внутри плоскости → солвер уходит в NaN и виснет
        const boundR = Math.max(...scaled.map(([x, y, z]) => Math.hypot(x, y, z))) + 1
        const body = new C.Body({ mass: 1, shape })
        // Старт над столом со случайным импульсом (честность — от RNG, см. BUSINESS.md §6)
        body.position.set((random() - 0.5) * 8, boundR + 4 + random() * 6, (random() - 0.5) * 8)
        body.velocity.set((random() - 0.5) * 16, -2 - random() * 4, (random() - 0.5) * 16)
        body.angularVelocity.set(
          (random() - 0.5) * 24,
          (random() - 0.5) * 24,
          (random() - 0.5) * 24,
        )
        body.quaternion.setFromEuler(random() * Math.PI * 2, random() * Math.PI * 2, 0)
        world.addBody(body)

        const pendingRoll: Pending = {
          body,
          quiet: 0,
          steps: 0,
          finish: (settled: boolean) => {
            if (!pending.has(pendingRoll)) return
            pending.delete(pendingRoll)
            const quat: Quat = [
              body.quaternion.x,
              body.quaternion.y,
              body.quaternion.z,
              body.quaternion.w,
            ]
            world.removeBody(body)
            resolve({ quat, settled, steps: pendingRoll.steps })
          },
        }
        pending.add(pendingRoll)
      })
    },
    tick,
    dispose() {
      disposed = true
      pending.clear()
    },
  }
}
