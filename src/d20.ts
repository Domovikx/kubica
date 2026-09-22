import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/800.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'

const VIEW_SIZE = 2.4
// Угол складки для сглаживания: скругления (двугранный угол ~5–10°) сглаживаются,
// плоские грани и грани цифр (90°+) остаются чёткими
const CREASE_ANGLE = Math.PI / 5
const BASE = import.meta.env.BASE_URL

interface ModelDef {
  id: string
  label: string
  url: string
  source: string
}

const MODELS: ModelDef[] = [
  { id: 'd6-freecad', label: 'D6 · FreeCAD (сравнение)', url: `${BASE}cad/cad-d6.glb`, source: 'FreeCAD 1.1.3' },
  { id: 'd6-openscad', label: 'D6 · OpenSCAD (сравнение)', url: `${BASE}cad/cad-d6-openscad.glb`, source: 'OpenSCAD 2021.01' },
  { id: 'd6-cadquery', label: 'D6 · CadQuery (сравнение)', url: `${BASE}cad/cad-d6-cadquery.glb`, source: 'CadQuery 2.8.0' },
  { id: 'd4', label: 'D4 · цифры на вершинах', url: `${BASE}cad/set/d4.glb`, source: 'OpenSCAD · цифры' },
  { id: 'd6', label: 'D6 · цифры 1–6', url: `${BASE}cad/set/d6.glb`, source: 'OpenSCAD · цифры' },
  { id: 'd8', label: 'D8 · цифры 1–8', url: `${BASE}cad/set/d8.glb`, source: 'OpenSCAD · цифры' },
  { id: 'd10', label: 'D10 · цифры 0–9', url: `${BASE}cad/set/d10.glb`, source: 'OpenSCAD · цифры' },
  { id: 'd12', label: 'D12 · цифры 1–12', url: `${BASE}cad/set/d12.glb`, source: 'OpenSCAD · цифры' },
  { id: 'd20', label: 'D20 · цифры 1–20', url: `${BASE}cad/set/d20.glb`, source: 'OpenSCAD · цифры' },
]

const DEFAULT_SELECTED = ['d6-freecad', 'd20']

interface Viewer {
  load: (url: string, onLoad?: (tris: number) => void, onError?: () => void) => void
  resize: () => void
  update: () => void
  dispose: () => void
}

const createViewer = (canvas: HTMLCanvasElement, overlay: HTMLElement): Viewer => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x14161a)

  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.06

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
  camera.position.set(3.2, 2, 4.2)

  const controls = new OrbitControls(camera, canvas)
  controls.target.set(0, 0, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = 2
  controls.maxDistance = 12
  controls.autoRotate = true
  controls.autoRotateSpeed = 2

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3f4d, 0.35))

  const sun = new THREE.DirectionalLight(0xffffff, 1.2)
  sun.position.set(4, 8, 4)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  scene.add(sun)

  const loader = new GLTFLoader()
  let current: THREE.Object3D | null = null
  let disposed = false

  const fitToView = (root: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = VIEW_SIZE / Math.max(size.x, size.y, size.z)
    root.scale.setScalar(scale)
    root.position.addScaledVector(center, -scale)
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }

  const countTriangles = (root: THREE.Object3D) => {
    let total = 0
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const position = child.geometry.getAttribute('position')
        if (!position) return
        const index = child.geometry.getIndex()
        total += (index ? index.count : position.count) / 3
      }
    })
    return Math.round(total)
  }

  const smoothShade = (root: THREE.Object3D) => {
    // Сглаживание нормалей со складками: скругления выглядят гладко,
    // плоские грани и рёбра цифр остаются чёткими. Только визуал, геометрия та же.
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const smoothed = toCreasedNormals(child.geometry, CREASE_ANGLE)
        child.geometry.dispose()
        child.geometry = smoothed
      }
    })
  }

  const showModel = (root: THREE.Object3D) => {
    if (current) {
      scene.remove(current)
      current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          for (const m of mats) m.dispose()
        }
      })
      current = null
    }
    fitToView(root)
    smoothShade(root)
    scene.add(root)
    current = root
    overlay.hidden = true
    return countTriangles(root)
  }

  const load = (
    url: string,
    onLoad?: (tris: number) => void,
    onError?: () => void,
  ) => {
    loader.load(
      url,
      (gltf) => {
        if (disposed) return
        const root = gltf.scene.children.length === 1 ? gltf.scene.children[0] : gltf.scene
        const tris = showModel(root)
        onLoad?.(tris)
      },
      undefined,
      () => {
        if (!disposed) onError?.()
      },
    )
  }

  const resize = () => {
    if (disposed) return
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const update = () => {
    if (disposed) return
    controls.update()
    renderer.render(scene, camera)
  }

  const dispose = () => {
    disposed = true
    if (current) {
      scene.remove(current)
      current.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          for (const m of mats) m.dispose()
        }
      })
      current = null
    }
    controls.dispose()
    renderer.dispose()
  }

  return { load, resize, update, dispose }
}

const viewersContainer = document.getElementById('viewers') as HTMLElement
const listContainer = document.getElementById('modelList') as HTMLElement

let viewers: Viewer[] = []
let selected = new Set<string>(DEFAULT_SELECTED)

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
  for (const model of MODELS) {
    if (!selected.has(model.id)) continue
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
  for (const viewer of viewers) viewer.update()
  requestAnimationFrame(animate)
}

window.addEventListener('resize', resize)
renderViewers()
resize()
animate()