// Движок стола для React-виджета (волна A2): three.js-таблица, физика броска,
// зарядка/жесты, синхронизация пачки костей. Логика 1-в-1 из прежнего
// mountMobileTable легаси-виджета (удалён в A3), но состояние читает из
// RTK-store (getState снаружи React) — единый источник правды для рендера.
import { DIE_IDS, faceValue, physMaxDim, type DieId } from '@/entities/dice-geometry/geometry'
import { formatLabel, formatParts, type HistoryEntry } from '@/entities/roll-history/history'
import { quatForD4VertexUp, quatForValueDown, quatMul, quatYaw } from '@/shared/dice/face-orient'
import { diceOverlap, type DicePose, type StepCallback } from '@/shared/dice/physics'
import { resolveD4Below, screenUpWorld } from '@/shared/dice/readout'
import { buzz as vibrate, playThock, startRattle, stopRattle } from '@/shared/dice/sound'
import { throwPowerBoost } from '@/features/roll-dice/power'
import {
  labelTableResult,
  rollTable,
  tickTableWorld,
  type TableDieResult,
} from '@/features/table-roll/table-roll'
import { expandInstances, type TableCounts } from '@/features/table-setup/table-setup'
import { createTable, type Table } from '@/shared/three/table'
import { computeLayout } from './layout'
import { createGestures } from './gestures'
import { setupActions } from '@/features/table-setup/setup-slice'
import { historyActions } from '@/entities/roll-history/history-slice'
import { mtUiActions } from './mt-ui-slice'
import type { AppDispatch, RootState } from '@/app/store'
import { hideResult } from '@/shared/ui/result-pop'

const buzz = (die: DieId, value: number): void => {
  if (die === 'd20' && value === 20) vibrate([30, 50, 30])
  else if (die === 'd20' && value === 1) vibrate(80)
  else vibrate(15)
}

interface Instance {
  die: DieId
  key: string
}

/** DEV-хук для тестов/чекеров: точка кости на экране. */
type WindowWithMTable = Window & {
  __mtable?: { diePoint: () => { x: number; y: number } | null }
}

export interface EngineDeps {
  dispatch: AppDispatch
  getState: () => RootState
  canvas: HTMLCanvasElement
  section: HTMLElement
  foot: HTMLElement
  footParts: HTMLElement
  live: HTMLElement
  head: HTMLElement
  showToast: (msg: string) => void
}

export interface Engine {
  update: () => void
  resize: () => void
  reroll: (entry: HistoryEntry) => void
  /** Синк пачки костей при смене setup.counts (эффект React). */
  syncCounts: (counts: TableCounts) => void
  dispose: () => void
}

export const createEngine = (deps: EngineDeps): Engine => {
  const { dispatch, getState, canvas, section, foot, footParts, live, head, showToast } = deps
  const table: Table = createTable(canvas)
  const viewDirOf = () => table.getViewDir()
  let instances: Instance[] = []
  let slots: Array<{ x: number; z: number }> = []
  let physBounds = { hx: 30, hz: 20 }
  let loadedKeys = new Set<string>()
  let disposed = false
  const thrownKeys = new Set<string>()

  const isRolling = () => getState().mtUi.rolling
  const isWindActive = () => getState().mtUi.windActive

  const addInstance = (inst: Instance, i: number) => {
    const model = DIE_IDS.map((id) => ({
      id,
      url: `${import.meta.env.BASE_URL}cad/set/${id}.glb`,
    })).find((m) => m.id === inst.die)
    if (!model) return
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
        if (!thrownKeys.has(inst.key)) table.dimDie(inst.key, true)
        dispatch(
          mtUiActions.setLoadProgress({ loaded: loadedKeys.size, instances: instances.length }),
        )
      },
      () => {
        dispatch(mtUiActions.setLoadError(inst.die))
        dispatch(
          mtUiActions.setLoadProgress({ loaded: loadedKeys.size, instances: instances.length }),
        )
      },
    )
  }

  const applyLayout = (): void => {
    const cw = Math.max(1, canvas.clientWidth)
    const ch = Math.max(1, canvas.clientHeight)
    const cRect = canvas.getBoundingClientRect()
    const top = Math.max(0, head.getBoundingClientRect().bottom - cRect.top)
    // Футер лежит поверх поля: высоту резервируем всегда; hidden → меряем с
    // заглушкой (пустой спан даёт 0); роста нет — одна строка, nowrap.
    const wasHidden = foot.hidden
    const parts = footParts.textContent
    foot.hidden = false
    if (!parts) footParts.textContent = 'd20 1'
    const bottom = Math.max(0, cRect.bottom - foot.getBoundingClientRect().top)
    footParts.textContent = parts
    foot.hidden = wasHidden
    const plan = computeLayout({
      canvasW: cw,
      canvasH: ch,
      top,
      bottom,
      count: instances.length,
      biggest: instances.reduce((m, v) => Math.max(m, physMaxDim(v.die)), 0),
    })
    slots = plan.slots
    table.setFit(plan.fitW, plan.fitH)
    physBounds = plan.physBounds
  }

  const relayout = (): void => {
    applyLayout()
    if (isRolling() || disposed) return
    instances.forEach((inst, i) => {
      const s = slots[i]
      const pose = table.getPose(inst.key)
      if (s && pose) table.syncBody(inst.key, [s.x, pose.pos[1], s.z], pose.quat)
    })
  }

  const syncInstances = (counts: TableCounts) => {
    if (disposed) return
    const next = expandInstances(counts)
    if (next.length === instances.length && next.every((v, i) => v.key === instances[i].key)) {
      dispatch(mtUiActions.setLastResult(null))
      return
    }
    for (const inst of instances) table.removeDie(inst.key)
    instances = next
    dispatch(mtUiActions.setLoadError(''))
    applyLayout()
    loadedKeys = new Set()
    dispatch(mtUiActions.setLoadProgress({ loaded: 0, instances: instances.length }))
    instances.forEach((inst, i) => addInstance(inst, i))
    dispatch(mtUiActions.setLastResult(null))
  }

  /**
   * Бросок пачкой. powerBoost = режим меню + заряд удержания + флик релиза
   * (кап 1.6); flick — направленный швырок XZ из флика пальцем.
   */
  const throwAll = (powerBoost = 0, flick?: { x: number; z: number }): void => {
    if (isRolling() || disposed) return
    dispatch(mtUiActions.setWindActive(false))
    table.windup({ on: false, restore: false })
    const thrown = [...instances]
    if (thrown.length === 0) return
    const thrownSlots = slots.map((s) => ({ ...s }))
    const slotOf = (key: string): { x: number; z: number } =>
      thrownSlots[thrown.findIndex((v) => v.key === key)] ?? { x: 0, z: 0 }
    dispatch(mtUiActions.setRolling(true))
    dispatch(mtUiActions.setLastResult(null))
    stopRattle()
    const baseUp = thrown.length <= 2 ? 28 : thrown.length <= 4 ? 24 : 21
    const launchUp = baseUp + powerBoost * 10
    const screenUp = screenUpWorld(viewDirOf())
    let lastHit = 0
    const byKey = new Map(thrown.map((v) => [v.key, v.die]))
    const cbs = {
      screenUp,
      onStep: (key: string, _die: DieId, step: Parameters<StepCallback>[0]) => {
        void _die
        table.syncBody(key, step.pos, step.quat, step.omega)
      },
      onCollide: (die: DieId, i: number) => {
        lastHit = performance.now()
        playThock(die, i)
      },
    }
    const final = new Map<string, TableDieResult>()
    const finishPack = (): void => {
      if (disposed) return
      stopRattle()
      const ordered = thrown.flatMap((v) => {
        const r = final.get(v.key)
        return r ? [r] : []
      })
      if (ordered.length === 0) {
        dispatch(mtUiActions.setRolling(false))
        return
      }
      if (performance.now() - lastHit > 150) playThock(ordered[0].die)
      const labelled = labelTableResult(ordered)
      dispatch(
        historyActions.add({
          die: ordered[0].die,
          value: labelled.total,
          display: String(labelled.total),
          at: Date.now(),
          label: labelled.label,
          parts: labelled.parts,
        }),
      )
      hideResult()
      live.textContent = `${formatLabel(labelled.label)}: ${labelled.total} · ${formatParts(labelled.parts).join(' ')}`
      for (const r of ordered) {
        thrownKeys.add(r.key)
        table.dimDie(r.key, false)
      }
      dispatch(
        mtUiActions.setLastResult({
          label: labelled.label,
          total: labelled.total,
          parts: labelled.parts,
        }),
      )
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
          (r, i) =>
            new Promise<void>((done) => {
              window.setTimeout(() => {
                if (disposed) {
                  done()
                  return
                }
                const s = slotOf(r.key)
                table.glideTo(r.key, s.x, s.z, () => done())
              }, i * 120)
            }),
        )
        void Promise.all(glides).then(() => {
          dispatch(mtUiActions.setRolling(false))
          const poses = new Map<string, DicePose>()
          for (const r of ordered) {
            const pose = table.getPose(r.key)
            if (pose) poses.set(r.key, { die: r.die, pos: pose.pos, quat: pose.quat })
          }
          const keys = [...poses.keys()]
          for (let a = 0; a < keys.length; a++) {
            for (let b = a + 1; b < keys.length; b++) {
              const pa = poses.get(keys[a])
              const pb = poses.get(keys[b])
              if (pa && pb && diceOverlap(pa, pb)) {
                console.warn(`[table] overlap after settle: ${keys[a]} × ${keys[b]}`)
              }
            }
          }
          table.resetView()
        })
      })
    }
    const runRound = (keys: string[], round: number): void => {
      const n = keys.length
      const reqs = keys.flatMap((key, idx) => {
        const die = byKey.get(key)
        const pose = die ? table.getPose(key) : null
        if (!die || !pose) return []
        const s = slotOf(key)
        const spawnPos: [number, number, number] = round === 0 ? pose.pos : [s.x, pose.pos[1], s.z]
        const ang = (idx / Math.max(1, n)) * Math.PI * 2 + round * 0.7
        const spread = 4 + (idx % 3)
        const power = 0.7 + powerBoost * 0.6 + (idx % 3) * 0.08
        return [
          {
            key,
            die,
            spawnPos,
            power,
            minAngular: 6 * power,
            launchUp,
            damping: 0.3,
            sleepLimit: 1.0,
            fling: {
              x: Math.cos(ang) * spread + (flick?.x ?? 0),
              z: Math.sin(ang) * spread + (flick?.z ?? 0),
            },
          } as const,
        ]
      })
      if (reqs.length === 0) {
        finishPack()
        return
      }
      void rollTable(reqs, cbs, physBounds)
        .then((results) => {
          if (disposed) return
          for (const r of results) final.set(r.key, r)
          const bad = results.filter((r) => !r.settled).map((r) => r.key)
          if (bad.length > 0 && round < 2) {
            console.log(`[table] retry round ${round + 1}`)
            runRound(bad, round + 1)
            return
          }
          finishPack()
        })
        .catch((err: unknown) => {
          console.error('[table] Бросок пачкой упал', err)
          if (disposed) return
          const nothing = final.size === 0
          finishPack()
          if (nothing) {
            showToast('Бросок сорвался — кинь ещё раз')
            live.textContent = 'Бросок не удался'
          }
        })
    }
    runRound(
      thrown.map((v) => v.key),
      0,
    )
  }

  /** Реролл: счётчики из частей записи → на стол → короткий взмах → бросок. */
  const reroll = (entry: HistoryEntry): void => {
    if (disposed) return
    const counts = getState().setup.counts
    const next: TableCounts = { ...counts }
    for (const die of DIE_IDS) next[die] = 0
    let any = false
    for (const p of entry.parts ?? []) {
      if ((DIE_IDS as readonly string[]).includes(p.die)) {
        next[p.die as DieId]++
        any = true
      }
    }
    if (!any) return
    dispatch(mtUiActions.closeOverlays())
    dispatch(setupActions.setAll(next))
    dispatch(mtUiActions.setWindActive(true))
    section.dataset.phase = 'charging'
    table.windup({ on: true })
    startRattle()
    window.setTimeout(() => {
      if (disposed) return
      dispatch(mtUiActions.setWindActive(false))
      table.windup({ on: false, restore: false })
      throwAll(throwPowerBoost())
    }, 350)
  }

  const gestures = createGestures({
    canvas,
    section,
    table,
    isRolling,
    isDisposed: () => disposed,
    wind: {
      isCharging: isWindActive,
      setCharging: (on: boolean) => {
        dispatch(mtUiActions.setWindActive(on))
      },
    },
    throwAll,
    refresh: () => {},
  })

  // Синхронизация от текущего стора + первый relayout после готовности канвы.
  syncInstances(getState().setup.counts)
  requestAnimationFrame(() => {
    if (disposed) return
    table.resize()
    relayout()
  })

  if (import.meta.env.DEV) {
    ;(window as WindowWithMTable).__mtable = { diePoint: () => table.findDiePoint() }
  }

  return {
    update() {
      tickTableWorld()
      table.update()
    },
    resize() {
      table.resize()
      relayout()
    },
    reroll,
    syncCounts: syncInstances,
    dispose() {
      disposed = true
      gestures.cancelPending()
      stopRattle()
      table.dispose()
      if (typeof window !== 'undefined') delete (window as WindowWithMTable).__mtable
    },
  }
}
