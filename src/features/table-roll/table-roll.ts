// Бросок пачкой на общем столе: все кости в одном физическом мире,
// кувыркаются вместе (тела сталкиваются — честная горсть). Чтение — снизу:
// грань на столе (д6), верхняя-на-экране вершина (д4). Результат — суммой
// с частями в одну запись истории и один поп (паттерн пула 2.3).
import type { DieId, Vec3 } from '@/entities/dice-geometry/geometry'
import type { PoolPart } from '@/entities/roll-history/history'
import { formatLabel, getHistoryStore } from '@/entities/roll-history/history'
import {
  createPhysicsWorld,
  type PhysicsWorld,
  type StepCallback,
} from '@/features/roll-dice/physics'
import {
  displayValue,
  readBottomRoll,
  resolveD4Below,
  scoreValue,
  type Quat,
} from '@/features/roll-dice/readout'
import { hideResult, showResult } from '@/shared/ui/result-pop'

export interface TableDieRequest {
  /** Ключ инстанса (`d6#1`): маршрутизация синхры/презентации при дублях. */
  key: string
  die: DieId
  spawnPos: [number, number, number]
  spawnQuat?: [number, number, number, number]
  power?: number
  launchUp?: number
  damping?: number
  sleepLimit?: number
  fling?: { x: number; z: number }
}

export interface TableDieResult {
  key: string
  die: DieId
  value: number
  display: string
  quat: Quat
  settled: boolean
  /** Шагов симуляции (диагностика долгих посадок). */
  steps: number
}

export interface TableRollCallbacks {
  /** key — инстанс (`d6#1`): при дублях одного типа маршрутизация только по нему. */
  onStep?: (key: string, die: DieId, step: Parameters<StepCallback>[0]) => void
  onCollide?: (die: DieId, intensity: number) => void
  /** Верх экрана в мировых осях (для правила д4; см. screenUpWorld). */
  screenUp?: Vec3
}

const DEFAULT_SCREEN_UP: Vec3 = [0, 0, 1]

/**
 * Разыграть пачку в мире (порядок результатов = порядку запросов;
 * Promise.all порядок сохраняет, конкурентные тела живут в одном мире).
 */
export const rollTableDice = async (
  world: PhysicsWorld,
  reqs: readonly TableDieRequest[],
  cbs?: TableRollCallbacks,
): Promise<TableDieResult[]> => {
  const screenUp = cbs?.screenUp ?? DEFAULT_SCREEN_UP
  return Promise.all(
    reqs.map(async (req): Promise<TableDieResult> => {
      const { quat, settled, steps } = await world.roll(req.die, {
        power: req.power ?? 1,
        launchUp: req.launchUp,
        damping: req.damping,
        sleepLimit: req.sleepLimit,
        fling: req.fling,
        area: 0.5,
        // Осевшие остаются статикой до конца пачки: место занято, живые огибают.
        keepStatic: true,
        spawn: { pos: req.spawnPos, quat: req.spawnQuat },
        onStep: cbs?.onStep ? (step) => cbs.onStep?.(req.key, req.die, step) : undefined,
        onCollide: cbs?.onCollide ? (i) => cbs.onCollide?.(req.die, i) : undefined,
      })
      // д4: значение — от финальной позы пайплайна (доснап + yaw), иначе поп
      // и витрина разъедутся на пограничных доворотах (см. resolveD4Below).
      const value =
        req.die === 'd4' ? resolveD4Below(quat, screenUp).value : readBottomRoll(req.die, quat)
      return {
        key: req.key,
        die: req.die,
        value,
        display: req.die === 'd4' ? String(value) : displayValue(req.die, value),
        quat,
        settled,
        steps,
      }
    }),
  )
}

export interface TableLabelled {
  label: string
  total: number
  parts: PoolPart[]
}

/**
 * Сумма + части + лейбл (pure, без DOM): поп и история — из этого.
 * Подряд идущие дубли сворачиваются: [д6, д6, д4] → «2d6+д4».
 * (Латиница d-нотации: парсер/пул понимают только её.)
 */
export const labelTableResult = (results: readonly TableDieResult[]): TableLabelled => {
  const parts: PoolPart[] = results.map((r) => ({
    die: r.die,
    value: r.value,
    display: r.display,
    kept: true,
  }))
  const groups: Array<{ die: DieId; n: number }> = []
  for (const r of results) {
    const last = groups[groups.length - 1]
    if (last && last.die === r.die) last.n++
    else groups.push({ die: r.die, n: 1 })
  }
  return {
    label: groups.map((g) => (g.n > 1 ? `${g.n}${g.die}` : g.die)).join('+'),
    // Итог по scoreValue (d10: грань «0» = 10), иначе красная сумма в шапке
    // разойдётся с футером/историей — там печатается display (см. scoreValue).
    total: parts.reduce((sum, p) => sum + scoreValue(p.die, p.value), 0),
    parts,
  }
}

/**
 * Одна запись истории + один поп с частями (паттерн пула 2.3).
 * opts.pop=false — без попа (стол итог не показывает, только озвучивает SR).
 */
export const commitTableResult = (
  results: readonly TableDieResult[],
  labelled: TableLabelled,
  opts?: { pop?: boolean },
): void => {
  if (results.length === 0) return
  getHistoryStore().add({
    die: results[0].die,
    value: labelled.total,
    display: String(labelled.total),
    at: Date.now(),
    label: labelled.label,
    parts: labelled.parts,
  })
  if (opts?.pop === false) {
    hideResult()
    return
  }
  showResult(formatLabel(labelled.label), String(labelled.total), undefined, labelled.parts)
}

/** Внутренний прямоугольник канвы под раскладку (px): канва минус отступы. */
export interface LayoutRect {
  w: number
  h: number
}

export interface LayoutPlan {
  /** Шаг ячейки (px) — квадрат, в который вписывается кость с запасом. */
  cell: number
  cols: number
  rows: number
  /** Центры ячеек: px от центра rect, y вниз (экранная ориентация). */
  slots: Array<{ x: number; y: number }>
}

/** Потолок ячейки (px): одиночная кость не разливается на весь экран. */
const MAX_CELL_PX = 360

/**
 * Рациональное деление канвы на n костей (pure): inner-прямоугольник rect
 * (px) → сетка cols×rows квадратных ячеек (шаг по обеим осям, повёрнутый
 * ромб влезает с запасом). Кандидаты cols = 1..n, rows = ⌈n/cols⌉, ячейка
 * = min(w/cols, h/rows) с потолком opts.maxCell. Выбираем наибольшую
 * ячейку — кости занимают отведённое место целиком; при равенстве — меньше
 * пустых ячеек, затем пропорция сетки ближе к пропорции rect (широкий кадр
 * вырождается в ряд, портретный — в колонку). Слоты читаются сверху вниз,
 * последний ряд центрируется. n ≤ 0 → пустая раскладка (cell — под камеру
 * пустого стола).
 */
export const layoutSlots = (
  n: number,
  rect: LayoutRect,
  opts?: { maxCell?: number },
): LayoutPlan => {
  const w = Math.max(1, rect.w)
  const h = Math.max(1, rect.h)
  const maxCell = Math.max(1, Math.min(opts?.maxCell ?? MAX_CELL_PX, w, h))
  if (n <= 0) return { cell: maxCell, cols: 0, rows: 0, slots: [] }
  const EPS = 1e-9
  let cols = 1
  let rows = n
  let cell = maxCell
  let bestCell = -1
  let bestEmpties = 0
  let bestAspectErr = 0
  for (let c = 1; c <= n; c++) {
    const r = Math.ceil(n / c)
    const fit = Math.min(w / c, h / r)
    if (!(fit > 0)) continue
    const cellC = Math.min(fit, maxCell)
    const empties = c * r - n
    const aspectErr = Math.abs(Math.log(c / r / (w / h)))
    const better =
      bestCell < 0 ||
      cellC > bestCell + EPS ||
      (Math.abs(cellC - bestCell) <= EPS &&
        (empties < bestEmpties || (empties === bestEmpties && aspectErr < bestAspectErr - EPS)))
    if (better) {
      bestCell = cellC
      bestEmpties = empties
      bestAspectErr = aspectErr
      cols = c
      rows = r
      cell = cellC
    }
  }
  const slots: Array<{ x: number; y: number }> = []
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(cols, n - r * cols)
    for (let c = 0; c < inRow; c++) {
      slots.push({ x: (c - (inRow - 1) / 2) * cell, y: (r - (rows - 1) / 2) * cell })
    }
  }
  return { cell, cols, rows, slots }
}

/**
 * План → мировые координаты: m — мировых единиц на пиксель (шаг ячейки в
 * мире / шаг в px), center — смещение центра rect от центра канвы (px,
 * y вниз). Верх экрана = +Z (камера стола снизу вверх), поэтому экранное
 * «вниз» отдаём в −Z: первый ряд (y минимальный) получает максимальный z,
 * порядок инстансов читается сверху вниз, как в футере расшифровки.
 */
export const slotsToWorld = (
  plan: LayoutPlan,
  m: number,
  center: { x: number; y: number },
): Array<{ x: number; z: number }> =>
  plan.slots.map((s) => ({ x: (s.x + center.x) * m, z: -(s.y + center.y) * m }))

/** Активные миры бросков (по миру на пачку — статика осевших никому не мешает). */
const activeWorlds = new Set<Promise<PhysicsWorld>>()

/** Продвинуть висящие броски стола. Вызывает rAF-цикл приложения каждый кадр. */
export const tickTableWorld = (): void => {
  for (const world of activeWorlds) {
    void world.then((w) => w.tick())
  }
}

/**
 * Бросок пачки в свежем rect-мире (без очереди — пачка идёт разом).
 * bounds — половинные экстенты: «стол» виджета = канва минус отступы шапки
 * и футера (см. applyLayout в mobile-table).
 * Мир чистится целиком после пачки: осевшая статика не переживает бросок.
 */
export const rollTable = async (
  reqs: readonly TableDieRequest[],
  cbs?: TableRollCallbacks,
  bounds?: { hx: number; hz: number },
): Promise<TableDieResult[]> => {
  const worldPromise = createPhysicsWorld(
    bounds
      ? {
          bounds: { hx: bounds.hx, hz: bounds.hz },
          felt: { friction: 0.9, restitution: 0.05 },
          // Жёсткая хватка качения: круглые докатываются и качаются на ребре
          // предельным циклом (скорость колеблется, смещения нет) — ни сон,
          // ни тишина его не ловят. Момент тормозит только контактное
          // медленное (полёт и живой кувырок не трогаем).
          roll: { rate: 9, grab: 6 },
          // Тяга фетра: линейный сток медленного в контакте. Душит качение,
          // которое момент не берёт (солвер подкачивает связку обратно).
          drag: { rate: 2.0, grab: 3.0 },
        }
      : { bounds: 'rect' },
  )
  activeWorlds.add(worldPromise)
  try {
    const world = await worldPromise
    return await rollTableDice(world, reqs, cbs)
  } finally {
    activeWorlds.delete(worldPromise)
    void worldPromise
      .then((world) => world.dispose())
      .catch(() => {
        // Мир не поднялся — чистить нечего, ошибка уже летит вызывающему.
      })
  }
}
