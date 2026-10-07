// Общий стеклянный стол: одна сцена/камера снизу, N костей-мешей.
// Сознательно повторяет настройку сцены viewer.ts (свет/кадр/твины), а не
// переиспользует Viewer: одиночные витрины — эталоны, их не рефакторим.
// Консолидация в stage-фабрику — follow-up 2.7.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { GLASS_HALF_X, GLASS_HALF_Z } from '@/shared/arena/arena'

const CREASE_ANGLE = Math.PI / 5

export interface TablePose {
  pos: [number, number, number]
  quat: [number, number, number, number]
}

interface DieView {
  root: THREE.Object3D
  unitSize: number
  /** Центр кости в локальных координатах root (для пивота spinDie). */
  localCenter: THREE.Vector3
  present: {
    from: THREE.Quaternion
    to: THREE.Quaternion
    baseY: number
    hopAmp: number
    onDone: (() => void) | null
    t: number
    dur: number
  } | null
  glide: {
    fromX: number
    fromZ: number
    toX: number
    toZ: number
    onDone: (() => void) | null
    t: number
    dur: number
  } | null
  /** Зарядка (wind-up): база для кувырка; null — не в зарядке. */
  wind: {
    pos: THREE.Vector3
    quat: THREE.Quaternion
    axis: THREE.Vector3
    /** Фазы «пьяного» дрейфа оси: удержание не детерминировано (античит). */
    ph: [number, number, number]
    /**
     * Winddown/подхват: null — активная зарядка. 'full'/'spin' — плавное
     * гашение без броска (~0.4 с); 'handoff' — кувырок продолжается, пока
     * сливка не закончится; после первого syncBody axis/mag хранят реальное
     * ω тела (unit-ось + величина) — вращение в броске продолжается, а не
     * сменяется чужой осью.
     */
    down: {
      t: number
      mode: 'full' | 'spin' | 'handoff'
      axis?: THREE.Vector3
      mag?: number
    } | null
  } | null
  /**
   * Подхват физики: ~0.3 с сливки — позиция от точки подхвата к летящему
   * телу, ориентация от ЖИВОГО кувырка (spinQ) к кватерниону тела: ось и
   * скорость вращения не обрываются (фидбек «раскрутка должна продолжиться»).
   */
  blend: {
    t0: number
    fromPos: THREE.Vector3
    toPos: [number, number, number]
    toQuat: THREE.Quaternion
  } | null
  /**
   * Накопитель вращения кувырка на время сливки: пока идёт blend, tumble
   * крутит этот кватернион, а root = slerp(spinQ, тело) — исходник вращения
   * живёт и на подхвате, без стоп-кадра и «чужого» геодезианта.
   */
  spinQ: THREE.Quaternion | null
}

export interface Table {
  /** Положить кость на стол (слот XZ, низ ровно на y=0). */
  addDie: (
    id: string,
    url: string,
    opts?: {
      physSize?: number
      slot?: readonly [number, number]
      initialQuat?: readonly [number, number, number, number]
    },
    onLoad?: () => void,
    onError?: () => void,
  ) => void
  removeDie: (id: string) => void
  hasDie: (id: string) => boolean
  /**
   * Живая синхронизация с физ-телом (позиция + кватернион каждый тик).
   * omega — вектор ω тела (репорт физики): в режиме подхвата его ось/величина
   * становятся целью кувырка, чтобы вращение продолжалось, а не менялось.
   */
  syncBody: (
    id: string,
    pos: readonly [number, number, number],
    q: readonly [number, number, number, number],
    omega?: readonly [number, number, number],
  ) => void
  /** Одно движение сразу на финальную позу (низ ровно + цифра прямо). */
  presentTo: (
    id: string,
    q: readonly [number, number, number, number],
    onDone?: () => void,
    durMs?: number,
  ) => void
  /** Плавный возврат в слот по полу (поза не трогается). */
  glideTo: (id: string, x: number, z: number, onDone?: () => void, durMs?: number) => void
  /** Луч в любую кость: тап мимо костей — не бросок. */
  pickAny: (clientX: number, clientY: number) => boolean
  /** Луч в конкретную кость: id инстанса (key) или null. */
  pickDieId: (clientX: number, clientY: number) => string | null
  /**
   * Точка экрана над любой костью (сетка пикселей от центра → raycast).
   * Для тестов/чекеров: тап по кости без угадывания координат ±48px.
   */
  findDiePoint: () => { x: number; y: number } | null
  /**
   * Трекбол-вращение кости вокруг ЕЁ центра (все 3 оси; dx/dy — пиксели драга).
   * Чисто визуальный осмотр: физика и результат не трогаются. Игнорируется во
   * время present/glide — их onDone-цепочки (результат → разъезд → rolling=false)
   * обязаны дойти до конца, иначе стол навсегда залипнет в «Бросаем…».
   */
  spinDie: (id: string, dxPx: number, dyPx: number) => void
  /**
   * Зарядка броска (wind-up): кости приподнимаются в «руку» и хаотично
   * кувыркаются (пьяная прецессия с рандомными фазами — позу/момент релиза
   * не подгадать, античит); позиционной тряски нет (фидбек: приятнее одно
   * вращение). restore=false — режим подхвата: кувырок продолжается до
   * окончания сливки (~0.3 с, см. syncBody), а с первого syncBody его ось и
   * скорость уходят в реальное ω тела — вращение на броске продолжается,
   * а не сменяется «чем-то иным»; без физики снимается по таймауту ~1 с.
   * restore=true/'spin' — гашение без броска плавным winddown ~0.4 с
   * (фидбек «скорость 10 → резко 5»): кувырок затухает, посадка в базу без
   * телепорта; в режиме 'spin' у keepId кватернион юзера остаётся.
   */
  windup: (on: boolean, restore?: boolean | 'spin', keepId?: string) => void
  /**
   * Приглушить кость до первого броска (грани есть, но «не горят» —
   * иначе цифры читаются как состоявшийся результат).
   */
  dimDie: (id: string, dimmed: boolean) => void
  getPose: (id: string) => TablePose | null
  getViewDir: () => [number, number, number]
  /**
   * Экранная скорость релиза (px/мс) → мировой швырок XZ: проекция через
   * колонки камеры (как grabFlick витрины), вертикаль стола едим; норма —
   * 1.5 px/мс ≈ сильный рывок → 8 ед/с, потолок там же.
   */
  flickVec: (vxPx: number, vyPx: number) => { x: number; z: number }
  /** Пересчитать кадр под новый размер пачки (без пересоздания сцены). */
  setFit: (hx: number, hz: number) => void
  /**
   * Плавно вернуть камеру в дефолт (после броска: юзер крутил/зумил —
   * стол сам встаёт ровно). Контролы на время доводки глушим.
   */
  resetView: (onDone?: () => void, durMs?: number) => void
  resize: () => void
  update: () => void
  dispose: () => void
}

export const createTable = (
  canvas: HTMLCanvasElement,
  opts?: { hx?: number; hz?: number; orbit?: boolean },
): Table => {
  // Кадр под конкретную пачку (по умолчанию — под 1–2 кости).
  // Это НЕ границы физики (их считает виджет по inner-прямоугольнику канвы):
  // камера обязана держать кости крупно при любом N.
  let fitHx = opts?.hx ?? GLASS_HALF_X
  let fitHz = opts?.hz ?? GLASS_HALF_Z
  const setFit = (hx: number, hz: number): void => {
    fitHx = hx
    fitHz = hz
    frameCamera()
  }
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    // Прозрачная канва: подложка-градиент живёт в CSS (.mtable), а под ней —
    // водяной знак «Kubica» (mobile-table), который иначе не виден.
    alpha: true,
    stencil: false,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  // Теней нет: принимать нечего (поверхности нет), только цена на мобайле.
  renderer.shadowMap.enabled = false
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15

  const scene = new THREE.Scene()
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
    // Фон сцены не рисуем (scene.background = null): градиент переехал в CSS
    // (.mtable) — так сквозь канву виден водяной знак. bgCanvas/градиент
    // оставлены для сверки палитры (2px эталон).
    new THREE.CanvasTexture(bgCanvas)
  }

  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.55

  // Камера строго под столом (вид снизу вверх). Эпсилон по Z против
  // вырождения up-вектора.
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 500)
  camera.position.set(0, -60, 0.01)

  const controls = new OrbitControls(camera, canvas)
  controls.target.set(0, 1.2, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  // Стол разрешает орбиту — его можно подвигать; тап от драга отличаем порогом 8px/500мс.
  controls.enableRotate = opts?.orbit === true
  // В орбите разрешаем небольшой наклон (иначе стол не «подвигать»,
  // только крутить). Презентация доводит цифры под текущий ракурс сама.
  controls.minPolarAngle = opts?.orbit === true ? Math.PI - 0.6 : Math.PI - 0.05
  controls.maxPolarAngle = Math.PI
  controls.zoomSpeed = 0.8
  controls.autoRotate = false

  // Студийный свет + подсветка снизу (камера-наблюдатель видит нижние грани).
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a4f5a, 0.45))
  const key = new THREE.DirectionalLight(0xfff1e0, 2.2)
  key.position.set(-10, 15, 7.5)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5)
  fill.position.set(12, 4.5, 10)
  scene.add(fill)
  const rim = new THREE.DirectionalLight(0xffffff, 1.1)
  rim.position.set(4.5, 10, -12)
  scene.add(rim)
  const under = new THREE.DirectionalLight(0xffe9d0, 1.4)
  under.position.set(6, -12, 8)
  scene.add(under)

  const loader = new GLTFLoader()
  const dice = new Map<string, DieView>()
  let disposed = false
  // Кэш шаблонов GLB по URL: пачка 8d6 грузит файл один раз, инстансы —
  // клоны (иначе 8 сетевых загрузок и кнопка долго disabled без фидбека).
  // Геометрия общая, материалы клонируем под инстанс (подсветка kept/dropped
  // в 2.8 не должна красить всех близнецов сразу).
  const templateCache = new Map<string, Promise<THREE.Object3D>>()
  const loadTemplate = (url: string): Promise<THREE.Object3D> => {
    const hit = templateCache.get(url)
    if (hit) return hit
    const p = new Promise<THREE.Object3D>((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          const src = gltf.scene.children.length === 1 ? gltf.scene.children[0] : gltf.scene
          src.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const smoothed = toCreasedNormals(child.geometry, CREASE_ANGLE)
              child.geometry.dispose()
              child.geometry = smoothed
            }
          })
          resolve(src)
        },
        undefined,
        () => reject(new Error(`table: GLB не загрузился: ${url}`)),
      )
    })
    templateCache.set(url, p)
    return p
  }
  let lastT = performance.now()
  const raycaster = new THREE.Raycaster()

  // Дом камеры (дефолт orbit-режима): frameCamera его обновляет,
  // resetView плавно возвращает.
  const home = {
    pos: new THREE.Vector3(0, -60, 0.01),
    target: new THREE.Vector3(0, 1.2, 0),
  }
  let camTween: {
    fromPos: THREE.Vector3
    fromTarget: THREE.Vector3
    onDone: (() => void) | null
    t: number
    dur: number
  } | null = null

  const frameCamera = () => {
    // Вписываем содержимое стола целиком (границы физики невидимы и шире —
    // их в кадр не тянем, иначе кости станут микробами).
    const aspect = camera.aspect || 1
    const need = Math.max(2 * fitHz, (2 * fitHx) / aspect)
    const dist = Math.max(
      20,
      (need * 0.5 * 1.25) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)),
    )
    controls.target.set(0, 1.2, 0)
    controls.minDistance = dist * 0.55
    controls.maxDistance = dist * 1.4
    // Ближняя/дальняя — под фактический диапазон дистанций: при tele-fov
    // (малый угол → большая дистанция) статичные 0.1/500 обрезали кости по
    // far на отъезде (пустой кадр), а ratio far/near держим ≈33 для глубины.
    camera.near = Math.max(0.5, controls.minDistance * 0.1)
    camera.far = Math.max(camera.near * 50, controls.maxDistance * 1.3)
    camera.updateProjectionMatrix()
    camera.position.set(0, -dist, 0.01)
    home.pos.copy(camera.position)
    home.target.copy(controls.target)
  }

  const resetView: Table['resetView'] = (onDone, durMs = 700) => {
    if (disposed) {
      onDone?.()
      return
    }
    if (
      camera.position.distanceToSquared(home.pos) < 1e-4 &&
      controls.target.distanceToSquared(home.target) < 1e-4
    ) {
      onDone?.()
      return
    }
    controls.enabled = false
    camTween = {
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      onDone: onDone ?? null,
      t: 0,
      dur: Math.max(0.2, durMs / 1000),
    }
  }

  const disposeDie = (view: DieView) => {
    scene.remove(view.root)
    // Геометрия — общая из кэша шаблонов (её не трогаем), материалы инстанса —
    // клоны (dispose безопасен, соседних близнецов не гасит).
    view.root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        for (const m of mats) m.dispose()
      }
    })
  }

  const addDie: Table['addDie'] = (id, url, opts, onLoad, onError) => {
    void loadTemplate(url).then(
      (template) => {
        if (disposed) return
        // Перестройка набора пересоздаёт меши: старый инстанс убираем первым,
        // иначе два тела с одним id висят в сцене до колбэка.
        if (dice.has(id)) {
          const stale = dice.get(id)
          if (stale) disposeDie(stale)
          dice.delete(id)
        }
        const old = dice.get(id)
        if (old) disposeDie(old)
        const root = template.clone(true)
        root.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = Array.isArray(child.material)
              ? child.material.map((m) => m.clone())
              : child.material.clone()
          }
        })
        // Масштаб в размер физ-тела (как витрина: измеренный bbox → physSize).
        const box0 = new THREE.Box3().setFromObject(root)
        const size0 = box0.getSize(new THREE.Vector3())
        const maxDim = Math.max(size0.x, size0.y, size0.z) || 1
        const unitSize = opts?.physSize && opts.physSize > 0 ? opts.physSize : 2.4
        root.scale.setScalar(unitSize / maxDim)
        if (opts?.initialQuat) {
          root.quaternion.set(
            opts.initialQuat[0],
            opts.initialQuat[1],
            opts.initialQuat[2],
            opts.initialQuat[3],
          )
        }
        // Низ ровно на y=0, XZ в слот.
        const box = new THREE.Box3().setFromObject(root)
        const center = box.getCenter(new THREE.Vector3())
        root.position.x = (opts?.slot?.[0] ?? 0) - center.x * root.scale.x
        root.position.z = (opts?.slot?.[1] ?? 0) - center.z * root.scale.x
        root.position.y -= box.min.y
        scene.add(root)
        // Центр геометрии в локальном пространстве root: пивот трекбола,
        // чтобы кость вращалась вокруг себя, а не уезжала.
        root.updateWorldMatrix(true, true)
        const localCenter = new THREE.Box3()
          .setFromObject(root)
          .getCenter(new THREE.Vector3())
          .applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert())
        dice.set(id, {
          root,
          unitSize,
          localCenter,
          present: null,
          glide: null,
          wind: null,
          blend: null,
          spinQ: null,
        })
        frameCamera()
        onLoad?.()
      },
      () => {
        if (!disposed) onError?.()
      },
    )
  }

  const removeDie: Table['removeDie'] = (id) => {
    const view = dice.get(id)
    if (!view) return
    disposeDie(view)
    dice.delete(id)
  }

  /** Длительность сливки позы зарядки с телом при подхвате физики. */
  const HANDOFF_MS = 300
  /** Физика не пришла за позой (ошибка) — снимаем зарядку, а не крутим вечно. */
  const HANDOFF_TIMEOUT_MS = 1000
  const syncBody: Table['syncBody'] = (id, pos, q, omega) => {
    const view = dice.get(id)
    if (!view || disposed) return
    view.present = null
    view.glide = null
    const w = view.wind
    if (w?.down?.mode === 'handoff') {
      const down = w.down
      // Реальное ω тела — цель оси и скорости кувырка (обновляется каждый
      // подшаг): к моменту окончания сливки вращение уже совпадает с физикой.
      // Только репорт физики, на поток random() не влияет (античит цел).
      if (omega) {
        const len = Math.hypot(omega[0], omega[1], omega[2])
        if (len > 1e-6) {
          if (!down.axis) down.axis = new THREE.Vector3()
          down.axis.set(omega[0] / len, omega[1] / len, omega[2] / len)
          down.mag = len
        }
      }
      // Позу ведёт кувырок (spinQ продолжает крутиться, см. tumble), сюда —
      // только цель: update() каждый кадр собирает сливку из живого вращения
      // к телу. Первый подхват семет blend из текущей позы — щелчка нет.
      if (!view.blend) {
        view.spinQ = view.root.quaternion.clone()
        view.blend = {
          t0: performance.now(),
          fromPos: view.root.position.clone(),
          toPos: [pos[0], pos[1], pos[2]],
          toQuat: new THREE.Quaternion(q[0], q[1], q[2], q[3]),
        }
        return
      }
      view.blend.toPos = [pos[0], pos[1], pos[2]]
      view.blend.toQuat.set(q[0], q[1], q[2], q[3])
      return
    }
    view.root.position.set(pos[0], pos[1], pos[2])
    view.root.quaternion.set(q[0], q[1], q[2], q[3])
  }

  const presentTo: Table['presentTo'] = (id, q, onDone, durMs = 650) => {
    const view = dice.get(id)
    if (!view || disposed) {
      onDone?.()
      return
    }
    // Позу под свой контроль: зарядка/сливка подхвата кончились.
    view.wind = null
    view.blend = null
    view.spinQ = null
    const to = new THREE.Quaternion(q[0], q[1], q[2], q[3]).normalize()
    if (view.root.quaternion.angleTo(to) < 0.035) {
      view.root.quaternion.copy(to)
      onDone?.()
      return
    }
    view.glide = null
    view.present = {
      from: view.root.quaternion.clone(),
      to,
      baseY: view.root.position.y,
      hopAmp: view.unitSize * 0.06,
      onDone: onDone ?? null,
      t: 0,
      dur: Math.max(0.2, durMs / 1000),
    }
  }

  const glideTo: Table['glideTo'] = (id, x, z, onDone, durMs = 500) => {
    const view = dice.get(id)
    if (!view || disposed) {
      onDone?.()
      return
    }
    if (Math.hypot(x - view.root.position.x, z - view.root.position.z) < 1e-3) {
      onDone?.()
      return
    }
    view.present = null
    // Позу под свой контроль: зарядка/сливка подхвата кончились.
    view.wind = null
    view.blend = null
    view.spinQ = null
    view.glide = {
      fromX: view.root.position.x,
      fromZ: view.root.position.z,
      toX: x,
      toZ: z,
      onDone: onDone ?? null,
      t: 0,
      dur: Math.max(0.2, durMs / 1000),
    }
  }

  const DIM_KEY = 'kubicaDimOrig'
  const dimDie: Table['dimDie'] = (id, dimmed) => {
    const view = dice.get(id)
    if (!view || disposed) return
    view.root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      for (const m of mats) {
        const mat = m as THREE.MeshStandardMaterial
        if (!('color' in mat) || mat.color === undefined) continue
        const ud = mat.userData as Record<string, unknown>
        if (dimmed) {
          if (typeof ud[DIM_KEY] !== 'number') ud[DIM_KEY] = mat.color.getHex()
          const orig = new THREE.Color(ud[DIM_KEY] as number)
          // Тело — в плоский графит, а цифры (белые / legacy-красные) лишь притухают:
          // иначе кость выглядит сломанной болванкой без граней.
          const isRedDigit = orig.r > 0.5 && orig.r > orig.g * 1.6 && orig.r > orig.b * 1.6
          const isWhiteDigit = orig.r > 0.8 && orig.g > 0.8 && orig.b > 0.8
          const isDigit = isRedDigit || isWhiteDigit
          if (isDigit) mat.color.copy(orig).multiplyScalar(0.45)
          else mat.color.setHex(0x4a4d55)
        } else if (typeof ud[DIM_KEY] === 'number') {
          mat.color.setHex(ud[DIM_KEY] as number)
        }
      }
    })
  }

  const pickDieId: Table['pickDieId'] = (clientX, clientY) => {
    if (disposed) return null
    const rect = canvas.getBoundingClientRect()
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1)
    raycaster.setFromCamera({ x: nx, y: ny } as THREE.Vector2, camera)
    for (const [id, view] of dice) {
      if (raycaster.intersectObject(view.root, true).length > 0) return id
    }
    return null
  }

  const pickAny: Table['pickAny'] = (clientX, clientY) => pickDieId(clientX, clientY) !== null

  const findDiePoint: Table['findDiePoint'] = () => {
    if (disposed || dice.size === 0) return null
    const rect = canvas.getBoundingClientRect()
    const step = 16
    const order = (len: number): number[] => {
      const a: number[] = []
      for (let v = step / 2; v < len; v += step) a.push(v)
      const c = len / 2
      return a.sort((p, q) => Math.abs(p - c) - Math.abs(q - c))
    }
    for (const dx of order(rect.width)) {
      for (const dy of order(rect.height)) {
        const x = rect.left + dx
        const y = rect.top + dy
        if (pickDieId(x, y)) return { x, y }
      }
    }
    return null
  }

  // Трекбол кости: дельта-поворот вокруг ЕЁ геометрического центра в мире.
  // Ось — в кадре камеры (как grabMove витрины): drag вправо крутит кость
  // «как пальцем по поверхности». Позиция пивотится вместе с кватернионом,
  // чтобы центр не уезжал (локальный origin GLB ≈ центру, но не полагаемся).
  const spinTmpC = new THREE.Vector3()
  const spinTmpO = new THREE.Vector3()
  const spinDQ = new THREE.Quaternion()
  const spinDie: Table['spinDie'] = (id, dxPx, dyPx) => {
    const view = dice.get(id)
    if (!view || disposed || view.present || view.glide) return
    const angle = 0.008 * Math.hypot(dxPx, dyPx)
    if (angle < 1e-6) return
    camera.updateMatrixWorld()
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    // Пальец тащит точку ПОД ним: драг вправо → точка вправо (вокруг up,+),
    // драг вниз → точка вниз (вокруг right,+). Старый минус у dy давал
    // инверсию вертикали (вверх/вниз наоборот при корректных лево/право).
    const axis = new THREE.Vector3().addScaledVector(right, dyPx).addScaledVector(up, dxPx)
    if (axis.lengthSq() < 1e-12) return
    spinDQ.setFromAxisAngle(axis.normalize(), angle)
    const s = view.root.scale.x
    const center = spinTmpC
      .copy(view.localCenter)
      .multiplyScalar(s)
      .applyQuaternion(view.root.quaternion)
      .add(view.root.position)
    const offset = spinTmpO.copy(view.root.position).sub(center).applyQuaternion(spinDQ)
    view.root.quaternion.premultiply(spinDQ)
    view.root.position.copy(center).add(offset)
  }

  // Зарядка (wind-up): кувырок с пьяной прецессией + плавный подъём в «руку»
  // (тряски позиции нет — фидбек: приятнее одно вращение). Фазы дрейфа
  // рандомны на каждый старт — позу/момент релиза не подгадать.
  let windOn = false
  let windT = 0
  const windTmpV = new THREE.Vector3()
  const windTmpQ = new THREE.Quaternion()
  /** Длительность плавного гашения кувырка без броска (фидбек «резкий стоп»). */
  const WIND_DOWN_MS = 400
  type WindView = NonNullable<DieView['wind']>
  /**
   * Профиль скорости кувырка: ease-in старт (без щелчка 0→4) и cap ≈
   * типичному спавн-ω физики (6–15 при заряде) — на моменте броска
   * ступеньки «скорость 10 → резко 5» нет. Чисто визуальный: честность
   * броска (поток ω, пол, поза) не зависит от профиля.
   */
  const windAuto = (): number => Math.min(10, 3 + windT * 5.5) * Math.min(1, windT / 0.3)
  /**
   * Кувырок вокруг центра (пивот как в spinDie), скорость — speed·dt.
   * Обычно ось плавно дрейфует («пьяный» прецесс); в режиме подхвата сливки
   * ось уходит в реальное ω тела (цель из syncBody) — вращение на броске
   * продолжается, а не подменяется. Ротация в подхвате копится в view.spinQ
   * (root собирает update: root = slerp(spinQ, тело)) — исходник вращения
   * живёт до конца сливки, стоп-кадра нет.
   */
  const tumble = (view: DieView, w: WindView, speed: number, dt: number): void => {
    const down = w.down
    const blending = down?.mode === 'handoff' && view.blend !== null && view.spinQ !== null
    if (blending && down?.axis && view.blend) {
      // Сходимость к оси ω тела ровно за время сливки (цель обновляет
      // syncBody каждый подшаг): к k=1 ось и скорость совпали с физикой.
      const k = Math.min(1, (performance.now() - view.blend.t0) / HANDOFF_MS)
      windTmpV.copy(down.axis)
      w.axis.lerp(windTmpV, Math.min(1, k)).normalize()
    } else if (down?.mode !== 'handoff') {
      windTmpV
        .set(
          Math.sin(1.9 * windT + w.ph[0]),
          Math.sin(2.7 * windT + w.ph[1]),
          Math.sin(1.3 * windT + w.ph[2]),
        )
        .normalize()
      w.axis.lerp(windTmpV, Math.min(1, dt * 2)).normalize()
    }
    // Подхват до seed (первый syncBody): ось пока замирает — доли секунды.
    windTmpQ.setFromAxisAngle(w.axis, speed * dt)
    const target = view.blend && view.spinQ ? view.spinQ : view.root.quaternion
    const s = view.root.scale.x
    const center = spinTmpC
      .copy(view.localCenter)
      .multiplyScalar(s)
      .applyQuaternion(view.root.quaternion)
      .add(view.root.position)
    const offset = spinTmpO.copy(view.root.position).sub(center).applyQuaternion(windTmpQ)
    target.premultiply(windTmpQ)
    view.root.position.copy(center).add(offset)
  }
  /**
   * Кадр активной зарядки/подхвата: кувырок + плавный подъём в «руку»
   * (позиционной тряски нет). В подхвате скорость плавно уходит в |ω| тела
   * (цель из syncBody) — ступеньки «10 → 5» нет, раскрутка продолжается.
   */
  const windFrame = (view: DieView, w: WindView, dt: number): void => {
    let speed = windAuto()
    const down = w.down
    if (down?.mode === 'handoff' && down.mag !== undefined && view.blend) {
      const k = Math.min(1, (performance.now() - view.blend.t0) / HANDOFF_MS)
      speed += (down.mag - speed) * k
    }
    tumble(view, w, speed, dt)
    const follow = Math.min(1, dt * 10)
    view.root.position.x += (w.pos.x - view.root.position.x) * follow
    view.root.position.y += (w.pos.y + view.unitSize * 0.25 - view.root.position.y) * follow
    view.root.position.z += (w.pos.z - view.root.position.z) * follow
  }
  const windup: Table['windup'] = (on, restore = true, keepId) => {
    if (disposed) return
    if (on) {
      if (windOn) return
      windOn = true
      windT = 0
      for (const view of dice.values()) {
        // Возобновление после winddown: якорь базы не пересоздаём.
        // Режим подхвата не снимаем — физика ещё не забрала позу.
        if (view.wind) {
          if (view.wind.down?.mode !== 'handoff') view.wind.down = null
          continue
        }
        if (view.present || view.glide) continue
        const axis = new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5,
        )
        view.wind = {
          pos: view.root.position.clone(),
          quat: view.root.quaternion.clone(),
          axis: axis.lengthSq() < 1e-6 ? axis.set(1, 0, 0) : axis.normalize(),
          ph: [Math.random() * 6.283, Math.random() * 6.283, Math.random() * 6.283],
          down: null,
        }
      }
      return
    }
    windOn = false
    if (restore === false) {
      // Подхват (бросок/реролл): кувырок продолжается до конца сливки с
      // телом (syncBody семет blend, update собирает кадры) — freeze-дыры и
      // «чужого» перехода нет: ось/скорость уходят в реальное ω тела. Если
      // бросок не случился — таймаут HANDOFF_TIMEOUT_MS снимает сам.
      for (const view of dice.values()) {
        if (view.wind && view.wind.down?.mode !== 'handoff')
          view.wind.down = { t: 0, mode: 'handoff' }
      }
      return
    }
    // Гашение без броска — плавный winddown вместо резкого стопа/телепорта.
    for (const [id, view] of dice.entries()) {
      if (!view.wind || view.wind.down?.mode === 'handoff') continue
      view.wind.down = { t: 0, mode: restore === 'spin' && id === keepId ? 'spin' : 'full' }
    }
  }

  const getPose: Table['getPose'] = (id) => {
    const view = dice.get(id)
    if (!view || disposed) return null
    return {
      pos: [view.root.position.x, view.root.position.y, view.root.position.z],
      quat: [
        view.root.quaternion.x,
        view.root.quaternion.y,
        view.root.quaternion.z,
        view.root.quaternion.w,
      ],
    }
  }

  const getViewDir = (): [number, number, number] => {
    const v = camera.position.clone().sub(controls.target)
    const l = v.length() || 1
    return [v.x / l, v.y / l, v.z / l]
  }

  const flickVec: Table['flickVec'] = (vxPx, vyPx) => {
    const v = Math.hypot(vxPx, vyPx)
    if (v < 1e-4) return { x: 0, z: 0 }
    camera.updateMatrixWorld()
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    const dir = new THREE.Vector3().addScaledVector(right, vxPx).addScaledVector(up, -vyPx)
    dir.y = 0
    const len = dir.length()
    if (len < 1e-6) return { x: 0, z: 0 }
    const speed = Math.min(8, (v / 1.5) * 8)
    return { x: (dir.x / len) * speed, z: (dir.z / len) * speed }
  }

  const resize = () => {
    if (disposed) return
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    frameCamera()
  }

  const update = () => {
    if (disposed) return
    const now = performance.now()
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000))
    lastT = now
    if (windOn) windT += dt
    for (const view of dice.values()) {
      // Зарядка: кувырок вокруг центра (пивот как в spinDie) с прецессией
      // оси + плавный подъём в «руку» (тряски позиции нет). Якорь — базовая
      // поза (без дрейфа): позиция тянется к lift, не копит ошибку.
      if (view.wind) {
        const w = view.wind
        if (w.down?.mode === 'handoff') {
          // Подхват (релиз в бросок): кувырок живёт до конца сливки (см.
          // blend ниже) — вращение продолжается в реальное ω тела, а не
          // подменяется. Таймаут — только пока сливки нет (физика не
          // запустилась — снимаем зарядку, а не крутим вечно).
          w.down.t += dt
          if (!view.blend && w.down.t * 1000 > HANDOFF_TIMEOUT_MS) {
            view.wind = null
          } else {
            windFrame(view, w, dt)
          }
        } else if (w.down) {
          // Winddown (без броска): кувырок плавно гаснет, посадка в базу —
          // без резкого стопа скорости и телепорта (фидбек «10 → резко 5»).
          w.down.t += dt
          const k = Math.min(1, (w.down.t * 1000) / WIND_DOWN_MS)
          const e = 1 - (1 - k) * (1 - k)
          tumble(view, w, windAuto() * (1 - e), dt)
          if (w.down.mode === 'full') {
            // Отмена: подтяжка кватерниона к базе ∝ прогрессу (при k=1 —
            // точная копия, остаток slerp незаметен <1°).
            view.root.quaternion.slerp(w.quat, Math.min(1, e * dt * 20))
          }
          // 'spin': крутка юзера (кватернион) остаётся — кость просто садится.
          const follow = Math.min(1, dt * 10)
          view.root.position.x += (w.pos.x - view.root.position.x) * follow
          view.root.position.y += (w.pos.y - view.root.position.y) * follow
          view.root.position.z += (w.pos.z - view.root.position.z) * follow
          if (k >= 1) {
            view.root.position.copy(w.pos)
            if (w.down.mode !== 'spin') view.root.quaternion.copy(w.quat)
            view.wind = null
          }
        } else {
          // Активная зарядка: только вращение + плавный подъём (тряски нет).
          windFrame(view, w, dt)
        }
        // Сливка подхвата (см. DieView.blend): позиция — smoothstep к
        // летящему телу (телепорт спавна сглажен), ориентация — от ЖИВОГО
        // кувырка (spinQ, его крутит tumble) к кватерниону тела: ось и
        // скорость вращения не обрываются — раскрутка продолжается в
        // физику (фидбек «все ожидают продолжение, а не странный переход»).
        const b = view.blend
        const spin = view.spinQ
        if (w.down?.mode === 'handoff' && b && spin) {
          const k = Math.min(1, (now - b.t0) / HANDOFF_MS)
          const p = k * k * (3 - 2 * k)
          const pe = 1 - (1 - k) * (1 - k)
          view.root.position.set(
            b.fromPos.x + (b.toPos[0] - b.fromPos.x) * p,
            b.fromPos.y + (b.toPos[1] - b.fromPos.y) * p,
            b.fromPos.z + (b.toPos[2] - b.fromPos.z) * p,
          )
          view.root.quaternion.slerpQuaternions(spin, b.toQuat, pe)
          if (k >= 1) {
            // Дальше позу ведёт чистая физика (обычные копии syncBody).
            view.wind = null
            view.blend = null
            view.spinQ = null
          }
        }
      }
      // Одно движение сразу на финал (full-slerp короткой дугой + лёгкий
      // подскок в середине, чтобы углы не скребли пол).
      if (view.present) {
        view.present.t += dt
        const k = Math.min(1, view.present.t / view.present.dur)
        const e = k * k * (3 - 2 * k)
        view.root.quaternion.slerpQuaternions(view.present.from, view.present.to, e)
        // Чуть приподнимаем в середине: углы не скребут пол.
        view.root.position.y =
          view.present.baseY + view.present.hopAmp * Math.sin(Math.PI * Math.min(1, k))
        if (k >= 1) {
          view.root.position.y = view.present.baseY
          const done = view.present.onDone
          view.present = null
          done?.()
        }
      }
      if (view.glide) {
        view.glide.t += dt
        const k = Math.min(1, view.glide.t / view.glide.dur)
        const e = k * k * (3 - 2 * k)
        view.root.position.x = view.glide.fromX + (view.glide.toX - view.glide.fromX) * e
        view.root.position.z = view.glide.fromZ + (view.glide.toZ - view.glide.fromZ) * e
        if (k >= 1) {
          const done = view.glide.onDone
          view.glide = null
          done?.()
        }
      }
    }
    if (camTween) {
      camTween.t += dt
      const k = Math.min(1, camTween.t / camTween.dur)
      const e = k * k * (3 - 2 * k)
      camera.position.lerpVectors(camTween.fromPos, home.pos, e)
      controls.target.lerpVectors(camTween.fromTarget, home.target, e)
      if (k >= 1) {
        const done = camTween.onDone
        camTween = null
        controls.enabled = true
        done?.()
      }
    }
    controls.update()
    renderer.render(scene, camera)
  }

  // Юзер схватил стол посреди возврата — доводку отменяем, руль возвращаем.
  const cancelTween = () => {
    if (camTween) {
      camTween = null
      controls.enabled = true
    }
  }
  canvas.addEventListener('pointerdown', cancelTween)

  const dispose = () => {
    disposed = true
    canvas.removeEventListener('pointerdown', cancelTween)
    for (const view of dice.values()) disposeDie(view)
    dice.clear()
    controls.dispose()
    renderer.dispose()
  }

  return {
    addDie,
    removeDie,
    hasDie: (id) => dice.has(id),
    syncBody,
    presentTo,
    glideTo,
    pickAny,
    pickDieId,
    findDiePoint,
    spinDie,
    windup,
    dimDie,
    getPose,
    getViewDir,
    flickVec,
    setFit,
    resetView,
    resize,
    update,
    dispose,
  }
}
