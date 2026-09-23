import { MODELS, type ModelDef } from '@/entities/model/models'
import type { DieId } from '@/entities/dice-geometry/geometry'
import {
  isSelected,
  subscribeSelection,
  type Selection,
} from '@/features/select-model/select-model'
import { quickRoll } from '@/features/roll-dice/quick-roll'
import { isMuted, playThock, startRattle, stopRattle } from '@/features/roll-dice/sound'
import { createViewer, SETTLE_DURATION_MS, type Viewer } from '@/shared/three/viewer'
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

/** Минимальный спин витрины (мс): физика быстрее — поп не должен спойлерить. */
const MIN_SPIN_MS = 2000

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

/** Тап (без драга) по канвасу = бросок. Порог отличает тап от вращения. */
const attachTapToRoll = (canvas: HTMLCanvasElement, onTap: () => void): (() => void) => {
  let downX = 0
  let downY = 0
  let downT = 0
  const onDown = (e: PointerEvent) => {
    downX = e.clientX
    downY = e.clientY
    downT = performance.now()
  }
  const onUp = (e: PointerEvent) => {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
    if (moved < 8 && performance.now() - downT < 500) onTap()
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerup', onUp)
  return () => {
    canvas.removeEventListener('pointerdown', onDown)
    canvas.removeEventListener('pointerup', onUp)
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

  // Временный дебаг калибровки: кнопки граней — показать грань прямо в камеру.
  // Стоит под верхом панели: низ перекрыт фиксированным bottombar (z-index 10).
  if ((model.id === 'd4' || model.id === 'd6' || model.id === 'd20') && die !== null) {
    const faces = model.id === 'd20' ? 20 : model.id === 'd6' ? 6 : 4
    const debug = document.createElement('div')
    debug.className = 'faceDebug'
    for (let n = 1; n <= faces; n++) {
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
            : quatForValueToCamera(die, n, viewer.getViewDir()),
        )
      })
      debug.appendChild(btn)
    }
    section.appendChild(debug)
  }
  viewer.load(
    model.url,
    (tris) => {
      info.textContent = `${model.source} · ${tris.toLocaleString('ru-RU')} треугольников`
    },
    () => {
      overlay.hidden = false
      info.textContent = `${model.source} · не загрузилась`
    },
  )
  // Тап по кости = бросок: физика даёт значение, витрина смакует спин,
  // затем дотягивает нужную грань в камеру; поп/тук/вибро — в момент settle.
  // Слушатели висят на canvas, который выбрасывается вместе с панелью.
  let rolling = false
  if (die) {
    canvas.title = `Тап — бросить ${die}`
    attachTapToRoll(canvas, () => {
      if (rolling) return
      rolling = true
      viewer.setSpinning(true)
      startRattle()
      const t0 = performance.now()
      void quickRoll(die, { silent: true })
        .then((result) => {
          // Физика готова раньше (~1.2 с) — ждём минимальный спин,
          // иначе поп спойлерит результат до дотяжки
          const wait = Math.max(0, MIN_SPIN_MS - (performance.now() - t0))
          window.setTimeout(() => {
            stopRattle()
            viewer.settleTo(
              die === 'd4'
                ? quatForD4VertexUp(result.value, viewer.getViewDir())
                : quatForValueToCamera(die, result.value, viewer.getViewDir()),
            )
            window.setTimeout(() => {
              playThock(die)
              buzz(die, result.value)
              showResult(die, result.display)
              rolling = false
              viewer.setSpinning(false)
            }, SETTLE_DURATION_MS)
          }, wait)
        })
        .catch(() => {
          stopRattle()
          rolling = false
          viewer.setSpinning(false)
        })
    })
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
    viewer.load(URL.createObjectURL(file), (tris) => {
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
