// Общий стеклянный стол: док с картами костей (счётчики N) + пресет-бар +
// большая кнопка броска (тап = бросок, холд = заряд с помешиванием).
// Тап по любой кости бросает всю пачку в одном физическом мире.
// После settle — презентация одним движением на финал + разъезд по слотам.
// Набор — стор table-setup (персист); инстансы `d6#0…` (дубли одного типа).
import { DIE_IDS, faceValue, physMaxDim, type DieId } from '@/entities/dice-geometry/geometry'
import {
  quatForD4VertexUp,
  quatForValueDown,
  quatMul,
  quatYaw,
} from '@/features/roll-dice/face-orient'
import type { StepCallback } from '@/features/roll-dice/physics'
import { resolveD4Below, screenUpWorld } from '@/features/roll-dice/readout'
import { isMuted, playThock, stopRattle } from '@/features/roll-dice/sound'
import {
  commitTableResult,
  labelTableResult,
  layoutSlots,
  rollTable,
  tickTableWorld,
  type TableDieResult,
} from '@/features/table-roll/table-roll'
import {
  expandInstances,
  getSetupStore,
  totalCount,
  type TableCounts,
} from '@/features/table-setup/table-setup'
import {
  BUILT_IN_PRESETS,
  deleteCustomPreset,
  formulaToCounts,
  loadCustomPresets,
  saveCustomPreset,
} from '@/features/table-setup/presets'
import { createTable, type Table } from '@/shared/three/table'
import { hideResult } from '@/shared/ui/result-pop'
import { glassHalves, TABLE_HALF_X, TABLE_HALF_Z } from '@/shared/arena/arena'
import './glass-table.css'

/** Тактильный отклик (как в сетке; глушится вместе со звуком). */
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

interface Instance {
  die: DieId
  key: string
}

export const mountGlassTable = (
  container: HTMLElement,
): {
  update: () => void
  resize: () => void
  dispose: () => void
} => {
  const setup = getSetupStore()
  container.innerHTML = ''
  const section = document.createElement('section')
  section.className = 'gtable'
  const canvas = document.createElement('canvas')
  canvas.className = 'gtableCanvas'
  const hint = document.createElement('p')
  hint.className = 'gtableHint'
  hint.textContent = 'Тапай по картам внизу — кости лягут на стол'
  hint.hidden = true
  // Верхняя панель — одна лента: чипы (встроенные + свои), формула,
  // сохранение сета. Второй ряд убран: при N≥7 верхние кости уходили под него
  // (а отдельный ряд своих чипов налезал на поп результата).
  const presets = document.createElement('div')
  presets.className = 'gtablePresets'
  const applyCounts = (counts: TableCounts) => {
    setup.clear()
    for (const die of DIE_IDS) {
      const n = counts[die] ?? 0
      if (n > 0) setup.setCount(die, n)
    }
  }
  const renderCustom = () => {
    presets.querySelectorAll('.gtableChip.custom').forEach((el) => el.remove())
    for (const p of loadCustomPresets()) {
      const chip = document.createElement('span')
      chip.className = 'gtableChip custom'
      const label = document.createElement('button')
      label.type = 'button'
      label.className = 'gtableChipLabel'
      label.textContent = p.name
      label.title = 'Поставить набор'
      label.addEventListener('click', () => applyCounts(p.counts))
      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'gtableChipX'
      del.textContent = '×'
      del.title = 'Удалить набор'
      del.setAttribute('aria-label', `Удалить ${p.name}`)
      del.addEventListener('click', () => {
        deleteCustomPreset(p.name)
        renderCustom()
      })
      chip.append(label, del)
      presets.appendChild(chip)
    }
  }
  for (const p of BUILT_IN_PRESETS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'gtableChip'
    btn.textContent = p.name
    btn.title = 'Поставить набор'
    btn.addEventListener('click', () => applyCounts(p.counts))
    presets.appendChild(btn)
  }
  const formula = document.createElement('input')
  formula.className = 'gtableFormula'
  formula.type = 'text'
  formula.placeholder = '4d6 / d20+d6'
  formula.setAttribute('aria-label', 'Формула набора')
  formula.title = 'Формула: 4d6, d20+d6, 8d6, d100=пара d10'
  formula.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    const counts = formulaToCounts(formula.value)
    if (counts) {
      applyCounts(counts)
      formula.value = ''
      formula.blur()
    } else {
      formula.classList.add('error')
      window.setTimeout(() => formula.classList.remove('error'), 600)
    }
  })
  const saveName = document.createElement('input')
  saveName.className = 'gtableSaveName'
  saveName.type = 'text'
  saveName.placeholder = 'Мой сет…'
  saveName.setAttribute('aria-label', 'Имя своего набора')
  saveName.maxLength = 24
  const saveBtn = document.createElement('button')
  saveBtn.type = 'button'
  saveBtn.className = 'gtableSaveBtn'
  saveBtn.textContent = '+ Сет'
  saveBtn.title = 'Сохранить текущий стол как свой набор'
  saveBtn.addEventListener('click', () => {
    const name = saveName.value.trim() || `Сет ${loadCustomPresets().length + 1}`
    saveCustomPreset(name, setup.get())
    saveName.value = ''
    renderCustom()
  })
  presets.append(formula, saveName, saveBtn)
  // Док: карты костей со счётчиками.
  const dock = document.createElement('div')
  dock.className = 'gtableDock'
  const cards = new Map<DieId, { root: HTMLElement; count: HTMLElement }>()
  for (const die of DIE_IDS) {
    const card = document.createElement('div')
    card.className = 'gtableCard'
    card.dataset.die = die
    const code = document.createElement('button')
    code.className = 'gtableCode'
    code.type = 'button'
    code.textContent = die.toUpperCase()
    code.title = `Добавить ${die}`
    code.addEventListener('click', () => {
      setup.add(die, 1)
    })
    const minus = document.createElement('button')
    minus.className = 'gtableMinus'
    minus.type = 'button'
    minus.textContent = '−'
    minus.title = `Убрать ${die}`
    minus.addEventListener('click', () => {
      setup.add(die, -1)
    })
    const count = document.createElement('span')
    count.className = 'gtableCount'
    count.textContent = '0'
    const plus = document.createElement('button')
    plus.className = 'gtablePlus'
    plus.type = 'button'
    plus.textContent = '+'
    plus.title = `Добавить ${die}`
    plus.addEventListener('click', () => {
      setup.add(die, 1)
    })
    card.append(code, minus, count, plus)
    dock.appendChild(card)
    cards.set(die, { root: card, count })
  }
  const throwBtn = document.createElement('button')
  throwBtn.className = 'gtableThrow'
  throwBtn.type = 'button'
  throwBtn.disabled = true
  section.append(canvas, hint, presets, dock, throwBtn)
  container.appendChild(section)
  renderCustom()

  const table: Table = createTable(canvas)
  const viewDirOf = () => table.getViewDir()
  let instances: Instance[] = []
  let slots: Array<{ x: number; z: number }> = []
  let loadedKeys = new Set<string>()
  let rolling = false
  let disposed = false
  // Заряд холда: 0..1 (тап = 0, секундный холд = 1).
  let charge = 0
  let charging = false

  const refreshChrome = (counts: TableCounts) => {
    const total = totalCount(counts)
    if (!charging) {
      if (total === 0) throwBtn.textContent = 'Нечего кидать'
      else if (loadedKeys.size < instances.length)
        throwBtn.textContent = `Гружу… ${loadedKeys.size}/${instances.length}`
      else throwBtn.textContent = `Кинуть • ${total}`
    }
    throwBtn.disabled = rolling || total === 0 || loadedKeys.size < instances.length
    hint.hidden = total > 0
    if (total === 0) hideResult()
    for (const die of DIE_IDS) {
      const card = cards.get(die)
      if (!card) continue
      card.count.textContent = String(counts[die] ?? 0)
      card.root.classList.toggle('onTable', (counts[die] ?? 0) > 0)
      for (const btn of card.root.querySelectorAll('button')) {
        btn.disabled = rolling
      }
    }
    saveBtn.disabled = rolling || total === 0
  }

  const addInstance = (inst: Instance, i: number) => {
    const model = [
      { id: 'd4', url: `${import.meta.env.BASE_URL}cad/set/d4.glb` },
      { id: 'd6', url: `${import.meta.env.BASE_URL}cad/set/d6.glb` },
      { id: 'd8', url: `${import.meta.env.BASE_URL}cad/set/d8.glb` },
      { id: 'd10', url: `${import.meta.env.BASE_URL}cad/set/d10.glb` },
      { id: 'd12', url: `${import.meta.env.BASE_URL}cad/set/d12.glb` },
      { id: 'd20', url: `${import.meta.env.BASE_URL}cad/set/d20.glb` },
    ].find((m) => m.id === inst.die)
    if (!model) return
    // Стартовые позы плашмя различаем yaw (иначе близнецы стоят одинаково).
    const base =
      inst.die === 'd4'
        ? quatForD4VertexUp(1, viewDirOf())
        : quatForValueDown(inst.die, faceValue(inst.die, 0), viewDirOf())
    const spread = quatYaw((i * 2 * Math.PI) / Math.max(1, instances.length))
    const initialQuat = quatMul(spread, base)
    table.addDie(
      inst.key,
      model.url,
      { physSize: physMaxDim(inst.die), slot: [slots[i].x, slots[i].z], initialQuat },
      () => {
        loadedKeys.add(inst.key)
        refreshChrome(setup.get())
      },
      () => {
        hint.textContent = `Не загрузилась: ${inst.die}`
        hint.hidden = false
      },
    )
  }

  /** Перестроить стол под набор (меши пересоздаются в своих слотах). */
  const syncInstances = (counts: TableCounts) => {
    if (disposed) return
    const next = expandInstances(counts)
    if (next.length === instances.length && next.every((v, i) => v.key === instances[i].key)) {
      refreshChrome(counts)
      return
    }
    for (const inst of instances) table.removeDie(inst.key)
    instances = next
    // Шаг слотов — по самой крупной кости пачки, иначе соседи наползают.
    // Слоты выше экранного центра (+Z = верх экрана снизу): док, пресеты
    // и кнопка перекрывают низ канваса, кости обязаны жить в видимой полосе.
    const biggest = instances.reduce((m, v) => Math.max(m, physMaxDim(v.die)), 0)
    const gap = Math.max(22, biggest * 1.35)
    slots = layoutSlots(instances.length, gap).map((s) => ({ x: s.x, z: s.z + 12 }))
    // Кадр — под размер пачки; физика щедрая и фиксированная.
    const maxX = slots.reduce((m, s) => Math.max(m, Math.abs(s.x)), 0)
    const maxZ = slots.reduce((m, s) => Math.max(m, Math.abs(s.z)), 0)
    const fit = glassHalves(maxX, maxZ)
    table.setFit(fit.hx, fit.hz)
    loadedKeys = new Set()
    instances.forEach((inst, i) => addInstance(inst, i))
    refreshChrome(counts)
  }

  const unsubscribe = setup.subscribe((counts) => syncInstances(counts))
  syncInstances(setup.get())

  const throwAll = (powerBoost = 0, flick: { x: number; z: number } = { x: 0, z: 0 }): void => {
    if (rolling || disposed) return
    // Снапшот пачки на бросок: набор может смениться прямо в полёте —
    // презентация и слоты идут по нему, а не по живому списку.
    const thrown = [...instances]
    if (thrown.length === 0) return
    const thrownSlots = slots.map((s) => ({ ...s }))
    const slotOf = (key: string): { x: number; z: number } =>
      thrownSlots[thrown.findIndex((v) => v.key === key)] ?? { x: 0, z: 0 }
    rolling = true
    charging = false
    charge = 0
    section.classList.remove('charging')
    refreshChrome(setup.get())
    stopRattle()
    // Энергия пачки: швырок ниже при большем N, гашение выше. Честность та же.
    // Заряд холда добавляет силу (только начальные условия).
    const baseUp = thrown.length <= 2 ? 28 : thrown.length <= 4 ? 24 : 21
    const launchUp = baseUp + powerBoost * 10
    const screenUp = screenUpWorld(viewDirOf())
    let lastHit = 0
    const byKey = new Map(thrown.map((v) => [v.key, v.die]))
    const cbs = {
      screenUp,
      onStep: (key: string, _die: DieId, step: Parameters<StepCallback>[0]) => {
        void _die
        table.syncBody(key, step.pos, step.quat)
      },
      onCollide: (die: DieId, i: number) => {
        lastHit = performance.now()
        playThock(die, i)
      },
    }
    // Итоги по ключам собираются по раундам: докидываем ТОЛЬКО незасевших.
    const final = new Map<string, TableDieResult>()
    const runRound = (keys: string[], round: number): void => {
      // Первый раунд — с текущих поз (бесшовно); доброс — из слотов.
      // Спираль: разлёт веером от центра + флик пальца, иначе горсть кучкуется.
      const n = keys.length
      const reqs = keys.flatMap((key, idx) => {
        const die = byKey.get(key)
        const pose = die ? table.getPose(key) : null
        if (!die || !pose) return []
        const s = slotOf(key)
        const spawnPos: [number, number, number] = round === 0 ? pose.pos : [s.x, pose.pos[1], s.z]
        const ang = (idx / Math.max(1, n)) * Math.PI * 2 + round * 0.7
        const spread = 4 + (idx % 3)
        return [
          {
            key,
            die,
            spawnPos,
            spawnQuat: pose.quat,
            power: 0.7 + powerBoost * 0.6 + (idx % 3) * 0.08,
            launchUp,
            damping: 0.3,
            sleepLimit: 1.0,
            fling: {
              x: Math.cos(ang) * spread + flick.x,
              z: Math.sin(ang) * spread + flick.z,
            },
          } as const,
        ]
      })
      if (reqs.length === 0) {
        finishPack()
        return
      }
      if (round > 0) {
        throwBtn.textContent = `Докатываю… (${round})`
      }
      void rollTable(reqs, cbs, { hx: TABLE_HALF_X, hz: TABLE_HALF_Z })
        .then((results) => {
          if (disposed) return
          for (const r of results) final.set(r.key, r)
          const bad = results.filter((r) => !r.settled).map((r) => r.key)
          if (bad.length > 0 && round < 2) {
            console.log(
              `[table] retry round ${round + 1}: ${bad.map((k) => `${byKey.get(k)}@${results.find((r) => r.key === k)?.steps}`).join('+')}`,
            )
            runRound(bad, round + 1)
            return
          }
          finishPack()
        })
        .catch(() => {
          if (!disposed) finishPack()
        })
    }
    const finishPack = (): void => {
      if (disposed) return
      stopRattle()
      const ordered = thrown.flatMap((v) => {
        const r = final.get(v.key)
        return r ? [r] : []
      })
      if (ordered.length === 0) {
        rolling = false
        refreshChrome(setup.get())
        return
      }
      if (performance.now() - lastHit > 150) {
        playThock(ordered[0].die)
      }
      const labelled = labelTableResult(ordered)
      commitTableResult(ordered, labelled)
      for (const r of ordered) buzz(r.die, r.value)
      const presents = ordered.map(
        (r) =>
          new Promise<void>((done) => {
            const target =
              r.die === 'd4'
                ? resolveD4Below(r.quat, screenUp).target
                : quatForValueDown(r.die, r.value, viewDirOf())
            table.presentTo(r.key, target, () => done(), 650)
          }),
      )
      void Promise.all(presents).then(() => {
        if (disposed) return
        const glides = ordered.map(
          (r) =>
            new Promise<void>((done) => {
              const s = slotOf(r.key)
              table.glideTo(r.key, s.x, s.z, () => done())
            }),
        )
        void Promise.all(glides).then(() => {
          rolling = false
          refreshChrome(setup.get())
        })
      })
    }
    runRound(
      thrown.map((v) => v.key),
      0,
    )
  }

  // Холд-заряд: зажал кнопку — кости дрожат и заряжаются, отпустил — швырок
  // силой заряда + флик. Тап <250мс — обычный бросок. Честность та же:
  // сила трогает только начальные условия.
  let downT = 0
  let chargeTimer = 0
  let stirTimer = 0
  let lastX = 0
  let lastY = 0
  let lastMoveT = 0
  let flick = { x: 0, z: 0 }
  let holdFired = false
  const stopCharge = () => {
    window.clearTimeout(chargeTimer)
    window.clearInterval(stirTimer)
    chargeTimer = 0
    stirTimer = 0
  }
  throwBtn.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || rolling || throwBtn.disabled) return
    downT = performance.now()
    lastX = e.clientX
    lastY = e.clientY
    lastMoveT = downT
    flick = { x: 0, z: 0 }
    holdFired = false
    charge = 0
    stopCharge()
    chargeTimer = window.setTimeout(() => {
      if (disposed || rolling) return
      charging = true
      section.classList.add('charging')
      const t0 = performance.now()
      stirTimer = window.setInterval(() => {
        if (disposed) return
        charge = Math.min(1, (performance.now() - t0) / 900)
        throwBtn.textContent = `Держи… ${(1 + charge * 0.6).toFixed(1)}×`
        // Помешивание: дрожь слотов ∝ заряду (поза броска всё равно случайна).
        const t = performance.now() / 130
        thrownJitter(t, charge)
      }, 50)
    }, 250)
  })
  throwBtn.addEventListener('pointermove', (e) => {
    if (!e.isPrimary || !charging) return
    const now = performance.now()
    const dt = Math.max(16, now - lastMoveT)
    // Скорость жеста → флик (зажим в разумных пределах).
    const vx = ((e.clientX - lastX) / dt) * 16
    const vy = ((e.clientY - lastY) / dt) * 16
    flick = {
      x: Math.max(-8, Math.min(8, flick.x * 0.9 + vx * 0.35)),
      z: Math.max(-8, Math.min(8, flick.z * 0.9 + vy * 0.35)),
    }
    lastX = e.clientX
    lastY = e.clientY
    lastMoveT = now
  })
  const thrownJitter = (t: number, amount: number) => {
    instances.forEach((inst, i) => {
      const pose = table.getPose(inst.key)
      const s = slots[i]
      if (!pose || !s) return
      const jx = Math.sin(t + i * 1.7) * 1.6 * amount
      const jz = Math.cos(t * 1.3 + i * 2.1) * 1.6 * amount
      table.syncBody(inst.key, [s.x + jx, pose.pos[1], s.z + jz], pose.quat)
    })
  }
  const endHold = (e: PointerEvent) => {
    if (!e.isPrimary) return
    const wasCharging = charging
    const held = performance.now() - downT
    stopCharge()
    if (downT === 0) return
    downT = 0
    if (rolling || throwBtn.disabled) {
      charging = false
      section.classList.remove('charging')
      return
    }
    if (wasCharging) {
      holdFired = true
      // Возвращаем кости в слоты перед броском (дрожь — только превью).
      instances.forEach((inst, i) => {
        const pose = table.getPose(inst.key)
        const s = slots[i]
        if (pose && s) table.syncBody(inst.key, [s.x, pose.pos[1], s.z], pose.quat)
      })
      throwAll(charge, flick)
    } else if (held < 500) {
      // Обычный тап — через click ниже; здесь ничего (ждём click).
    }
    charging = false
    section.classList.remove('charging')
  }
  throwBtn.addEventListener('pointerup', endHold)
  throwBtn.addEventListener('pointercancel', () => {
    stopCharge()
    charging = false
    charge = 0
    downT = 0
    section.classList.remove('charging')
    refreshChrome(setup.get())
  })
  throwBtn.addEventListener('click', () => {
    if (holdFired) {
      holdFired = false
      return
    }
    if (!charging) throwAll()
  })
  // Тап по кости всё ещё бросает всех (быстрый цикл без кнопки).
  canvas.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || rolling) return
    // Тап по любой кости бросает всех; тап по пустому стеклу — ничего.
    const x = e.clientX
    const y = e.clientY
    const t = performance.now()
    const onUp = (up: PointerEvent) => {
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      if (!up.isPrimary) return
      const moved = Math.hypot(up.clientX - x, up.clientY - y)
      if (moved < 8 && performance.now() - t < 500 && table.pickAny(x, y)) {
        throwAll()
      }
    }
    const onCancel = () => {
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
    }
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)
  })

  requestAnimationFrame(() => {
    table.resize()
  })

  return {
    update() {
      tickTableWorld()
      table.update()
    },
    resize() {
      table.resize()
    },
    dispose() {
      disposed = true
      stopCharge()
      unsubscribe()
      table.dispose()
      container.innerHTML = ''
    },
  }
}
