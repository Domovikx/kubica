import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/800.css'
import { DEFAULT_SELECTED, MODELS, type ModelDef } from './models'
import { createViewer, type Viewer } from './viewer'

const viewersContainer = document.getElementById('viewers') as HTMLElement
const listContainer = document.getElementById('modelList') as HTMLElement

let viewers: Viewer[] = []
let selected = new Set<string>(DEFAULT_SELECTED)

// Лимит дропа чужого .glb: защита от OOM на слабом железе (50 МБ)
const DROP_SIZE_LIMIT = 50 * 1024 * 1024

const buildCheckbox = (model: ModelDef) => {
  const label = document.createElement('label')
  label.className = 'modelItem'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.value = model.id
  input.checked = selected.has(model.id)
  const code = document.createElement('span')
  code.className = 'modelItemCode'
  code.textContent = model.id
  const text = document.createElement('span')
  text.className = 'modelItemLabel'
  text.textContent = model.label
  label.append(input, code, text)
  input.addEventListener('change', () => {
    if (input.checked) selected.add(model.id)
    else selected.delete(model.id)
    renderViewers()
  })
  return label
}

const renderViewers = () => {
  for (const viewer of viewers) viewer.dispose()
  viewers = []
  viewersContainer.innerHTML = ''
  const defs = MODELS.filter((m) => selected.has(m.id))
  // Раскладка: все выбранные — на одном экране без скролла.
  // Колонки/ряды задаются data-атрибутами (чистый CSS, без инлайн-стилей и !important)
  const n = defs.length
  const cols = n <= 1 ? 1 : n === 2 ? 2 : n <= 4 ? 2 : 3
  const rows = Math.max(1, Math.ceil(n / cols))
  viewersContainer.dataset.cols = String(cols)
  viewersContainer.dataset.rows = String(rows)
  for (const model of defs) {
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
    viewersContainer.appendChild(section)

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
    viewers.push(viewer)
  }
  requestAnimationFrame(resize)
}

for (const model of MODELS) listContainer.appendChild(buildCheckbox(model))

const selectAllBtn = document.getElementById('selectAll') as HTMLButtonElement
const clearBtn = document.getElementById('clearAll') as HTMLButtonElement
selectAllBtn.addEventListener('click', () => {
  selected = new Set(MODELS.map((m) => m.id))
  for (const input of listContainer.querySelectorAll<HTMLInputElement>('input')) {
    input.checked = selected.has(input.value)
  }
  renderViewers()
})
clearBtn.addEventListener('click', () => {
  selected = new Set()
  for (const input of listContainer.querySelectorAll<HTMLInputElement>('input')) {
    input.checked = false
  }
  renderViewers()
})

const resize = () => {
  for (const viewer of viewers) viewer.resize()
}

const animate = () => {
  // Скрытая вкладка: кадры не рендерим (батарея), rAF и так троттлится
  if (!document.hidden) {
    for (const viewer of viewers) viewer.update()
  }
  requestAnimationFrame(animate)
}

window.addEventListener('resize', resize)
renderViewers()
resize()
animate()
