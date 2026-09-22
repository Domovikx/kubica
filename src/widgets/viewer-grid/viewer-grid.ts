import { MODELS, type ModelDef } from '@/entities/model/models'
import {
  isSelected,
  subscribeSelection,
  type Selection,
} from '@/features/select-model/select-model'
import { createViewer, type Viewer } from '@/shared/three/viewer'
import './viewer-grid.css'

// Лимит дропа чужого .glb: защита от OOM на слабом железе (50 МБ)
const DROP_SIZE_LIMIT = 50 * 1024 * 1024

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
    const defs = MODELS.filter((m) => selected.has(m.id))
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

  // Первичный рендер — из текущего состояния стора
  render(new Set(MODELS.filter((m) => isSelected(m.id)).map((m) => m.id)))
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
