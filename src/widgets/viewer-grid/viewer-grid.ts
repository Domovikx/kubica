import { MODELS, type ModelDef } from '@/entities/model/models'
import {
  physMaxDim,
  faceValue,
  faceNormals,
  normalizedVerts,
  type DieId,
} from '@/entities/dice-geometry/geometry'
import {
  isSelected,
  subscribeSelection,
  type Selection,
} from '@/features/select-model/select-model'
import { quickRoll, releasePower } from '@/features/roll-dice/quick-roll'
import {
  applyQuatToVec,
  faceIndexForValue,
  quatForD4VertexUp,
  quatForValueDown,
  quatForValueUp,
  toModelFrame,
} from '@/features/roll-dice/face-orient'
import {
  displayValue,
  readBottomRoll,
  resolveD4Below,
  screenUpWorld,
  type Quat,
} from '@/features/roll-dice/readout'
import { isMuted, playThock, startRattle, stopRattle } from '@/features/roll-dice/sound'
import { createViewer, type Viewer } from '@/shared/three/viewer'
import { showResult } from '@/shared/ui/result-pop'
import './viewer-grid.css'

// Лимит дропа чужого .glb: защита от OOM на слабом железе (50 МБ)
const DROP_SIZE_LIMIT = 50 * 1024 * 1024

/** ID панели → физическая кость (d6-freecad → d6, d20 → d20). */
const parseDieId = (id: string): DieId | null => {
  const m = /^d(\d+)/.exec(id)
  if (!m) return null
  const n = Number(m[1])
  return ([4, 6, 8, 10, 12, 20] as const).includes(n as 4 | 6 | 8 | 10 | 12 | 20)
    ? (`d${n}` as DieId)
    : null
}

/**
 * Прототип «стеклянный стол» (?glass[=d6]): камера под столом, виден низ.
 * Без значения — первая выбранная кость; со значением (?glass=d6) — та кость.
 * Возвращает null вне прототипа.
 */
const glassDieFilter = (): string | null | undefined => {
  if (typeof window === 'undefined') return undefined
  const raw = new URLSearchParams(window.location.search).get('glass')
  if (raw === null) return undefined
  const want = raw.trim().toLowerCase()
  return want === '' ? null : want
}

/** Тактильный отклик на settle (вторичное подкрепление; глушится вместе со звуком). */
const buzz = (die: DieId, value: number): void => {
  try {
    if (isMuted() || typeof navigator === 'undefined' || !('vibrate' in navigator)) return
    if (die === 'd20' && value === 20) navigator.vibrate([30, 50, 30])
    else if (die === 'd20' && value === 1) navigator.vibrate(80)
    else navigator.vibrate(15)
  } catch {
    // Десктопы без вибромотора — тихо игнорируем
  }
}

/**
 * Жесты по канвасу (см. docs/JUICE.md):
 * - тап = обычный бросок (power 1);
 * - резкий свайп = бросок с силой ∝ скорости (как в крэпсе);
 * Жесты панели:
 * - чистый тап ПО КОСТИ (<8px, <500мс) = бросок (тап по фетру — ничего);
 * - драг = осмотр камеры (OrbitControls), броска нет — подкрутить стол можно;
 * - зажал >250 мс без движения = «потискать»: трекбол 1:1 + подъём в руку,
 *   отпустил — честный бросок из позы руки (флик задаёт направление и силу).
 */
const attachDieGestures = (
  canvas: HTMLCanvasElement,
  isBusy: () => boolean,
  handlers: {
    onThrow: (power: number) => void
    onGrabStart: () => void
    onGrabMove: (dx: number, dy: number) => void
    onGrabEnd: (vx: number, vy: number) => void
  },
  // Луч в кость: бросок только по чистому тапу в неё (тап по фетру — мимо)
  pick: (x: number, y: number) => boolean,
): (() => void) => {
  let downX = 0
  let downY = 0
  let downT = 0
  let lastX = 0
  let lastY = 0
  let armed = false
  let grabbed = false
  let holdTimer = 0
  let trail: Array<{ x: number; y: number; t: number }> = []
  const clearHold = () => {
    window.clearTimeout(holdTimer)
  }
  const onDown = (e: PointerEvent) => {
    if (!e.isPrimary || isBusy()) {
      armed = false
      return
    }
    armed = true
    grabbed = false
    downX = e.clientX
    downY = e.clientY
    downT = performance.now()
    lastX = e.clientX
    lastY = e.clientY
    trail = [{ x: e.clientX, y: e.clientY, t: downT }]
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      // ignore — без захвата мультитач может разъехаться
    }
    holdTimer = window.setTimeout(() => {
      if (!armed || grabbed || isBusy()) return
      if (Math.hypot(lastX - downX, lastY - downY) > 10) return
      grabbed = true
      handlers.onGrabStart()
    }, 250)
  }
  const onMove = (e: PointerEvent) => {
    if (!e.isPrimary || !armed) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    trail.push({ x: e.clientX, y: e.clientY, t: performance.now() })
    if (trail.length > 8) trail.shift()
    if (grabbed) {
      handlers.onGrabMove(dx, dy)
      return
    }
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 10) clearHold()
  }
  const finish = (e: PointerEvent, cancelled: boolean) => {
    if (!e.isPrimary) return
    clearHold()
    try {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    if (!armed) return
    armed = false
    if (grabbed) {
      grabbed = false
      if (cancelled) {
        handlers.onGrabEnd(0, 0)
      } else {
        // Скорость отпускания по следу за последние ~120 мс (px/мс)
        const now = performance.now()
        const recent = trail.filter((p) => now - p.t <= 120)
        const a = recent[0] ?? { x: downX, y: downY, t: downT }
        const b = recent[recent.length - 1] ?? a
        const dt = Math.max(1, b.t - a.t)
        handlers.onGrabEnd((b.x - a.x) / dt, (b.y - a.y) / dt)
      }
      return
    }
    if (cancelled) return
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
    const dt = Math.max(1, performance.now() - downT)
    // Только чистый тап по кости. Драг любой длины — осмотр камеры, без броска:
    // свайп-бросок удалён (он же срабатывал при попытке подкрутить стол).
    if (moved < 8 && dt < 500 && pick(e.clientX, e.clientY)) {
      handlers.onThrow(1)
    }
  }
  const onUp = (e: PointerEvent) => finish(e, false)
  const onCancel = (e: PointerEvent) => finish(e, true)
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onCancel)
  return () => {
    canvas.removeEventListener('pointerdown', onDown)
    canvas.removeEventListener('pointermove', onMove)
    canvas.removeEventListener('pointerup', onUp)
    canvas.removeEventListener('pointercancel', onCancel)
  }
}

const buildPanel = (model: ModelDef, onReady: (viewer: Viewer) => void): HTMLElement => {
  const section = document.createElement('section')
  section.className = 'viewer'
  section.dataset.testid = 'viewer'

  const canvas = document.createElement('canvas')

  const label = document.createElement('p')
  label.className = 'viewerLabel'
  label.dataset.testid = 'viewer-label'
  label.textContent = model.id

  const info = document.createElement('p')
  info.className = 'viewerInfo'
  info.dataset.testid = 'viewer-info'

  const overlay = document.createElement('div')
  overlay.className = 'viewerOverlay'
  overlay.dataset.testid = 'viewer-overlay'
  overlay.hidden = true
  const title = document.createElement('p')
  title.className = 'viewerOverlayTitle'
  title.dataset.testid = 'viewer-overlay-title'
  title.textContent = 'Модель не найдена'
  const hint = document.createElement('p')
  hint.className = 'viewerOverlayText'
  hint.dataset.testid = 'viewer-overlay-text'
  hint.textContent = `Нужен ${model.url}`
  overlay.append(title, hint)

  section.append(canvas, label, info, overlay)

  const die = parseDieId(model.id)
  // d4 сверху нечитаем: грань смотрит вбок-вверх (~70° от вертикали), поэтому
  // панели d4 — фиксированный tilt ~45° (грань почти фронтально, цифры прямо).
  // Остальные строго сверху. У каждого вьювера своя камера (см. ViewerOptions).
  // glass: стол невидим, границы прямоугольные, камера снизу — для всех,
  // включая д4: пирамида видна нижней гранью лицом, результат — цифра
  // вершины, верхней на экране (см. readD4ScreenTop; yaw-презентация ей
  // запрещена — сменит результат).
  const glass = glassDieFilter() !== undefined
  const below = glass
  const viewer = createViewer(
    canvas,
    overlay,
    glass ? { glass: true, below: true } : die === 'd4' ? { tiltRad: 0.785 } : undefined,
  )

  // Модель в размер физ-тела (измеренный AABB → AABB физики): витрина показывает
  // ту же физику. Стартовая поза — сразу плашмя первой гранью (не 3/4 на ребре).
  // below: первая грань кладётся вниз — в камеру под столом (д4: вершиной
  // вверх как обычно — низ считается по верхней-на-экране вершине).
  const physSize = die ? physMaxDim(die) : undefined
  const initialQuat =
    die === null
      ? undefined
      : die === 'd4'
        ? quatForD4VertexUp(1, viewer.getViewDir())
        : below
          ? quatForValueDown(die, faceValue(die, 0), viewer.getViewDir())
          : quatForValueUp(die, faceValue(die, 0), viewer.getViewDir())
  viewer.load(
    model.url,
    { physSize, initialQuat },
    (tris) => {
      info.textContent = `${model.source} · ${tris.toLocaleString('ru-RU')} треугольников`
    },
    () => {
      overlay.hidden = false
      info.textContent = `${model.source} · не загрузилась`
    },
  )
  // Тап по кости = бросок: физика даёт значение, спин экспоненциально гаснет
  // и сам выруливает гранью в камеру (без отдельной фазы подворота);
  // тук/вибро/поп — в момент остановки.
  // Слушатели висят на canvas, который выбрасывается вместе с панелью.
  let rolling = false
  if (die) {
    canvas.title = below
      ? `Стекло: вид снизу · тап по кости — бросок · кость улетает вверх и бьётся в стекло`
      : `Тап по кости — бросок · колесо — масштаб · зажми — потискать, отпусти — швырнёт`
    // Единый честный бросок из позы (покой или рука): тело стартует оттуда где
    // модель (pos+quat — без телепортов), летит на солвере 1:1, витрина через
    // onStep только показывает. Звук — ТОЛЬКО от живых ударов (onCollide ∝
    // удару): в полёте без соприкосновения кость молчит, рокот был бы враньём.
    // Рокот живёт только в руке (старт на grab, стоп здесь же на броске).
    // Стекло: поп и история показывают низ (д4 — верхнюю-на-экране вершину),
    // физика и result.quat при этом те же (наклон меряем по верху как обычно).
    const remap = (
      quat: Quat,
      fallback: { value: number; display: string },
    ): { value: number; display: string } => {
      if (!below) return fallback
      if (die === 'd4') {
        // Значение — от финальной позы пайплайна (доснап + yaw), не от сырой:
        // иначе поп и витрина разъедутся на пограничных доворотах.
        const v = resolveD4Below(quat, screenUpWorld(viewer.getViewDir())).value
        return { value: v, display: String(v) }
      }
      const v = readBottomRoll(die, quat)
      return { value: v, display: displayValue(die, v) }
    }
    const throwFromPose = (
      pose: { pos: [number, number, number]; quat: [number, number, number, number] },
      opts?: {
        power?: number
        fling?: { x: number; z: number }
        launchUp?: number
        retry?: number
      },
    ): void => {
      if (rolling) return
      rolling = true
      stopRattle()
      // Метка последнего живого удара: финальный тук — только если посадка
      // прошла тихо (>150 мс без ударов), иначе задвоит последний стук
      let lastHit = 0
      void quickRoll(die, {
        silent: true,
        power: opts?.power ?? 1,
        area: 0.5,
        spawnPos: pose.pos,
        spawnQuat: pose.quat,
        fling: opts?.fling,
        // glass: прямоугольный мир + швырок вверх от нижней камеры;
        // история сразу пишется по видимому значению (низ / верх-на-экране)
        rect: glass,
        launchUp: glass ? (opts?.launchUp ?? 28) : undefined,
        mapHistory: glass ? (r) => remap(r.quat, r) : undefined,
        onStep: (step) => {
          viewer.syncBody(step.pos, step.quat)
        },
        onCollide: (i) => {
          lastHit = performance.now()
          playThock(die, i)
        },
      })
        .then((result) => {
          if (new URLSearchParams(window.location.search).has('raw')) {
            // ВРЕМЕННЫЙ режим самокалибровки кадров (см. docs/JUICE.md):
            // физика как есть, без презентаций — цифру сверху читаем со скриншота
            console.log(
              `[rawroll] die=${die} value=${result.value} settled=${result.settled} quat=${result.quat.join(',')}`,
            )
            stopRattle()
            viewer.setSpinning(false)
            rolling = false
            return
          }
          // Физика уже положила кость: тук/вибро/поп — в момент остановки.
          // Дальше только медленная yaw-презентация (верх цифры к зрителю).
          // Cocked (не осела или легла с наклоном) — честно оставляем как легло:
          // доворот наклонённой был бы тем самым магнитом-рывком.
          // below: что видно снизу, то и результат (низ, не верх;
          // д4 — верхняя-на-экране вершина).
          stopRattle()
          if (performance.now() - lastHit > 150) playThock(die)
          // Финиш броска: презентация, затем плавный возврат в центр стола
          // (мобайл: кость у края нечитаема; заодно следующий бросок — из центра).
          const finish = () =>
            viewer.glideTo(0, 0, () => {
              rolling = false
            })
          // Не осела за лимит шагов (клин/вечное качение): переброс с текущей
          // позы вместо застывшей кривой кости с попом. Максимум 2 ретрая,
          // дальше — как легла. Наклонные посадки ретрая не требуют: витрина
          // кладёт их плашмя одним движением (та же грань, значение от финала).
          if (!result.settled && (opts?.retry ?? 0) < 2) {
            const retryPose = viewer.getPose()
            if (retryPose) {
              // Сбрасываем флаг под рекурсию (мы внутри единственного потока
              // броска — гонки нет): throwFromPose тут же поднимет его обратно.
              rolling = false
              throwFromPose(retryPose, { ...opts, retry: (opts?.retry ?? 0) + 1 })
              return
            }
          }
          if (below && die === 'd4') {
            // Пайплайн д4: доснап наклона (та же грань) + winning-вершина ровно
            // наверх экрана; значение — от финала.
            const up = screenUpWorld(viewer.getViewDir())
            const final = resolveD4Below(result.quat, up)
            buzz(die, final.value)
            showResult(die, String(final.value))
            viewer.presentResult(final.target, finish, final.flattened ? 900 : 550, final.flattened)
            return
          }
          const { value: shown, display: shownDisplay } = remap(result.quat, result)
          buzz(die, shown)
          showResult(die, shownDisplay)
          if (!result.settled) {
            rolling = false
            return
          }
          const target =
            die === 'd4'
              ? quatForD4VertexUp(shown, viewer.getViewDir())
              : below
                ? quatForValueDown(die, shown, viewer.getViewDir())
                : quatForValueUp(die, shown, viewer.getViewDir())
          // Доворот — только почти-плоской: меряем НАКЛОН (не полный угол —
          // yaw всегда большой, это и правит презентация). Наклонённую кладём
          // плашмя ОДНИМ движением сразу на финальную позу (грань-лидер та же,
          // значение не меняется): двухфазный доворот крутил туда-сюда
          // и выглядел «не в ту сторону».
          const upRaw: readonly [number, number, number] =
            die === 'd4'
              ? normalizedVerts('d4')[result.value - 1]
              : faceNormals(die)[faceIndexForValue(die, result.value)]
          const upWorld = applyQuatToVec(
            toModelFrame(die, [upRaw[0], upRaw[1], upRaw[2]]),
            result.quat as Quat,
          )
          const upLen = Math.hypot(upWorld[0], upWorld[1], upWorld[2]) || 1
          const tilt = Math.acos(Math.min(1, Math.max(-1, upWorld[1] / upLen)))
          if (tilt < 0.035) {
            viewer.presentResult(target, finish)
            return
          }
          // Наклонная: один медленный доворот на грань значения (углы не скребут
          // пол за счёт приподъёма в full-режиме).
          viewer.presentResult(target, finish, tilt < 0.26 ? 650 : 900, true)
        })
        .catch(() => {
          stopRattle()
          rolling = false
          viewer.setSpinning(false)
        })
    }
    const doThrow = (power: number): void => {
      const pose = viewer.getPose()
      if (!pose) return
      throwFromPose(pose, { power })
    }
    attachDieGestures(
      canvas,
      () => rolling,
      {
        onThrow: doThrow,
        // Рокот — только пока кость в руке (контакт с пальцами честен);
        // в полёте без соприкосновения — тишина, только удары.
        onGrabStart: () => {
          viewer.grabStart()
          startRattle()
        },
        onGrabMove: (dx, dy) => viewer.grabMove(dx, dy),
        onGrabEnd: (vx, vy) => {
          // Релиз зарядки = полный бросок из позы руки: сила от заряда+флика
          // (min 1.0 — подгадать грань gentle-отпуском нельзя), направление
          // флика — в импульс. Зарядил-отпустил: весело, честно, непредсказуемо.
          // glass: чем дольше держал, тем выше швырок (26–34 ≈ высота кости и выше).
          const pose = viewer.getPose()
          const { charge } = viewer.grabEnd()
          if (!pose) return
          const flick = viewer.grabFlick(vx, vy)
          const power = releasePower(charge, flick.speed)
          throwFromPose(pose, {
            power,
            fling: { x: flick.x, z: flick.z },
            launchUp: glass ? 26 + charge * 8 : undefined,
          })
        },
      },
      (x, y) => viewer.pickDie(x, y),
    )
  }
  canvas.addEventListener('dragover', (e) => e.preventDefault())
  canvas.addEventListener('drop', (e) => {
    e.preventDefault()
    const file = [...(e.dataTransfer?.files ?? [])].find((f) =>
      f.name.toLowerCase().endsWith('.glb'),
    )
    if (!file) return
    if (file.size > DROP_SIZE_LIMIT) {
      info.textContent = `Файл ${(file.size / 1048576).toFixed(0)} МБ — лимит 50 МБ`
      return
    }
    overlay.hidden = true
    viewer.load(URL.createObjectURL(file), undefined, (tris) => {
      info.textContent = `${file.name} · ${tris.toLocaleString('ru-RU')} треугольников`
    })
  })
  onReady(viewer)
  return section
}

export const mountViewerGrid = (
  container: HTMLElement,
): { update: () => void; resize: () => void; dispose: () => void } => {
  let viewers: Viewer[] = []

  const render = (selected: Selection) => {
    for (const viewer of viewers) viewer.dispose()
    viewers = []
    container.innerHTML = ''
    const allDefs = MODELS.filter((m) => !m.reference && selected.has(m.id))
    // glass-прототип — одна панель: ?glass=dN показывает именно её
    // (вне зависимости от чекбоксов), ?glass — первую выбранную.
    const glassWant = glassDieFilter()
    const defs =
      glassWant === undefined
        ? allDefs
        : (() => {
            const hit =
              glassWant !== null
                ? MODELS.filter((m) => !m.reference).find(
                    (m) =>
                      m.id.toLowerCase() === glassWant || m.id.toLowerCase().startsWith(glassWant),
                  )
                : undefined
            return hit ? [hit] : allDefs.slice(0, 1)
          })()
    // Раскладка: все выбранные — на одном экране без скролла.
    // Колонки/ряды задаются data-атрибутами (чистый CSS, без инлайн-стилей и !important)
    const n = defs.length
    const cols = n <= 1 ? 1 : n === 2 ? 2 : n <= 4 ? 2 : 3
    const rows = Math.max(1, Math.ceil(n / cols))
    container.dataset.cols = String(cols)
    container.dataset.rows = String(rows)
    for (const model of defs) {
      const section = buildPanel(model, (v) => viewers.push(v))
      container.appendChild(section)
    }
    requestAnimationFrame(() => {
      for (const viewer of viewers) viewer.resize()
    })
  }

  // Первичный рендер — из текущего состояния стора (без скрытых референсов)
  render(new Set(MODELS.filter((m) => !m.reference && isSelected(m.id)).map((m) => m.id)))
  const unsubscribe = subscribeSelection(render)

  return {
    update() {
      for (const viewer of viewers) viewer.update()
    },
    resize() {
      for (const viewer of viewers) viewer.resize()
    },
    dispose() {
      unsubscribe()
      for (const viewer of viewers) viewer.dispose()
      viewers = []
      container.innerHTML = ''
    },
  }
}
