import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/800.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const VIEW_SIZE = 2.4

interface Viewer {
  load: (url: string, onLoad?: (tris: number) => void, onError?: () => void) => void
  resize: () => void
  update: () => void
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

  const showModel = (root: THREE.Object3D) => {
    if (current) {
      scene.remove(current)
      current = null
    }
    fitToView(root)
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
        const root = gltf.scene.children.length === 1 ? gltf.scene.children[0] : gltf.scene
        const tris = showModel(root)
        onLoad?.(tris)
      },
      undefined,
      () => onError?.(),
    )
  }

  const resize = () => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const update = () => {
    controls.update()
    renderer.render(scene, camera)
  }

  return { load, resize, update }
}

const MODELS = [
  { canvasId: 'scene1', overlayId: 'overlay1', infoId: 'info1', url: `${import.meta.env.BASE_URL}cad/cad-d6.glb`, source: 'FreeCAD 1.1.3' },
  { canvasId: 'scene2', overlayId: 'overlay2', infoId: 'info2', url: `${import.meta.env.BASE_URL}cad/cad-d6-openscad.glb`, source: 'OpenSCAD 2021.01' },
  { canvasId: 'scene3', overlayId: 'overlay3', infoId: 'info3', url: `${import.meta.env.BASE_URL}cad/cad-d6-cadquery.glb`, source: 'CadQuery 2.8.0' },
]

const viewers = MODELS.map(({ canvasId, overlayId, infoId, url, source }) => {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement
  const overlay = document.getElementById(overlayId) as HTMLDivElement
  const info = document.getElementById(infoId) as HTMLParagraphElement
  const viewer = createViewer(canvas, overlay)
  viewer.load(
    url,
    (tris) => {
      info.textContent = `${source} · ${tris.toLocaleString('ru-RU')} треугольников`
    },
    () => {
      overlay.hidden = false
      info.textContent = `${source} · не загрузилась`
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
  return viewer
})

const resize = () => {
  for (const viewer of viewers) viewer.resize()
}

const animate = () => {
  for (const viewer of viewers) viewer.update()
  requestAnimationFrame(animate)
}

window.addEventListener('resize', resize)
resize()
animate()