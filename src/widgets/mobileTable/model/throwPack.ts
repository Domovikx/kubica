// Бросок пачкой: раунды rollTable, синк финала (история/поп/презентация/.glide).
// Вынесено из engine.ts по образцу gestures.ts (волна 2 FSD-ревью): замыкания
// броска живут рядом со своим контекстом, engine собирает и владеет жизненным циклом.
import type { DieId, Table } from '@/shared'
import { formatLabel, formatParts } from '../lib/format'
import {
  quatForValueDown,
  diceOverlap,
  type DicePose,
  type StepCallback,
  resolveD4Below,
  screenUpWorld,
  buzz as vibrate,
  playThock,
  stopRattle,
  hideResult,
} from '@/shared'
import { labelTableResult, rollTable, type TableDieResult, mtUiActions } from '@/features'
import { historyActions } from '@/entities'
import type { AppDispatch } from '@/app'

export interface Instance {
  die: DieId
  key: string
}

/** Контекст броска — то, чем владеет engine и что нужно замыканиям. */
export interface ThrowPackCtx {
  table: Table
  dispatch: AppDispatch
  live: HTMLElement
  showToast: (msg: string) => void
  viewDirOf: () => ReturnType<Table['getViewDir']>
  getInstances: () => Instance[]
  getSlots: () => Array<{ x: number; z: number }>
  getPhysBounds: () => { hx: number; hz: number }
  isDisposed: () => boolean
  isRolling: () => boolean
  thrownKeys: Set<string>
}

const buzz = (die: DieId, value: number): void => {
  if (die === 'd20' && value === 20) vibrate([30, 50, 30])
  else if (die === 'd20' && value === 1) vibrate(80)
  else vibrate(15)
}

/**
 * Бросок пачкой. powerBoost = режим меню + заряд удержания + флик релиза
 * (кап 1.6); flick — направленный швырок XZ из флика пальцем.
 */
export const createThrowPack = (
  ctx: ThrowPackCtx,
): {
  throwAll: (powerBoost?: number, flick?: { x: number; z: number }) => void
} => {
  const { table, dispatch, live, showToast, viewDirOf, thrownKeys } = ctx

  const throwAll = (powerBoost = 0, flick?: { x: number; z: number }): void => {
    if (ctx.isRolling() || ctx.isDisposed()) return
    dispatch(mtUiActions.setWindActive(false))
    table.windup({ on: false, restore: false })
    const thrown = [...ctx.getInstances()]
    if (thrown.length === 0) return
    const thrownSlots = ctx.getSlots().map((s) => ({ ...s }))
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
      if (ctx.isDisposed()) return
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
        if (ctx.isDisposed()) return
        const glides = ordered.map(
          (r, i) =>
            new Promise<void>((done) => {
              window.setTimeout(() => {
                if (ctx.isDisposed()) {
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
      void rollTable(reqs, cbs, ctx.getPhysBounds())
        .then((results) => {
          if (ctx.isDisposed()) return
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
          if (ctx.isDisposed()) return
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

  return { throwAll }
}
