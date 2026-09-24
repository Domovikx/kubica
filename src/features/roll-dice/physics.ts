// Физический мир броска на cannon-es. Загружается лениво (dynamic import),
// чтобы не раздувать главный бандл (см. PERF.md, STACK.md).
// Тела — ConvexPolyhedron из вершин hull (зеркало body() в SCAD, без скругления EDGE_R:
// для физики достаточно, визуал остаётся точным GLB).
// ВАЖНО: тело строится в кадре МОДЕЛИ (toModelFrame — SCAD Z-up → Y-up):
// меш показывает MODEL-геометрию, и тело обязано лежать ровно там же,
// иначе тело плашмя, а глаз видит вершину, и readout врёт на 90°.
import {
  bodyScale,
  faceNormals,
  normalizedVerts,
  outwardTriangles,
  toModelFrame,
  type DieId,
} from '@/entities/dice-geometry/geometry'
import { ARENA_APOTHEM } from '@/shared/arena/arena'
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

export interface BodyStep {
  pos: [number, number, number]
  quat: [number, number, number, number]
  vel: [number, number, number]
  lin: number
  ang: number
}

export type StepCallback = (step: BodyStep) => void

export interface RollOpts {
  random?: () => number
  /** Сила броска: масштабирует только начальные условия (см. docs/JUICE.md). */
  power?: number
  /** Вызывается каждый подшаг симуляции — витрина ведёт модель по живому телу. */
  onStep?: StepCallback
  /**
   * Спавн оттуда где лежит кость (бесшовный новый бросок без телепорта):
   * тело стартует над точкой с маленьким хопом. Без — компактный спавн по центру.
   * quat — стартовая ориентация (поза из руки/со стола): без телепорта ориентации.
   */
  spawn?: { pos: [number, number, number]; quat?: [number, number, number, number] }
  /**
   * Полуразброс спавна по XZ (витрина 0.5 — кость остаётся в кадре как в лотке;
   * пул — дефолт 2). На честность не влияет (симметрия + RNG).
   */
  area?: number
  /**
   * Направленный флик (мировая XZ-скорость, добавляется к стартовой): свайп
   * по кости наконец честно швыряет — импульс считает солвер, а не скрипт.
   */
  fling?: { x: number; z: number }
  /**
   * Удар о стол/борт силой 0..1 (impact velocity вдоль нормали): витрина стучит
   * громкостью ∝ удару. Без подписчика — тишина (тесты ничего не слышат).
   */
  onCollide?: (intensity: number) => void
}

export interface PhysicsWorld {
  roll: (die: DieId, opts?: RollOpts) => Promise<SettleInfo>
  /** Продвинуть висящие броски по часам (реалтайм: симуляция идёт 1:1 со стеной).
   * Вызывается из rAF-цикла приложения (а не из setTimeout):
   * в фоновых вкладках таймеры заморожены, а rAF и так стоит на паузе —
   * бросок просто ждёт возвращения вкладки, а не виснет.
   * nowMs — часы (для тестов: синтетическое время, детерминировано и быстро);
   * без аргумента — performance.now(). */
  tick: (nowMs?: number) => void
  dispose: () => void
}

const FIXED_STEP = 1 / 120
const STEP_MS = 1000 / 120
/** Кап симуляции за один tick: лаг превращается в слоу-мо, а не в телепорт. */
const MAX_STEPS_PER_TICK = 8
// Лимит 6 с сим-времени: острым d4/d6 нужен мелкий шаг (меньше проникновения
// в контактах — меньше джиттер-подкачка), иначе не селятся никогда
const MAX_STEPS = 720
// Пороги покоя — под видимую незаметность: 0.5 ед/с ≈ 9 px/s на экране,
// глаз остановку не замечает (сон/счётчик обнуляют именно такой микро-полз).
// Ниже нельзя: решатель на острых гранях держит ползучее качение ~0.3–0.7
// (фрикция knife-edge-контактов почти нулевая) — ждать абсолютного нуля
// значит висеть до лимита шагов и застывать в полёте.
const SETTLE_SPEED = 0.5
/** Тихих подшагов до финиша (0.5 с): покачивание успело замереть. */
const SETTLE_STEPS = 30

export const cryptoRandom = (): number => {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] / 0x100000000
}

type Vec3 = [number, number, number]

const vDot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

const qApply = (v: Vec3, q: Quat): Vec3 => {
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

const qFromUnitVectors = (a: Vec3, b: Vec3): Quat => {
  const d = Math.max(-1, Math.min(1, vDot(a, b)))
  const cx = a[1] * b[2] - a[2] * b[1]
  const cy = a[2] * b[0] - a[0] * b[2]
  const cz = a[0] * b[1] - a[1] * b[0]
  const s = Math.sqrt((1 + d) * 2)
  const inv = 1 / s
  return [cx * inv, cy * inv, cz * inv, s / 2]
}

const qMul = (a: Quat, b: Quat): Quat => {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

// Порог доснапа: поворот < 15°, а половина минимального угла между соседними
// нормалями ≥ 20.9° (d20; остальные шире) — верх/низ и исход не меняются.
const SNAP_MIN_DOT = Math.cos((15 * Math.PI) / 180)

/**
 * Доснап до плоской позы: самая нижняя грань — ровно вниз (d4: верхняя вершина —
 * ровно вверх). Лечит застывшие наклоны (тихий порог ловит качание в крайних точках).
 * Кадр модели везде (тело и меш — MODEL): иначе доснап крутит чужую геометрию.
 */
export const snapFlat = (die: DieId, quat: Quat): Quat => {
  const asUnit = (w: Vec3): Vec3 => {
    const l = Math.hypot(w[0], w[1], w[2]) || 1
    return [w[0] / l, w[1] / l, w[2] / l]
  }
  if (die === 'd4') {
    const worlds = normalizedVerts('d4')
      .map((v) => toModelFrame('d4', v))
      .map((v) => qApply(v, quat))
    let best = 0
    let bestY = -Infinity
    worlds.forEach((w, vi) => {
      if (w[1] > bestY) {
        bestY = w[1]
        best = vi
      }
    })
    const wn = asUnit(worlds[best])
    if (wn[1] < SNAP_MIN_DOT) return quat
    return qMul(qFromUnitVectors(wn, [0, 1, 0]), quat)
  }
  const worlds = faceNormals(die)
    .map((n) => toModelFrame(die, n))
    .map((n) => qApply(n, quat))
  let best = 0
  let bestDown = Infinity
  worlds.forEach((w, fi) => {
    if (w[1] < bestDown) {
      bestDown = w[1]
      best = fi
    }
  })
  const wn = asUnit(worlds[best])
  if (-wn[1] < SNAP_MIN_DOT) return quat
  return qMul(qFromUnitVectors(wn, [0, -1, 0]), quat)
}

export const createPhysicsWorld = async (): Promise<PhysicsWorld> => {
  const C = await loadPhysics()
  const world = new C.World({ gravity: new C.Vec3(0, -30, 0) })
  // Сон тел работает только с флагом мира (дефолт false): без него тела
  // микродрожат над тихим порогом до лимита шагов и застывают где попало
  world.allowSleep = true
  // NB: без SAPBroadphase — он ломает коллизии со статическими Plane
  // (тело проваливается сквозь стол). Для горсти тел Naive достаточно.
  // Фетр лотка: держит (трение высокое), стучит глухо (реституция низкая).
  // Арена большая (апофема 26) — энергия обязана гаснуть на фетре за ~2 с,
  // иначе кость марафонит от борта к борту до лимита шагов и застывает в полёте
  world.defaultContactMaterial.friction = 0.6
  world.defaultContactMaterial.restitution = 0.15

  const ground = new C.Body({ mass: 0, shape: new C.Plane() })
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  world.addBody(ground)

  // Шестиугольный загон (апофема ARENA_APOTHEM из shared/arena — тот же лоток,
  // что видит глаз): точная граница hex-лотка, кости не висят в несуществующих углах.
  // Апофема обязана превышать полупоперечник самого крупного тела (d4/d6 ~12
  // от центра!) — иначе клин и «покой» в воздухе.
  // 6 плоскостей, нормали внутрь (та же схема ориентации, что была у квадрата).
  for (let i = 0; i < 6; i++) {
    const theta = (i * Math.PI) / 3
    const nx = Math.cos(theta)
    const nz = Math.sin(theta)
    const wall = new C.Body({ mass: 0, shape: new C.Plane() })
    wall.position.set(nx * ARENA_APOTHEM, 0, nz * ARENA_APOTHEM)
    wall.quaternion.setFromEuler(0, Math.atan2(-nx, -nz), 0)
    world.addBody(wall)
  }

  let disposed = false

  interface Pending {
    body: InstanceType<Cannon['Body']>
    quiet: number
    steps: number
    /** Последняя конечная поза (для отката при NaN-взрыве солвера). */
    lastGood: Quat
    finish: (settled: boolean) => void
    onStep?: StepCallback
  }
  const pending = new Set<Pending>()

  const isFiniteBody = (body: InstanceType<Cannon['Body']>): boolean =>
    Number.isFinite(
      body.position.x +
        body.position.y +
        body.position.z +
        body.velocity.x +
        body.velocity.y +
        body.velocity.z +
        body.angularVelocity.x +
        body.angularVelocity.y +
        body.angularVelocity.z +
        body.quaternion.x +
        body.quaternion.y +
        body.quaternion.z +
        body.quaternion.w,
    )

  // Вязкое сопротивление качению (честная модель фетра): в контакте гасим
  // угловую скорость тормозящим моментом τ = −ω·k (k под инерцию — одинаковый
  // декремент для всех костей). Это СИЛА (интегрируется с констрейнтами),
  // а не внешнее масштабирование скоростей — то рвало катящиеся связи
  // и давало вечное самоподдерживающееся качение. В полёте не действует
  // (кувырок живой), медленное качение душит за доли секунды.
  // Грубый слайд давит фрикция + линейное демпирование (они работают —
  // доказано минимальным репро).
  const ROLL_TORQUE_RATE = 4.5
  /** Скорость, ниже которой фетр хватает (выше — живое движение не трогаем). */
  const ROLL_GRAB_SPEED = 4
  const applyRollResistance = (p: Pending): void => {
    const av = p.body.angularVelocity
    const wx = av.x
    const wy = av.y
    const wz = av.z
    if (wx === 0 && wy === 0 && wz === 0) return
    // Хватаем только медленное: быстрое качение/кувырок — живое, не трогаем
    const v = p.body.velocity
    if (Math.hypot(wx, wy, wz) > ROLL_GRAB_SPEED || Math.hypot(v.x, v.y, v.z) > ROLL_GRAB_SPEED) {
      return
    }
    // Локальная invInertia (константа тела, не протухает); кости почти
    // изотропны — декремент ~3/с по всем осям
    const ie = p.body.invInertia
    // Момент применяется ДО world.step (после шага солвер силы обнуляет)
    p.body.torque.x += (-wx * ROLL_TORQUE_RATE) / Math.max(1e-9, ie.x)
    p.body.torque.y += (-wy * ROLL_TORQUE_RATE) / Math.max(1e-9, ie.y)
    p.body.torque.z += (-wz * ROLL_TORQUE_RATE) / Math.max(1e-9, ie.z)
  }

  // Реалтайм-аккумулятор: симуляция идёт 1:1 со стеной (раньше было 8× ускорение —
  // кость телепортировалась по траектории, отсюда «рваность»). Лаг = слоу-мо.
  // Backlog КАПИМ (иначе простой между бросками превращается в fast-forward
  // всего следующего броска — та же рваность, вид сбоку).
  let lastTick = performance.now()
  let accMs = 0
  const MAX_ACC_MS = STEP_MS * 3

  const stepPending = (p: Pending): void => {
    p.steps++
    if (!isFiniteBody(p.body)) {
      p.finish(false)
      return
    }
    // Тело уснуло (солвер обнулил скорости: тихо как настоящая кость) — финиш.
    // Поза честная (считал солвер), доснап на финише чистит остаток.
    if ((p.body.sleepState as number) === 2) {
      p.onStep?.({
        pos: [p.body.position.x, p.body.position.y, p.body.position.z],
        quat: [p.body.quaternion.x, p.body.quaternion.y, p.body.quaternion.z, p.body.quaternion.w],
        vel: [0, 0, 0],
        lin: 0,
        ang: 0,
      })
      p.finish(true)
      return
    }
    const lin = p.body.velocity.length() as number
    const ang = p.body.angularVelocity.length() as number
    // Последняя конечная поза — страховка от NaN-взрыва (см. finish)
    p.lastGood = [
      p.body.quaternion.x,
      p.body.quaternion.y,
      p.body.quaternion.z,
      p.body.quaternion.w,
    ]
    p.onStep?.({
      pos: [p.body.position.x, p.body.position.y, p.body.position.z],
      quat: [p.body.quaternion.x, p.body.quaternion.y, p.body.quaternion.z, p.body.quaternion.w],
      vel: [p.body.velocity.x, p.body.velocity.y, p.body.velocity.z],
      lin,
      ang,
    })
    p.quiet = lin < SETTLE_SPEED && ang < SETTLE_SPEED ? p.quiet + 1 : 0
    if (p.quiet >= SETTLE_STEPS) p.finish(true)
    else if (p.steps >= MAX_STEPS) p.finish(false)
  }

  const tick = (nowMs?: number) => {
    if (disposed) return
    const now = nowMs ?? performance.now()
    const dt = now - lastTick
    lastTick = now
    // Часы назад/сброс синтетики — не откатываем симуляцию
    if (!(dt > 0)) return
    accMs = Math.min(accMs + Math.min(dt, 60), MAX_ACC_MS)
    let n = 0
    while (accMs >= STEP_MS && n < MAX_STEPS_PER_TICK) {
      accMs -= STEP_MS
      n++
      if (pending.size === 0) continue
      // Сопротивление качению — только контактирующим (в полёте кувырок живой).
      // Контакты читаем до шага (после шага солвер их пересоберёт).
      const touching = new Set<unknown>()
      for (const c of world.contacts as Array<{ bi: unknown; bj: unknown }>) {
        touching.add(c.bi)
        touching.add(c.bj)
      }
      for (const p of [...pending]) {
        if (touching.has(p.body)) applyRollResistance(p)
      }
      try {
        world.step(FIXED_STEP)
      } catch {
        for (const p of [...pending]) p.finish(false)
        break
      }
      for (const p of [...pending]) stepPending(p)
    }
  }

  return {
    roll(die, opts?: RollOpts): Promise<SettleInfo> {
      return new Promise<SettleInfo>((resolve) => {
        if (disposed) {
          resolve({ quat: [0, 0, 0, 1], settled: false, steps: 0 })
          return
        }
        const random = opts?.random ?? cryptoRandom
        const p = Math.max(0.2, opts?.power ?? 1)
        const { verts, tris } = outwardTriangles(die)
        const s = bodyScale(die)
        // Вершины — в кадр модели (см. шапку): тело и меш совпадают 1:1
        const scaled = verts.map(([x, y, z]) => toModelFrame(die, [x * s, y * s, z * s]))
        const shape = new C.ConvexPolyhedron({
          vertices: scaled.map(([x, y, z]) => new C.Vec3(x, y, z)),
          faces: tris,
        })
        // Ограничивающий радиус: спавним целиком над столом, иначе углы
        // стартуют внутри плоскости → солвер уходит в NaN и виснет
        const boundR = Math.max(...scaled.map(([x, y, z]) => Math.hypot(x, y, z))) + 1
        const body = new C.Body({ mass: 1, shape })
        // Демпфирование — ЕДИНСТВЕННЫЙ гаситель (как сила внутри интегратора,
        // с констрейнтами дружит). Внешнее масштабирование скоростей под запретом:
        // оно рвёт катящиеся связи — решатель восстанавливает их с перебором,
        // и получается вечное самоподдерживающееся качение (d4/d6 не селились).
        // Подруливания позы/скорости — тоже нет: всё честно считает солвер,
        // последние градусы чистит доснап на финише (обычно субградус).
        body.linearDamping = 0.1
        body.angularDamping = 0.1
        body.allowSleep = true
        body.sleepSpeedLimit = 0.7
        body.sleepTimeLimit = 0.2
        // Старт низко и близко (витрина): короткий бросок в кадре, а не полёт из-за кадра.
        // Честность — от RNG (BUSINESS.md §6); равномерность граней хранит хаос кувырка.
        // Со спавном (одиночные с витрины): хоп с места покоя — без телепорта.
        const sp = opts?.spawn
        const area = opts?.area ?? 2
        if (sp) {
          // Бесшовный бросок: XZ с места покоя (без телепорта через стол),
          // а высота — с запасом над телом (иначе старт внутри пола = взрыв солвера).
          // Небольшой хоп вверх читается как подброс и добавляет anticipation.
          const clearY = Math.max(sp.pos[1], boundR) + 1 + random() * 1.5
          body.position.set(
            sp.pos[0] + (random() - 0.5) * 2 * area,
            clearY,
            sp.pos[2] + (random() - 0.5) * 2 * area,
          )
        } else {
          body.position.set(
            (random() - 0.5) * 2 * area,
            boundR + 1 + random() * 1.5,
            (random() - 0.5) * 2 * area,
          )
        }
        body.velocity.set(
          (random() - 0.5) * 8 * p + (opts?.fling?.x ?? 0),
          // Хоп с руки — вверх (подброс с читаемым anticipation), падение из
          // центра — вниз. Энергии ровно на живой бросок в пределах лотка.
          sp ? 6 + random() * 2.5 * p : -1 - random() * 2 * p,
          (random() - 0.5) * 8 * p + (opts?.fling?.z ?? 0),
        )
        body.angularVelocity.set(
          (random() - 0.5) * 14 * p,
          (random() - 0.5) * 14 * p,
          (random() - 0.5) * 14 * p,
        )
        // Без телепорта ориентации: с руки/со стола — текущая поза,
        // из центра — случайная (там смотреть не на что)
        if (sp?.quat) {
          body.quaternion.set(sp.quat[0], sp.quat[1], sp.quat[2], sp.quat[3])
        } else {
          body.quaternion.setFromEuler(random() * Math.PI * 2, random() * Math.PI * 2, 0)
        }
        world.addBody(body)
        // Стук — от живых ударов (impact velocity вдоль нормали), а не по таймеру:
        // громкость ∝ удару, как просил глаз. Микро-тычки тише порога молчат.
        if (opts?.onCollide) {
          const onCollide = opts.onCollide
          body.addEventListener('collide', (event: { contact: unknown }) => {
            const contact = event.contact as {
              getImpactVelocityAlongNormal?: () => number
            }
            const impact = Math.abs(contact.getImpactVelocityAlongNormal?.() ?? 0)
            if (impact > 1.5) onCollide(Math.min(1, impact / 15))
          })
        }

        const pendingRoll: Pending = {
          body,
          quiet: 0,
          steps: 0,
          lastGood: [0, 0, 0, 1],
          onStep: opts?.onStep,
          finish: (settled: boolean) => {
            if (!pending.has(pendingRoll)) return
            pending.delete(pendingRoll)
            // NaN-взрыв солвера: тело уже удаляем, витрине отдаём последнюю
            // конечную позу (кость не исчезает, значение читается честно)
            const raw: Quat = isFiniteBody(body)
              ? [body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w]
              : pendingRoll.lastGood
            // Доснап — только мелочь (<2°): крупный наклон оставляем как лёг
            // (честный cocked), иначе телепорт на глазах
            const snapped = snapFlat(die, raw)
            const dot = Math.abs(
              raw[0] * snapped[0] + raw[1] * snapped[1] + raw[2] * snapped[2] + raw[3] * snapped[3],
            )
            const quat = 2 * Math.acos(Math.min(1, dot)) < 0.035 ? snapped : raw
            // ВРЕМЕННО для калибровки: угол до снапа (0 = уже плоский)
            const same =
              Math.abs(quat[0] - raw[0]) +
              Math.abs(quat[1] - raw[1]) +
              Math.abs(quat[2] - raw[2]) +
              Math.abs(quat[3] - raw[3])
            console.log(`[snap] die=${die} changed=${same > 1e-9}`)
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
