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
import { quickRoll } from '@/features/roll-dice/quick-roll'
import { snapFlat } from '@/features/roll-dice/physics'
import {
  applyQuatToVec,
  faceIndexForValue,
  quatForD4VertexUp,
  quatForValueUp,
  toModelFrame,
} from '@/features/roll-dice/face-orient'
import type { Quat } from '@/features/roll-dice/readout'
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

  const canvas = document.createElement('canvas')

  const label = document.createElement('p')
  label.className = 'viewerLabel'
  label.textContent = model.id

  const info = document.createElement('p')
  info.className = 'viewerInfo'

  const overlay = document.createElement('div')
  overlay.className = 'viewerOverlay'
  overlay.hidden = true
  const title = document.createElement('p')
  title.className = 'viewerOverlayTitle'
  title.textContent = 'Модель не найдена'
  const hint = document.createElement('p')
  hint.className = 'viewerOverlayText'
  hint.textContent = `Нужен ${model.url}`
  overlay.append(title, hint)

  section.append(canvas, label, info, overlay)

  const viewer = createViewer(canvas, overlay)

  const die = parseDieId(model.id)

  // Временный дебаг калибровки: кнопки граней — показать грань плашмя.
  // Магнит всегда кладёт ровно (математически точно) — читаем цифру сверху.
  // d10: значения-глифы 0–9 (0 читается как 10 только в истории/попе).
  if (
    (model.id === 'd4' ||
      model.id === 'd6' ||
      model.id === 'd8' ||
      model.id === 'd10' ||
      model.id === 'd12' ||
      model.id === 'd20') &&
    die !== null
  ) {
    const faces =
      model.id === 'd20'
        ? 20
        : model.id === 'd12'
          ? 12
          : model.id === 'd10'
            ? 10
            : model.id === 'd8'
              ? 8
              : model.id === 'd6'
                ? 6
                : 4
    const first = model.id === 'd10' ? 0 : 1
    const debug = document.createElement('div')
    debug.className = 'faceDebug'
    for (let n = first; n < first + faces; n++) {
      const btn = document.createElement('button')
      btn.className = 'faceDebugBtn'
      btn.type = 'button'
      btn.textContent = String(n)
      btn.title = `Показать грань ${n}`
      btn.addEventListener('click', () => {
        viewer.setSpinning(false)
        viewer.settleTo(
          die === 'd4'
            ? quatForD4VertexUp(n, viewer.getViewDir())
            : quatForValueUp(die, n, viewer.getViewDir()),
        )
      })
      debug.appendChild(btn)
    }
    section.appendChild(debug)
  }
  // Модель в размер физ-тела (измеренный AABB → AABB физики): витрина показывает
  // ту же физику. Стартовая поза — сразу плашмя первой гранью (не 3/4 на ребре).
  const physSize = die ? physMaxDim(die) : undefined
  const initialQuat =
    die === null
      ? undefined
      : die === 'd4'
        ? quatForD4VertexUp(1, viewer.getViewDir())
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
    canvas.title = `Тап по кости — бросок · драг — осмотр · зажми — потискать, отпусти — швырнёт`
    // Единый честный бросок из позы (покой или рука): тело стартует оттуда где
    // модель (pos+quat — без телепортов), летит на солвере 1:1, витрина через
    // onStep только показывает. Стук — от живых ударов (onCollide ∝ удару).
    const throwFromPose = (
      pose: { pos: [number, number, number]; quat: [number, number, number, number] },
      opts?: { power?: number; fling?: { x: number; z: number } },
    ): void => {
      if (rolling) return
      rolling = true
      startRattle()
      void quickRoll(die, {
        silent: true,
        power: opts?.power ?? 1,
        area: 0.5,
        spawnPos: pose.pos,
        spawnQuat: pose.quat,
        fling: opts?.fling,
        onStep: (step) => {
          viewer.syncBody(step.pos, step.quat)
        },
        onCollide: (i) => playThock(die, i),
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
          stopRattle()
          playThock(die)
          buzz(die, result.value)
          showResult(die, result.display)
          if (!result.settled) {
            rolling = false
            return
          }
          const target =
            die === 'd4'
              ? quatForD4VertexUp(result.value, viewer.getViewDir())
              : quatForValueUp(die, result.value, viewer.getViewDir())
          // Доворот — только почти-плоской: меряем НАКЛОН (не полный угол —
          // yaw всегда большой, это и правит презентация). Наклонённую КЛАДЁМ
          // плашмя осознанно и медленно (lay-flat, двумя фазами: сначала
          // ближайшая плоская, затем yaw цифры) — граничные кейсы (ребро,
          // борт) больше не создают спорных ситуаций. Значение при этом
          // не меняется: грань-лидер остаётся верхней.
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
            viewer.presentResult(target, () => {
              rolling = false
            })
            return
          }
          if (tilt < 0.26) {
            // До 15°: сначала snap (та же грань ровно, без смены значения),
            // затем yaw цифры. Короткие дуги, без размашистых замахов.
            const snap = snapFlat(die, result.quat)
            viewer.presentResult(
              snap,
              () =>
                viewer.presentResult(
                  target,
                  () => {
                    rolling = false
                  },
                  450,
                ),
              450,
              true,
            )
            return
          }
          // Сильный наклон (у борта и т.п.): медленно кладём сразу на грань
          // значения — долго (0.9 с), зато однозначно.
          viewer.presentResult(
            target,
            () => {
              rolling = false
            },
            900,
            true,
          )
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
        onGrabStart: () => viewer.grabStart(),
        onGrabMove: (dx, dy) => viewer.grabMove(dx, dy),
        onGrabEnd: (vx, vy) => {
          // Релиз фиджета = бросок из позы руки: флик задаёт направление и силу.
          // Еле шевельнул — мягкая укладка с руки (тоже честный исход).
          const pose = viewer.getPose()
          viewer.grabEnd()
          if (!pose) return
          const flick = viewer.grabFlick(vx, vy)
          const power = Math.min(1.3, 0.35 + flick.speed * 0.3)
          throwFromPose(pose, { power, fling: { x: flick.x, z: flick.z } })
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
    const defs = MODELS.filter((m) => !m.reference && selected.has(m.id))
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
