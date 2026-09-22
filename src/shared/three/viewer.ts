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
  camera.position.set(3.2, 2, 4.2)

  const controls = new OrbitControls(camera, canvas)
  controls.target.set(0, 0, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = 2
  controls.maxDistance = 12
  controls.autoRotate = true
  // Уважать prefers-reduced-motion: без автоповорота (a11y + батарея)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    controls.autoRotate = false
  }
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
  let spinning = false
  let spinSpeed = 0.12

  const setSpinning = (on: boolean) => {
    spinning = on && current !== null
    if (on) spinSpeed = 0.12
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

  return { load, resize, update, dispose, setSpinning }
}
