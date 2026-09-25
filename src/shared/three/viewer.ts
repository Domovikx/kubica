import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { ARENA_APOTHEM, FELT_APOTHEM, FRAME_H, FRAME_THICK } from '@/shared/arena/arena'

const VIEW_SIZE = 2.4
// Спин броска: ω(t) = SPIN_V0 · e^(−t/SPIN_TAU), стоп ниже SPIN_MIN.
// Экспонента + стабильная ось = залипательный профиль спиннера (см. docs/JUICE.md).
// Дотяжка к грани вплетается в затухание магнитом — отдельной фазы нет.
const SPIN_V0 = 15
const SPIN_TAU = 0.65
const SPIN_MIN = 0.4
// Угол складки для сглаживания: скругления (двугранный угол ~5–10°) сглаживаются,
// плоские грани и грани цифр (90°+) остаются чёткими
const CREASE_ANGLE = Math.PI / 5

export interface Viewer {
  load: (
    url: string,
    opts?: {
      physSize?: number
      initialQuat?: readonly [number, number, number, number]
    },
    onLoad?: (tris: number) => void,
    onError?: () => void,
  ) => void
  resize: () => void
  update: () => void
  dispose: () => void
  /** Косметическое кувыркание модели (только визуал; результат даёт физика). */
  setSpinning: (on: boolean, power?: number) => void
  /**
   * Дотянуть модель к финальному кватерниону магнитом, вплетённым в затухание
   * спина. Верхняя грань/вершина физики станет верхней и у визуала (d4 — вершина
   * вверх). onDone — в момент остановки (поп/тук/вибро).
   * Стенд калибровки (faceDebug-кнопки); боевой бросок идёт чистой физикой
   * + presentResult, без магнита.
   */
  settleTo: (q: readonly [number, number, number, number], onDone?: () => void) => void
  /**
   * Презентация результата: медленный доворот на месте (никакой физики внутри).
   * Плоскую — строго вокруг Y (плоская не наклоняется ни на градус, ≤0.55 с);
   * наклонённую (lay-flat после tilt-guard сетки, full=true) — полным slerp
   * к плоской цели короткой дугой, медленно (durMs ~0.9 с), чтобы читалось
   * осознанной укладкой дилера, а не рывком.
   */
  presentResult: (
    q: readonly [number, number, number, number],
    onDone?: () => void,
    durMs?: number,
    full?: boolean,
  ) => void
  /** Луч в кость по клиентским координатам: тап мимо кости — не бросок. */
  pickDie: (clientX: number, clientY: number) => boolean
  /** Текущая поза модели (для бесшовного спавна нового броска оттуда где лежит). */
  getPose: () => { pos: [number, number, number]; quat: [number, number, number, number] } | null
  /** Направление на камеру из центра (для доворота грани к зрителю). */
  getViewDir: () => [number, number, number]
  /**
   * Залипашка «потискать»: grabStart — зажал (камера стынет, кость крутится
   * и слушается палец), grabMove — трекбол 1:1. Релиз — ЧЕСТНЫЙ: сетка бросает
   * тело из позы руки (спавн pos+quat + флик-импульс), пружины возврата
   * и автоспина больше нет — они противоречили физике.
   * grabEnd() — только отпустить камеру и руку (без сайд-эффектов на модель).
   */
  grabStart: () => void
  grabMove: (dxPx: number, dyPx: number) => void
  grabEnd: () => void
  /**
   * Вектор флика из экранной скорости отпускания (мировая XZ + быстрота):
   * сетка превращает его в импульс физ-тела. Чистая проекция, без движения модели.
   */
  grabFlick: (vxPx: number, vyPx: number) => { x: number; z: number; speed: number }
  /**
   * Синхронизация модели с живым физ-телом (позиция + кватернион каждый тик).
   * Витрина = физика: никакого выдуманного спина, каждый бросок уникален.
   */
  syncBody: (
    pos: readonly [number, number, number],
    q: readonly [number, number, number, number],
  ) => void
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
  // Фон — вертикальный градиент студии (светлый верх, тёмный низ): пустота вокруг
  // лотка читается как сцена, а не баг. Один CanvasTexture 2×256, бесплатно.
  const bgCanvas = document.createElement('canvas')
  bgCanvas.width = 2
  bgCanvas.height = 256
  const bgCtx = bgCanvas.getContext('2d')
  if (bgCtx) {
    const grad = bgCtx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, '#23262d')
    grad.addColorStop(0.55, '#14161a')
    grad.addColorStop(1, '#0a0b0e')
    bgCtx.fillStyle = grad
    bgCtx.fillRect(0, 0, 2, 256)
    const bgTex = new THREE.CanvasTexture(bgCanvas)
    bgTex.colorSpace = THREE.SRGBColorSpace
    scene.background = bgTex
  } else {
    scene.background = new THREE.Color(0x14161a)
  }

  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  // IBL почти бесплатен (запечён в PMREM один раз), но даёт PBR-блики на графите и красном
  scene.environmentIntensity = 0.55

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500)
  // Камера сверху под ~28°: верхняя (результатная) грань читается, стол и дуги видны.
  // Строго спереди верх не прочитать — поэтому грань кладём, а камеру поднимаем.
  // ВРЕМЕННО для самокалибровки: ?top=1 — почти строго сверху (верхняя цифра крупно).
  const topDown = true // ВРЕМЕННО: диагностика вида сверху (убрать в финале вместе с raw)
  camera.position.set(0, topDown ? 30 : 18.6, topDown ? 11 : 32.6)

  const controls = new OrbitControls(camera, canvas)
  controls.target.set(0, 1.2, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  // Зум и орбита зажаты в постановочный диапазон: иначе скролл уносит камеру
  // за far-плоскость (чёрный экран) / внутрь кости (серая заливка) / под стол.
  controls.minPolarAngle = 0.05
  controls.maxPolarAngle = 1.45
  controls.zoomSpeed = 0.8
  controls.minDistance = 25
  controls.maxDistance = 90
  // Постоянного автовращения нет: камера стоит, крутить — только вручную.
  // Кувырок модели — только на время броска через setSpinning(true).
  controls.autoRotate = false
  controls.autoRotateSpeed = 2

  // Студийный свет для витрины (база product-viz: key/fill/rim, без лобового «фонаря»):
  // ключевой — сбоку-сверху под углом к камере (даёт форму, а не плоский блин),
  // заполняющий — слабо справа, контурный — сзади-сверху (отрывает кость от тёмного фона).
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a4f5a, 0.45))

  const key = new THREE.DirectionalLight(0xfff1e0, 2.2)
  key.position.set(-10, 15, 7.5)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = -34
  key.shadow.camera.right = 34
  key.shadow.camera.top = 34
  key.shadow.camera.bottom = -34
  key.shadow.camera.near = 1
  key.shadow.camera.far = 120
  key.shadow.bias = -0.0005
  key.shadow.normalBias = 0.02
  key.shadow.camera.updateProjectionMatrix()
  scene.add(key)

  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5)
  fill.position.set(12, 4.5, 10)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0xffffff, 1.1)
  rim.position.set(4.5, 10, -12)
  scene.add(rim)

  // Hex-лоток костей (см. docs/DICE_TRAY.md): фетровый пол = плоскость физики y=0,
  // деревянная рама внутренним краем ровно по 6 стенам физики (апофема ARENA_APOTHEM).
  // Hex дружит с камерой (симметрия 60°) и выглядит как настоящий D&D-лоток.
  // Размеры — из shared/arena (единый конфиг с физикой). Ноль ассетов: только PBR.
  const ARENA_A = ARENA_APOTHEM
  const FELT_A = FELT_APOTHEM
  const feltGeo = new THREE.CircleGeometry(FELT_A / Math.cos(Math.PI / 6), 6)
  feltGeo.rotateZ(Math.PI / 6)
  const felt = new THREE.Mesh(
    feltGeo,
    new THREE.MeshPhysicalMaterial({
      color: 0x701d1d,
      roughness: 1,
      metalness: 0,
      sheen: 1,
      sheenColor: new THREE.Color(0xa03a3a),
      sheenRoughness: 0.8,
    }),
  )
  felt.rotation.x = -Math.PI / 2
  felt.receiveShadow = true
  scene.add(felt)

  const woodMat = new THREE.MeshPhysicalMaterial({
    color: 0x4a3421,
    roughness: 0.65,
    metalness: 0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.5,
  })
  // Длина грани с напуском на стыки; длинная ось — по касательной к стене
  const sideLen = (ARENA_A + FRAME_THICK / 2) * 2 * Math.tan(Math.PI / 6) + FRAME_THICK
  const rimGeo = new THREE.BoxGeometry(sideLen, FRAME_H, FRAME_THICK)
  for (let i = 0; i < 6; i++) {
    const theta = (i * Math.PI) / 3
    const wall = new THREE.Mesh(rimGeo, woodMat)
    wall.position.set(
      Math.cos(theta) * (ARENA_A + FRAME_THICK / 2),
      FRAME_H / 2,
      Math.sin(theta) * (ARENA_A + FRAME_THICK / 2),
    )
    wall.rotation.y = -theta - Math.PI / 2
    wall.castShadow = true
    wall.receiveShadow = true
    scene.add(wall)
  }

  const loader = new GLTFLoader()
  let current: THREE.Object3D | null = null
  let disposed = false
  let spinning = false
  let spinAxis = new THREE.Vector3(0, 1, 0)
  let spinT = 0
  let spinV0 = SPIN_V0
  let lastT = performance.now()
  let settling: {
    to: THREE.Quaternion
    onDone: (() => void) | null
    startAngle: number
    baseY: number
    hopAmp: number
  } | null = null

  const setSpinning = (on: boolean, power = 1): void => {
    if (on) settling = null
    spinning = on && current !== null
    if (on) {
      spinT = 0
      spinV0 = SPIN_V0 * Math.max(0.2, power)
      spinAxis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ).normalize()
    }
  }

  const settleTo = (q: readonly [number, number, number, number], onDone?: () => void): void => {
    if (!current || disposed) return
    // Спин НЕ останавливаем: дотяжка вплетается в затухание —
    // отдельной бесячей фазы «подворота» нет
    const to = new THREE.Quaternion(q[0], q[1], q[2], q[3]).normalize()
    const startAngle = current.quaternion.angleTo(to)
    if (!spinning && startAngle < 1e-3) {
      current.quaternion.copy(to)
      onDone?.()
      return
    }
    // Хоп на посадке: углы не пропахивают пол, приземление читается (Disney: arc)
    settling = {
      to,
      onDone: onDone ?? null,
      startAngle,
      baseY: current.position.y,
      hopAmp: unitSize * 0.12,
    }
  }

  // Пружина возврата УДАЛЕНА (противоречила физике): релиз фиджета — бросок
  // тела из позы руки, решает сетка. Здесь только трекбол удержания.
  const tmpQ = new THREE.Quaternion()
  const tmpV = new THREE.Vector3()
  const UP_Y = new THREE.Vector3(0, 1, 0)
  const raycaster = new THREE.Raycaster()

  // Презентация результата: медленный доворот на месте (никакой физики внутри).
  // full=false: чистый yaw (плоская не наклоняется); full=true: полный slerp
  // короткой дугой (lay-flat наклонённой к плоской цели).
  let present: {
    from: THREE.Quaternion
    deltaYaw: number
    to: THREE.Quaternion
    full: boolean
    baseY: number
    onDone: (() => void) | null
    t: number
    dur: number
  } | null = null

  const yawOf = (q: THREE.Quaternion): number => {
    // Yaw почти-плоской ориентации: азимут её взгляда (slerp через большой yaw
    // наклонял бы кость — поэтому крутим строго вокруг мирового Y)
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
    return Math.atan2(f.x, f.z)
  }

  const presentResult = (
    q: readonly [number, number, number, number],
    onDone?: () => void,
    durMs = 550,
    full = false,
  ): void => {
    if (!current || disposed) return
    const to = new THREE.Quaternion(q[0], q[1], q[2], q[3]).normalize()
    if (current.quaternion.angleTo(to) < 0.035) {
      current.quaternion.copy(to)
      onDone?.()
      return
    }
    spinning = false
    settling = null
    // Чистый yaw: плоская остаётся плоской на всей траектории (вращение вокруг
    // мирового Y). Кратчайшая дуга [-π, π].
    let deltaYaw = yawOf(to) - yawOf(current.quaternion)
    while (deltaYaw > Math.PI) deltaYaw -= 2 * Math.PI
    while (deltaYaw < -Math.PI) deltaYaw += 2 * Math.PI
    present = {
      from: current.quaternion.clone(),
      deltaYaw,
      to,
      full,
      baseY: current.position.y,
      onDone: onDone ?? null,
      t: 0,
      dur: Math.max(0.2, durMs / 1000),
    }
  }

  const pickDie = (clientX: number, clientY: number): boolean => {
    if (!current || disposed) return false
    const rect = canvas.getBoundingClientRect()
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1)
    raycaster.setFromCamera({ x: nx, y: ny } as THREE.Vector2, camera)
    return raycaster.intersectObject(current, true).length > 0
  }

  let grab: {
    base: THREE.Vector3
    axis: THREE.Vector3
    holdT: number
    wAxis: THREE.Vector3
    wSpeed: number
    lastT: number
  } | null = null

  const grabStart = (): void => {
    if (!current || disposed) return
    spinning = false
    settling = null
    present = null
    controls.enabled = false
    const now = performance.now()
    grab = {
      base: current.position.clone(),
      axis: new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ).normalize(),
      holdT: 0,
      wAxis: new THREE.Vector3(0, 1, 0),
      wSpeed: 0,
      lastT: now,
    }
  }

  const grabMove = (dxPx: number, dyPx: number): void => {
    if (!grab || !current || disposed) return
    const now = performance.now()
    const dt = Math.min(0.1, Math.max(0.004, (now - grab.lastT) / 1000))
    grab.lastT = now
    const angle = 0.008 * Math.hypot(dxPx, dyPx)
    if (angle < 1e-6) return
    // Трекбол в кадре камеры: ось перпендикулярна направлению драга
    camera.updateMatrixWorld()
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    const axis = new THREE.Vector3().addScaledVector(right, -dyPx).addScaledVector(up, dxPx)
    if (axis.lengthSq() < 1e-12) return
    axis.normalize()
    tmpQ.setFromAxisAngle(axis, angle)
    current.quaternion.premultiply(tmpQ)
    const inst = angle / dt
    grab.wSpeed = grab.wSpeed * 0.7 + inst * 0.3
    grab.wAxis.lerp(axis, 0.4)
    if (grab.wAxis.lengthSq() > 1e-12) grab.wAxis.normalize()
  }

  // Релиз — только отпустить камеру и руку. Модель остаётся в позе руки:
  // сетка тут же спавнит тело оттуда (pos+quat) и швыряет по-настоящему.
  const grabEnd = (): void => {
    if (!grab || disposed) {
      grab = null
      return
    }
    controls.enabled = true
    grab = null
  }

  // Экранная скорость отпускания → мировой флик (XZ) + быстрота.
  // px/мс → мир/с через видимую высоту на дистанции камеры (как было).
  const grabFlick = (vxPx: number, vyPx: number): { x: number; z: number; speed: number } => {
    camera.updateMatrixWorld()
    const dist = camera.position.distanceTo(controls.target)
    const hPx = canvas.clientHeight || 1
    const wpp = (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / hPx
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    tmpV
      .set(0, 0, 0)
      .addScaledVector(right, vxPx * wpp)
      .addScaledVector(up, -vyPx * wpp)
    const cap = unitSize * 0.9
    if (tmpV.length() > cap) tmpV.setLength(cap)
    // Флик живёт в плоскости стола: вертикаль съедаем, бросок идёт дугой сам
    return { x: tmpV.x, z: tmpV.z, speed: Math.hypot(vxPx, vyPx) }
  }

  // Посадка модели: измеренный bbox GLB → AABB физ-тела (честный контакт).
  // Без physSize (чужие GLB из дропа) — legacy-витрина 2.4.
  let unitSize = VIEW_SIZE
  const seatModel = (root: THREE.Object3D, physSize?: number) => {
    const box0 = new THREE.Box3().setFromObject(root)
    const size0 = box0.getSize(new THREE.Vector3())
    const maxDim = Math.max(size0.x, size0.y, size0.z) || 1
    if (physSize && physSize > 0) {
      unitSize = physSize
      root.scale.setScalar(physSize / maxDim)
    } else {
      unitSize = VIEW_SIZE
      root.scale.setScalar(VIEW_SIZE / maxDim)
    }
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

  const showModel = (
    root: THREE.Object3D,
    physSize?: number,
    initialQuat?: readonly [number, number, number, number],
  ) => {
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
    seatModel(root, physSize)
    smoothShade(root)
    // Стартовая поза — тоже плашмя (гранью вниз), а не произвольный 3/4:
    // иначе кость стоит на ребре и выглядит парящей
    if (initialQuat) {
      root.quaternion.set(initialQuat[0], initialQuat[1], initialQuat[2], initialQuat[3])
      console.log('[pose] initialQuat applied')
    } else {
      root.rotation.set(0.42, 0.62, 0)
      console.log('[pose] fallback 3/4 (NO initialQuat!)')
    }
    // Низ ровно на стол, центр по XZ (после разворота — честный контакт)
    const box = new THREE.Box3().setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    root.position.x -= center.x
    root.position.z -= center.z
    root.position.y -= box.min.y
    // Кадр: кость — герой, но лоток виден (см. docs/DICE_TRAY.md).
    const size = box.getSize(new THREE.Vector3())
    const aspect = camera.aspect || 1
    const dieNeed = Math.max(size.y, size.x / aspect)
    const trayNeed = Math.max(2 * 18, (2 * (ARENA_APOTHEM + FRAME_THICK)) / aspect) * 0.94
    const need = Math.max(dieNeed, Math.min(trayNeed, dieNeed * (aspect >= 1 ? 3 : 1.5)))
    const dist = Math.max(
      20,
      (need * 0.5 * 1.25) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)),
    )
    const finalDist = dist
    controls.target.set(0, size.y / 2, 0)
    const viewDir = camera.position.clone().sub(controls.target)
    if (viewDir.lengthSq() < 1e-9) viewDir.set(0, 0.3, 1)
    viewDir.normalize()
    controls.minDistance = finalDist * 0.55
    controls.maxDistance = finalDist * 1.4
    camera.position.copy(controls.target).addScaledVector(viewDir, finalDist)
    scene.add(root)
    current = root
    overlay.hidden = true
    return countTriangles(root)
  }

  const load = (
    url: string,
    opts?: { physSize?: number; initialQuat?: readonly [number, number, number, number] },
    onLoad?: (tris: number) => void,
    onError?: () => void,
  ) => {
    loader.load(
      url,
      (gltf) => {
        if (disposed) return
        const root = gltf.scene.children.length === 1 ? gltf.scene.children[0] : gltf.scene
        const tris = showModel(root, opts?.physSize, opts?.initialQuat)
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
    const now = performance.now()
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000))
    lastT = now
    if (current && (spinning || settling || grab || present)) {
      // Экспоненциальное затухание вокруг стабильной оси (гироскоп спиннера)
      let speed = 0
      if (spinning) {
        spinT += dt
        speed = spinV0 * Math.exp(-spinT / SPIN_TAU)
        if (speed < SPIN_MIN) {
          spinning = false
          speed = 0
        } else {
          current.rotateOnAxis(spinAxis, speed * dt)
        }
      }
      // Магнит к грани результата: слаб на скорости, жёсток к остановке.
      // Кость сама выруливает по мере успокоения — рывка смены фаз нет.
      if (settling) {
        const pull = 0.3 + 3.5 * (1 - Math.min(1, speed / spinV0))
        current.quaternion.slerp(settling.to, 1 - Math.exp(-pull * dt))
        const ang = current.quaternion.angleTo(settling.to)
        const prog = settling.startAngle > 1e-3 ? 1 - Math.min(1, ang / settling.startAngle) : 1
        current.position.y = settling.baseY + settling.hopAmp * Math.sin(Math.PI * prog)
        if (ang < 0.02 && speed < 0.8) {
          current.quaternion.copy(settling.to)
          current.position.y = settling.baseY
          const done = settling.onDone
          settling = null
          done?.()
        }
      }
      // Залипашка: автоспин-ап пока держим (трекбол выше крутит модель 1:1).
      // Релиз — дело сетки (физбросок из позы руки), пружины возврата нет.
      if (grab) {
        grab.holdT += dt
        const auto = Math.min(10, 2 + grab.holdT * 5)
        tmpQ.setFromAxisAngle(grab.axis, auto * dt)
        current.quaternion.premultiply(tmpQ)
        // Подобрали с пола: плавный подъём в руку (углы не цепляют стол)
        const liftY = grab.base.y + unitSize * 0.25
        current.position.y += (liftY - current.position.y) * Math.min(1, dt * 8)
      }
      // Презентация результата: медленный доворот на месте, ease-in-out.
      // Поза и момент остановки — от физики; yaw — эстетика, lay-flat (full) —
      // осознанная укладка наклонённой плашмя. Плоская не наклоняется ни на градус.
      if (present) {
        present.t += dt
        const k = Math.min(1, present.t / present.dur)
        const e = k * k * (3 - 2 * k)
        if (present.full) {
          current.quaternion.slerpQuaternions(present.from, present.to, e)
          // Чуть приподнимаем в середине укладки: углы не скребут фетр
          current.position.y = present.baseY + unitSize * 0.06 * Math.sin(Math.PI * Math.min(1, k))
        } else {
          tmpQ.setFromAxisAngle(UP_Y, present.deltaYaw * e)
          current.quaternion.copy(tmpQ.multiply(present.from))
        }
        if (k >= 1) {
          const done = present.onDone
          present = null
          done?.()
        }
      }
    }
    controls.update()
    renderer.render(scene, camera)
  }

  const dispose = () => {
    disposed = true
    grab = null
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
    const v = camera.position.clone().sub(controls.target)
    const l = v.length() || 1
    return [v.x / l, v.y / l, v.z / l]
  }

  const getPose = (): {
    pos: [number, number, number]
    quat: [number, number, number, number]
  } | null => {
    if (!current || disposed) return null
    return {
      pos: [current.position.x, current.position.y, current.position.z],
      quat: [
        current.quaternion.x,
        current.quaternion.y,
        current.quaternion.z,
        current.quaternion.w,
      ],
    }
  }

  // ВРЕМЕННО для диагностики кадра (удалить после калибровки)
  const w = window as unknown as { __vdbg?: unknown }
  w.__vdbg = {
    camera,
    controls,
    canvas,
    getBox: () => {
      if (!current) return null
      const box = new THREE.Box3().setFromObject(current)
      const kids: Array<{
        name: string
        type: string
        min: number[]
        max: number[]
        local: number[][] | null
        tris: number
      }> = []
      current.updateWorldMatrix(true, true)
      current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh
          const b = new THREE.Box3().setFromObject(mesh)
          const pos = mesh.geometry.getAttribute('position')
          const idx = mesh.geometry.getIndex()
          mesh.geometry.computeBoundingBox()
          const lb = mesh.geometry.boundingBox
          kids.push({
            name: mesh.name || '(noname)',
            type: mesh.type,
            min: b.min.toArray().map((n) => +n.toFixed(2)),
            max: b.max.toArray().map((n) => +n.toFixed(2)),
            local: lb
              ? [
                  lb.min.toArray().map((n) => +n.toFixed(2)),
                  lb.max.toArray().map((n) => +n.toFixed(2)),
                ]
              : null,
            tris: Math.round((idx ? idx.count : pos ? pos.count : 0) / 3),
          })
        }
      })
      return {
        min: box.min.toArray(),
        max: box.max.toArray(),
        pos: current.position.toArray(),
        quat: current.quaternion.toArray(),
        scale: current.scale.x,
        children: current.children.length,
        kids,
      }
    },
  }

  const syncBody = (
    pos: readonly [number, number, number],
    q: readonly [number, number, number, number],
  ): void => {
    if (!current || disposed) return
    current.position.set(pos[0], pos[1], pos[2])
    current.quaternion.set(q[0], q[1], q[2], q[3])
  }

  return {
    load,
    resize,
    update,
    dispose,
    setSpinning,
    settleTo,
    presentResult,
    pickDie,
    getViewDir,
    getPose,
    grabStart,
    grabMove,
    grabEnd,
    grabFlick,
    syncBody,
  }
}
