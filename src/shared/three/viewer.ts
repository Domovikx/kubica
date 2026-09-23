import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'

const VIEW_SIZE = 2.4
// Угол складки для сглаживания: скругления (двугранный угол ~5–10°) сглаживаются,
// плоские грани и грани цифр (90°+) остаются чёткими
const CREASE_ANGLE = Math.PI / 5

export interface Viewer {
  load: (url: string, onLoad?: (tris: number) => void, onError?: () => void) => void
  resize: () => void
  update: () => void
  dispose: () => void
  /** Косметическое кувыркание модели (только визуал; результат даёт физика). */
  setSpinning: (on: boolean) => void
  /**
   * Дотянуть модель к финальному физ-кватерниону.
   * Верхняя грань/вершина физики станет верхней и у визуала,
   * поэтому цифра результата окажется наверху (d4 — вершина вверх).
   */
  settleTo: (q: readonly [number, number, number, number]) => void
  /** Направление на камеру из центра (для доворота грани к зрителю). */
  getViewDir: () => [number, number, number]
}

export const createViewer = (canvas: HTMLCanvasElement, overlay: HTMLElement): Viewer => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false, // фон задаём сценой — дешевле композитинга
    stencil: false, // стенсил-буфер не используем
    powerPreference: 'high-performance', // дискретная GPU, если есть
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x14161a)

  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  // IBL почти бесплатен (запечён в PMREM один раз), но даёт PBR-блики на графите и красном
  scene.environmentIntensity = 0.4

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
  // Камера строго спереди: результат гранью в экран без перспективных искажений
  camera.position.set(0, 0, 5.6)

  const controls = new OrbitControls(camera, canvas)
  controls.target.set(0, 0, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = 2
  controls.maxDistance = 12
  // Постоянного автовращения нет: камера стоит, крутить — только вручную.
  // Кувырок модели — только на время броска через setSpinning(true).
  controls.autoRotate = false
  controls.autoRotateSpeed = 2

  // Студийный свет для витрины (база product-viz: key/fill/rim, без лобового «фонаря»):
  // ключевой — сбоку-сверху под углом к камере (даёт форму, а не плоский блин),
  // заполняющий — слабо справа, контурный — сзади-сверху (отрывает кость от тёмного фона).
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3f4d, 0.25))

  const key = new THREE.DirectionalLight(0xfff1e0, 2.2)
  key.position.set(-3.5, 5, 2.5)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = -4
  key.shadow.camera.right = 4
  key.shadow.camera.top = 4
  key.shadow.camera.bottom = -4
  key.shadow.camera.near = 1
  key.shadow.camera.far = 20
  key.shadow.bias = -0.0005
  key.shadow.normalBias = 0.02
  scene.add(key)

  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5)
  fill.position.set(4, 1.5, 3.5)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0xffffff, 1.1)
  rim.position.set(1.5, 3.5, -4)
  scene.add(rim)

  const loader = new GLTFLoader()
  let current: THREE.Object3D | null = null
  let disposed = false
  let spinning = false
  let spinSpeed = 0.12
  let settling: { from: THREE.Quaternion; to: THREE.Quaternion; t: number } | null = null

  const setSpinning = (on: boolean) => {
    if (on) settling = null
    spinning = on && current !== null
    if (on) spinSpeed = 0.12
  }

  const settleTo = (q: readonly [number, number, number, number]): void => {
    if (!current || disposed) return
    spinning = false
    const from = current.quaternion.clone()
    const to = new THREE.Quaternion(q[0], q[1], q[2], q[3]).normalize()
    // Короткий путь: если кватернионы почти совпали — дотяжки не видно
    if (from.angleTo(to) < 1e-3) {
      settling = null
      current.quaternion.copy(to)
      return
    }
    settling = { from, to, t: 0 }
  }

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

  const load = (url: string, onLoad?: (tris: number) => void, onError?: () => void) => {
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
    if (spinning && current) {
      // Кувырок модели, пока идёт физический бросок (скорость затухает)
      current.rotation.x += spinSpeed
      current.rotation.y += spinSpeed * 1.3
      current.rotation.z += spinSpeed * 0.7
      spinSpeed = Math.max(0.02, spinSpeed * 0.998)
    } else if (settling && current) {
      // Плавная дотяжка к физ-ориентации (~0.45 с, easeOutCubic)
      settling.t = Math.min(1, settling.t + 1 / 28)
      const e = 1 - Math.pow(1 - settling.t, 3)
      current.quaternion.slerpQuaternions(settling.from, settling.to, e)
      if (settling.t >= 1) settling = null
    }
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

  const getViewDir = (): [number, number, number] => {
    // Мишень контролов — начало координат, кость отцентрирована туда же
    const v = camera.position.clone().sub(controls.target)
    const l = v.length() || 1
    return [v.x / l, v.y / l, v.z / l]
  }

  return { load, resize, update, dispose, setSpinning, settleTo, getViewDir }
}
