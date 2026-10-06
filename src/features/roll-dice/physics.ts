// Физический мир броска на cannon-es. Загружается лениво (dynamic import),
// чтобы не раздувать главный бандл (см. PERF.md, STACK.md).
// Тела — ConvexPolyhedron из вершин hull (зеркало body() в SCAD, без скругления EDGE_R:
// для физики достаточно, визуал остаётся точным GLB).
// ВАЖНО: тело строится в кадре МОДЕЛИ (toModelFrame — SCAD Z-up → Y-up):
// меш показывает MODEL-геометрию, и тело обязано лежать ровно там же,
// иначе тело плашмя, а глаз видит вершину, и readout врёт на 90°.
import {
  bodyRadius,
  bodyScale,
  faceNormals,
  normalizedVerts,
  outwardTriangles,
  toModelFrame,
  type DieId,
} from '@/entities/dice-geometry/geometry'
import { ARENA_APOTHEM, GLASS_HALF_X, GLASS_HALF_Z } from '@/shared/arena/arena'
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
  /**
   * Вертикальный подброс с руки (мировая скорость +Y): стеклянный стол кидает
   * кость вверх от нижней камеры — улетает и возвращается с ударом в стекло.
   * Без — обычный хоп 6..8.5 (верхняя витрина).
   */
  launchUp?: number
  /**
   * Порог сна (дефолт 0.7): ниже — тело засыпает за 0.2 с. Столу выше (1.0):
   * качание на ребре засыпает на медленной фазе вместо вечного маятника;
   * поза читается как обычно, витрина дотягивает (наклон — её работа).
   */
  sleepLimit?: number
  /**
   * Демпфирование тела (линейное = угловое): гаситель внутри интегратора,
   * с констрейнтами дружит (в отличие от масштабирования скоростей).
   * Пачке на большом столе нужно выше (0.3): иначе круглые кости катаются
   * марафон и пачка ждёт самого медленного. На грани не влияет (хаос
   * начальных условий тот же), только короче выкатка.
   */
  damping?: number
  /**
   * Не удалять тело на финише, а оставить статическим препятствием до конца
   * пачки (общий стол): иначе следующая кость пролетит сквозь место осевшей
   * и застынет внутри неё. Одиночки не используют (там тело одно).
   */
  keepStatic?: boolean
  /**
   * Пол по |ω| (рад/с): слабая раскрутка невозможна — античит подгадывания
   * грани слабым вращением. Направление ω не трогаем (оно из потока RNG).
   * Без опции пола нет: витрина/пул держат свой дизайн (точная ось спина).
   */
  minAngular?: number
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

/**
 * Центр спавна не ближе r+0.5 к прямому борту: спавн вклинивается в стену
 * (клин — «покой в воздухе» и выдавливание, т.е. слабая раскрутка от
 * солвера). Симметричный клэмп — честность (RNG поток не меняется).
 */
const clampSpan = (v: number, half: number, r: number): number => {
  const span = half - r - 0.5
  return span <= 0 ? 0 : Math.max(-span, Math.min(span, v))
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

/**
 * Границы арены: hex — шестиугольный лоток (6 плоскостей по ARENA_APOTHEM),
 * rect — условные прямоугольные невидимые границы стеклянного стола
 * (4 плоскости; размеры по умолчанию — под 1–2 кости, под пачку шире:
 * см. glassHalves). Плоскости бесконечные: перелетевшая через край кость
 * всё равно остаётся внутри.
 */
export interface DicePose {
  die: DieId
  pos: Vec3
  quat: Quat
}

/**
 * Пересечение полнотелых костей — комбинация двух тестов (у каждого слепая
 * зона, вместе закрывают всё):
 * - глубоко (центры ближе 0.9 суммы инрадиусов): одного этого достаточно
 *   (соосные кубы вершинами касаются плоскостей ровно — вершинный тест их
 *   не видит, а дистанция ловит);
 * - иначе — вершина одного тела строго внутри другого (грани у нас плоские,
 *   тест точный; касание грань-в-грань не считается).
 * margin — допуск на просадку контактов солвера.
 */
export const diceOverlap = (a: DicePose, b: DicePose, margin = 0.2): boolean => {
  const dx = a.pos[0] - b.pos[0]
  const dy = a.pos[1] - b.pos[1]
  const dz = a.pos[2] - b.pos[2]
  const distSq = dx * dx + dy * dy + dz * dz
  const inRSum = bodyScale(a.die) + bodyScale(b.die)
  if (distSq < (0.9 * inRSum) ** 2) return true
  // Быстрый отказ по ограничивающим сферам.
  if (distSq >= (bodyRadius(a.die) + bodyRadius(b.die)) ** 2) {
    return false
  }
  return vertsInside(a, b, margin) || vertsInside(b, a, margin)
}

const vertsInside = (p: DicePose, q: DicePose, margin: number): boolean => {
  const inR = bodyScale(q.die)
  const sP = bodyScale(p.die)
  const wns = faceNormals(q.die)
    .map((n) => toModelFrame(q.die, n))
    .map((n) => qApply(n, q.quat))
  for (const v of normalizedVerts(p.die)) {
    const vm = toModelFrame(p.die, v)
    const scaled: Vec3 = [vm[0] * sP, vm[1] * sP, vm[2] * sP]
    const w = qApply(scaled, p.quat)
    const rx = p.pos[0] + w[0] - q.pos[0]
    const ry = p.pos[1] + w[1] - q.pos[1]
    const rz = p.pos[2] + w[2] - q.pos[2]
    let inside = true
    for (const n of wns) {
      if (n[0] * rx + n[1] * ry + n[2] * rz >= inR - margin) {
        inside = false
        break
      }
    }
    if (inside) return true
  }
  return false
}

export const createPhysicsWorld = async (opts?: {
  bounds?: 'hex' | 'rect' | { hx: number; hz: number }
  /** Фетр стола: трение и реституция (дефолт — живой лоток 0.6/0.15). */
  felt?: { friction?: number; restitution?: number }
  /**
   * Хватка качения (дефолт 4.5/4): тормозной момент медленного качения.
   * Столу под пачку — жёстче: круглые докатываются быстрее. Полёт не
   * трогает (только контакт), грани не смещает (декремент от скорости).
   */
  roll?: { rate?: number; grab?: number }
  /**
   * Тяга фетра (дефолт выкл): линейный спад скорости в контакте (rate/с),
   * только ниже grab. Душит медленное качение/слайд, которых момент
   * не берёт (солвер подкачивает обратно в связку качения). Полёт чистый
   * (контакта нет), направление не меняет (чистый сток энергии).
   */
  drag?: { rate?: number; grab?: number }
}): Promise<PhysicsWorld> => {
  const C = await loadPhysics()
  const world = new C.World({ gravity: new C.Vec3(0, -30, 0) })
  // Сон тел работает только с флагом мира (дефолт false): без него тела
  // микродрожат над тихим порогом до лимита шагов и застывают где попало
  world.allowSleep = true
  // NB: без SAPBroadphase — он ломает коллизии со статическими Plane
  // (тело проваливается сквозь стол). Для горсти тел Naive достаточно.
  // Фетр лотка: держит (трение высокое), стучит глухо (реституция низкая).
  // Арена большая (апофема 26) — энергия обязана гаснуть на фетре за ~2 с,
  // иначе кость марафонит от борта к борту до лимита шагов и застывает в полёте.
  // Столу под пачку — фетр глуше (меньше отскок/выкатка круглых), полёт
  // не трогаем (баллистика от контактных параметров не зависит).
  world.defaultContactMaterial.friction = opts?.felt?.friction ?? 0.6
  world.defaultContactMaterial.restitution = opts?.felt?.restitution ?? 0.15

  const ground = new C.Body({ mass: 0, shape: new C.Plane() })
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  world.addBody(ground)

  // Шестиугольный загон (апофема ARENA_APOTHEM из shared/arena — тот же лоток,
  // что видит глаз): точная граница hex-лотка, кости не висят в несуществующих углах.
  // Апофема обязана превышать полупоперечник самого крупного тела (d4/d6 ~12
  // от центра!) — иначе клин и «покой» в воздухе.
  // 6 плоскостей, нормали внутрь (та же схема ориентации, что была у квадрата).
  // rect: 4 плоскости прямоугольника — невидимые границы стекла.
  // Явные {hx, hz} — стол под конкретную пачку (шире при большем N).
  const bounds = opts?.bounds ?? 'hex'
  const rectHx = typeof bounds === 'object' ? bounds.hx : bounds === 'rect' ? GLASS_HALF_X : 0
  const rectHz = typeof bounds === 'object' ? bounds.hz : bounds === 'rect' ? GLASS_HALF_Z : 0
  if (bounds !== 'hex') {
    const walls: Array<{ nx: number; nz: number; px: number; pz: number }> = [
      { nx: 1, nz: 0, px: rectHx, pz: 0 },
      { nx: -1, nz: 0, px: -rectHx, pz: 0 },
      { nx: 0, nz: 1, px: 0, pz: rectHz },
      { nx: 0, nz: -1, px: 0, pz: -rectHz },
    ]
    for (const wdef of walls) {
      const wall = new C.Body({ mass: 0, shape: new C.Plane() })
      wall.position.set(wdef.px, 0, wdef.pz)
      wall.quaternion.setFromEuler(0, Math.atan2(-wdef.nx, -wdef.nz), 0)
      world.addBody(wall)
    }
  } else {
    for (let i = 0; i < 6; i++) {
      const theta = (i * Math.PI) / 3
      const nx = Math.cos(theta)
      const nz = Math.sin(theta)
      const wall = new C.Body({ mass: 0, shape: new C.Plane() })
      wall.position.set(nx * ARENA_APOTHEM, 0, nz * ARENA_APOTHEM)
      wall.quaternion.setFromEuler(0, Math.atan2(-nx, -nz), 0)
      world.addBody(wall)
    }
  }

  let disposed = false

  interface Pending {
    body: InstanceType<Cannon['Body']>
    die: DieId
    /** Мировой инрадиус тела (полвысота покоя плашмя; мера перекрытия). */
    restR: number
    random: () => number
    quiet: number
    /** Подшагов подряд в пересечении (марафон стопки — растащить). */
    nearSteps: number
    steps: number
    /** Последняя конечная поза (для отката при NaN-взрыве солвера). */
    lastGood: Quat
    finish: (settled: boolean) => void
    onStep?: StepCallback
  }
  const pending = new Set<Pending>()
  /** Осевшие тела пачки (статика): живые обязаны их огибать, а не входить. */
  const statics = new Set<{
    body: InstanceType<Cannon['Body']>
    die: DieId
    restR: number
    boundR: number
  }>()

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
  const ROLL_TORQUE_RATE = opts?.roll?.rate ?? 4.5
  /** Скорость, ниже которой фетр хватает (выше — живое движение не трогаем). */
  const ROLL_GRAB_SPEED = opts?.roll?.grab ?? 4
  const DRAG_RATE = opts?.drag?.rate ?? 0
  const DRAG_GRAB_SPEED = opts?.drag?.grab ?? 3
  const applyFeltDrag = (p: Pending): void => {
    if (DRAG_RATE <= 0) return
    const v = p.body.velocity
    if (Math.hypot(v.x, v.y, v.z) >= DRAG_GRAB_SPEED) return
    const k = Math.max(0, 1 - DRAG_RATE * FIXED_STEP)
    v.x *= k
    v.y *= k
    v.z *= k
  }
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

  const bodyPos = (body: InstanceType<Cannon['Body']>): { x: number; y: number; z: number } => ({
    x: body.position.x,
    y: body.position.y,
    z: body.position.z,
  })

  const bodyQuat = (p: Pending): Quat => [
    p.body.quaternion.x,
    p.body.quaternion.y,
    p.body.quaternion.z,
    p.body.quaternion.w,
  ]

  /**
   * Опора под телом: участвует в контактах текущего подшага (пол, стена,
   * другая кость). Покой = опора + тишина, высота не важна (стопка легальна).
   * Сон/тишина в воздухе без опоры — не покой (вершина подброса, вис).
   */
  const hasSupport = (p: Pending, touching: Set<unknown>): boolean => touching.has(p.body)

  interface Overlap {
    body: InstanceType<Cannon['Body']>
    restR: number
    /** Живой сосед (статика не двигается и не будится — её только огибают). */
    live: Pending | null
  }

  /**
   * Геометрические пересечения с соседями (кость в кости): точный тест
   * diceOverlap (вершина внутри тела), а не оценка по сферам — угловые
   * зацепы ловятся, касания грань-в-грань пропускаются. Без учёта скоростей —
   * пролёт тоже считается (фильтр тишины — отдельно, в ветках покоя).
   */
  const closeBodies = (p: Pending): Overlap[] => {
    const out: Overlap[] = []
    const pa = bodyPos(p.body)
    const pose: DicePose = {
      die: p.die,
      pos: [pa.x, pa.y, pa.z],
      quat: bodyQuat(p),
    }
    for (const q of pending) {
      if (q === p) continue
      const b = bodyPos(q.body)
      if (
        diceOverlap(pose, {
          die: q.die,
          pos: [b.x, b.y, b.z],
          quat: bodyQuat(q),
        })
      ) {
        out.push({ body: q.body, restR: q.restR, live: q })
      }
    }
    for (const s of statics) {
      const b = bodyPos(s.body)
      const bq = s.body.quaternion
      if (
        diceOverlap(pose, {
          die: s.die,
          pos: [b.x, b.y, b.z],
          quat: [bq.x, bq.y, bq.z, bq.w],
        })
      ) {
        out.push({ body: s.body, restR: s.restR, live: null })
      }
    }
    return out
  }

  /** Тихое пересечение: сосед тоже тих (быстрое касание в пролёте — норма). */
  const findOverlap = (p: Pending): Overlap | null => {
    for (const o of closeBodies(p)) {
      if (o.live === null) return o
      const sleeping = (o.live.body.sleepState as number) === 2
      const lin = o.live.body.velocity.length() as number
      const ang = o.live.body.angularVelocity.length() as number
      if (sleeping || (lin < 1 && ang < 1)) return o
    }
    return null
  }

  /**
   * Растащить пересечение: тихоню отпихиваем по XZ от занятого места
   * (стопка строго вертикально — в случайную сторону), живого соседа тоже
   * будим. Дальше решает солвер.
   * Только скорость (без телепорта позы): позиционный сдвиг 6 давал взрыв
   * депенетрации на живых скоростях (замер: power 0.8 → Y=578, power 1 → Y=314).
   * Глубокое вдавливание на тихих скоростях солвер держит, но тихий пинок 4/2.5
   * за несколько заходов выводит (ретрай в table-roll — страховка для пат-кейса
   * «прямо сверху в угол с малой силой»).
   */
  const separateBodies = (p: Pending, other: Overlap): void => {
    const a = bodyPos(p.body)
    const b = bodyPos(other.body)
    let dx = a.x - b.x
    let dz = a.z - b.z
    if (Math.hypot(dx, dz) < 1e-3) {
      const t = p.random() * Math.PI * 2
      dx = Math.cos(t)
      dz = Math.sin(t)
    }
    const l = Math.hypot(dx, dz) || 1
    p.body.wakeUp()
    p.body.velocity.set((dx / l) * 4, 2.5, (dz / l) * 4)
    p.quiet = 0
    p.nearSteps = 0
    if (other.live) {
      other.live.body.wakeUp()
      other.live.quiet = 0
      other.live.nearSteps = 0
    }
  }

  const stepPending = (p: Pending, touchingNow: Set<unknown>): void => {
    p.steps++
    if (!isFiniteBody(p.body)) {
      p.finish(false)
      return
    }
    // Тело уснуло (солвер обнулил скорости: тихо как настоящая кость).
    // Пересечение — первым делом (уснувший внутри соседа иначе вечно
    // будится/засыпает на месте: контакт держит, гравитация не сдвигает).
    // Сон без опоры (вершина подброса) — не покой: будим и летим дальше.
    if ((p.body.sleepState as number) === 2) {
      const overlap = findOverlap(p)
      if (overlap) {
        if (p.steps > MAX_STEPS - 60) {
          p.finish(false)
          return
        }
        separateBodies(p, overlap)
        return
      }
      if (!hasSupport(p, touchingNow)) {
        p.body.wakeUp()
        p.quiet = 0
        return
      }
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
    // Затяжное пересечение (стопка трётся дольше ~0.75 с сим-времени): растащить
    // принудительно, при любых скоростях, — иначе марафон без финиша.
    // Счётчик с гистерезисом (фликер границы не обнуляет): пролётные касания
    // сюда не попадают (доли секунды). Порог 90, а не 240: качающаяся на ребре
    // стопка тихо по lin, но ang > порога — quiet-ветка её не ловит, и к
    // MAX-60 (660) мы приходили с зависшим пересечением и сдавались.
    if (closeBodies(p).length > 0) {
      p.nearSteps++
      if (p.nearSteps > 90) {
        p.nearSteps = 0
        if (p.steps > MAX_STEPS - 60) {
          p.finish(false)
          return
        }
        const stuck = closeBodies(p)[0]
        if (stuck) separateBodies(p, stuck)
        return
      }
    } else if (p.nearSteps > 0) {
      p.nearSteps--
    }
    p.quiet = lin < SETTLE_SPEED && ang < SETTLE_SPEED ? p.quiet + 1 : 0
    if (p.quiet >= SETTLE_STEPS) {
      // Пересечение — первым делом (зависший внахлёст тихо, но не покой).
      const overlap = findOverlap(p)
      if (overlap) {
        if (p.steps > MAX_STEPS - 60) {
          p.finish(false)
          return
        }
        separateBodies(p, overlap)
        return
      }
      // Тишина в воздухе без опоры (вершина подброса) — не покой, ждём падения.
      if (!hasSupport(p, touchingNow)) {
        p.quiet = 0
        return
      }
      p.finish(true)
      return
    }
    if (p.steps >= MAX_STEPS) p.finish(false)
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
        if (touching.has(p.body)) {
          applyRollResistance(p)
          applyFeltDrag(p)
        }
      }
      try {
        world.step(FIXED_STEP)
      } catch {
        for (const p of [...pending]) p.finish(false)
        break
      }
      // Контакты после шага — свежие: по ним определяем опору под телом.
      const touchingNow = new Set<unknown>()
      for (const c of world.contacts as Array<{ bi: unknown; bj: unknown }>) {
        touchingNow.add(c.bi)
        touchingNow.add(c.bj)
      }
      for (const p of [...pending]) stepPending(p, touchingNow)
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
        const damping = opts?.damping ?? 0.1
        body.linearDamping = damping
        body.angularDamping = damping
        body.allowSleep = true
        body.sleepSpeedLimit = opts?.sleepLimit ?? 0.7
        body.sleepTimeLimit = 0.2
        // Старт низко и близко (витрина): короткий бросок в кадре, а не полёт из-за кадра.
        // Честность — от RNG (BUSINESS.md §6); равномерность граней хранит хаос кувырка.
        // Со спавном (одиночные с витрины): хоп с места покоя — без телепорта.
        // ВАЖНО: порядок random() ниже — как в оригинале ([rY, px, pz] со спавном,
        // [px, rY, pz] без): сиды детерминированных тестов обязаны давать те же потоки.
        const sp = opts?.spawn
        const area = opts?.area ?? 2
        // Нижняя полувысота в стартовой ориентации (для зазора над статикой —
        // точнее ограничивающего радиуса; без кватерниона — он сам).
        const spawnQuat = sp?.quat
        let halfDown = boundR
        if (spawnQuat) {
          let minY = Infinity
          for (const v of scaled) {
            const w = qApply(v, [spawnQuat[0], spawnQuat[1], spawnQuat[2], spawnQuat[3]])
            if (w[1] < minY) minY = w[1]
          }
          halfDown = -minY + 1
        }
        // Зазор над осевшей статикой в пятне спавна: старт в контакте даёт взрыв
        // депенетрации (скорости под 100+ ед/с) и пинболл до таймаута.
        // Пустые миры одиночек скан не замечают (statics пуст — ноль поведения,
        // потоки random бит-в-бит как раньше).
        const clearAt = (px: number, pz: number): number => {
          let top = -Infinity
          for (const st of statics) {
            const sb = bodyPos(st.body)
            if (Math.hypot(px - sb.x, pz - sb.z) < boundR + st.restR + 2) {
              top = Math.max(top, sb.y + st.boundR)
            }
          }
          return top
        }
        if (sp) {
          // Бесшовный бросок: XZ с места покоя (без телепорта через стол),
          // а высота — с запасом над телом (иначе старт внутри пола = взрыв солвера).
          // Небольшой хоп вверх читается как подброс и добавляет anticipation.
          const rY = random()
          const px = sp.pos[0] + (random() - 0.5) * 2 * area
          const pz = sp.pos[2] + (random() - 0.5) * 2 * area
          // Борт ближе boundR — спавн внутри стены (клин зависает в воздухе
          // и выдавливается со слабой раскруткой): держим просвет.
          const sx = rectHx > 0 ? clampSpan(px, rectHx, boundR) : px
          const sz = rectHz > 0 ? clampSpan(pz, rectHz, boundR) : pz
          const clearY = Math.max(sp.pos[1], boundR, clearAt(sx, sz) + halfDown + 1) + 1 + rY * 1.5
          body.position.set(sx, clearY, sz)
        } else {
          const px = (random() - 0.5) * 2 * area
          const rY = random()
          const pz = (random() - 0.5) * 2 * area
          const clearY = Math.max(boundR, clearAt(px, pz) + halfDown + 1) + 1 + rY * 1.5
          body.position.set(px, clearY, pz)
        }
        body.velocity.set(
          (random() - 0.5) * 8 * p + (opts?.fling?.x ?? 0),
          // Хоп с руки — вверх (подброс с читаемым anticipation), падение из
          // центра — вниз. Энергии ровно на живой бросок в пределах лотка.
          // launchUp (стекло): швырок вверх от нижней камеры — кость улетает
          // и возвращается с ударом в стекло; высота ~v²/60 (26 ≈ высота кости).
          sp ? (opts?.launchUp ?? 6 + random() * 2.5 * p) : -1 - random() * 2 * p,
          (random() - 0.5) * 8 * p + (opts?.fling?.z ?? 0),
        )
        // Порядок random() бит-в-бит как раньше ([x, y, z] слева направо) —
        // сиды детерминированных тестов не съезжают.
        const wx = (random() - 0.5) * 14 * p
        const wy = (random() - 0.5) * 14 * p
        const wz = (random() - 0.5) * 14 * p
        body.angularVelocity.set(wx, wy, wz)
        // Ориентация: с руки (витрина) — текущая поза, с инспекции/центра —
        // случайная. Стол позу юзера не отдаёт (античит подгадывания через
        // drag-поворот кости).
        if (sp?.quat) {
          body.quaternion.set(sp.quat[0], sp.quat[1], sp.quat[2], sp.quat[3])
        } else {
          body.quaternion.setFromEuler(random() * Math.PI * 2, random() * Math.PI * 2, 0)
        }
        // Пол |ω| (античит): слабая раскрутка невозможна (|ω| ≥ wmin).
        // При срабатывании пола направление ПЕРЕБРАСЫВАЕМ заново (равновероятно),
        // а не масштабируем старое: условие wl<wmin срезало бы «неугловые»
        // направления куба и связало их с усиленной |ω| → биас граней {1,6}
        // (читер-бот, пул N=960: χ²=31.9 против χ²=5.5 без пола). Величина с
        // джиттером ≥ wmin (константа тоже биасила). Поток random() здесь
        // сдвигается (4 draws), но только при передаче minAngular — сид-тесты
        // пол не передают, бит-в-бит поток цел.
        const wmin = opts?.minAngular ?? 0
        if (wmin > 0) {
          const wl = Math.hypot(wx, wy, wz)
          if (wl < wmin) {
            const ax = random() * 2 - 1
            const ay = random() * 2 - 1
            const az = random() * 2 - 1
            const al = Math.hypot(ax, ay, az)
            const mag = wmin * (1 + random() * 0.5)
            if (al > 1e-6) {
              body.angularVelocity.set((ax * mag) / al, (ay * mag) / al, (az * mag) / al)
            } else {
              body.angularVelocity.set(mag, 0, 0)
            }
          }
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
          die,
          restR: bodyScale(die),
          random,
          quiet: 0,
          nearSteps: 0,
          steps: 0,
          lastGood: [0, 0, 0, 1],
          onStep: opts?.onStep,
          finish: (settled: boolean) => {
            if (!pending.has(pendingRoll)) return
            pending.delete(pendingRoll)
            // Опора могла исчезнуть (стояли на удаляемом теле): будим остальных,
            // иначе останутся спать в воздухе.
            for (const q of pending) {
              q.body.wakeUp()
              q.quiet = 0
            }
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
            if (opts?.keepStatic) {
              // Пачка: осевшая кость остаётся статическим препятствием до конца
              // броска — живые обязаны огибать её, а не застывать внутри.
              // Мир на бросок чистится целиком (см. table-roll).
              body.type = C.Body.STATIC
              body.mass = 0
              body.updateMassProperties()
              body.velocity.set(0, 0, 0)
              body.angularVelocity.set(0, 0, 0)
              statics.add({ body, die, restR: pendingRoll.restR, boundR })
            } else {
              world.removeBody(body)
            }
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
      statics.clear()
    },
  }
}
