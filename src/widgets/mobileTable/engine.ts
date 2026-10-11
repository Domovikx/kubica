// Движок стола для React-виджета (волна A2): three.js-таблица, синхронизация
// пачки костей, реролл, жизненный цикл. Логика 1-в-1 из прежнего
// mountMobileTable легаси-виджета (удалён в A3), но состояние читает из
// RTK-store (getState снаружи React) — единый источник правды для рендера.
// Бросок/жесты — отдельные модули (throwPack.ts, gestures.ts).
import { DIE_IDS, faceValue, physMaxDim } from '@/shared/dice/geometry'
import type { DieId } from '@/shared/dice/dieId.utils'
import type { HistoryEntry } from '@/entities/rollHistory/history'
import {
  quatForD4VertexUp,
  quatForValueDown,
  quatMul,
  quatYaw,
} from '@/shared/dice/faceOrient.utils'
import { tickTableWorld } from '@/features/tableRoll/tableRoll'
import { expandInstances, type TableCounts } from '@/features/tableSetup/tableSetup'
import { createTable, type Table } from '@/shared/three/table'
import { computeLayout } from './layout'
import { createGestures } from './gestures'
import { createThrowPack, type Instance } from './throwPack'
import { setupActions } from '@/features/tableSetup/setupSlice'
import { mtUiActions } from '@/features/tableUi/mtUiSlice'
import type { AppDispatch, RootState } from '@/app/store'
import { throwPowerBoost } from '@/features/rollDice/power'
import { startRattle, stopRattle } from '@/shared/dice/sound'

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

  const { throwAll } = createThrowPack({
    table,
    dispatch,
    live,
    showToast,
    viewDirOf,
    getInstances: () => instances,
    getSlots: () => slots,
    getPhysBounds: () => physBounds,
    isDisposed: () => disposed,
    isRolling,
    thrownKeys,
  })

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
