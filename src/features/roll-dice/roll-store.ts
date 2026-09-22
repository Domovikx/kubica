// Стор броска: idle → rolling → settled. Физика инжектится драйвером,
// поэтому стор тестируется без cannon-es и three.js.
import type { DieId } from '@/entities/dice-geometry/geometry'
import { displayValue, readRoll, type Quat } from './readout'

export type RollPhase = 'idle' | 'rolling' | 'settled'

export interface RollResult {
  die: DieId
  value: number
  display: string
  quat: Quat
  settled: boolean
  at: number
}

export interface PhysicsDriver {
  roll: (die: DieId) => Promise<{ quat: Quat; settled: boolean }>
}

export type RollListener = (state: RollState) => void

export interface RollState {
  phase: RollPhase
  result: RollResult | null
}

export const createRollStore = (driver: PhysicsDriver) => {
  let state: RollState = { phase: 'idle', result: null }
  const listeners = new Set<RollListener>()
  let token = 0

  const emit = () => {
    for (const listener of listeners) listener({ ...state })
  }

  return {
    subscribe(listener: RollListener): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getState(): RollState {
      return { ...state }
    },
    async roll(die: DieId): Promise<RollResult> {
      const my = ++token
      state = { phase: 'rolling', result: null }
      emit()
      const { quat, settled } = await driver.roll(die)
      // Протухший бросок (поверх пришёл новый) — игнорируем
      if (my !== token) {
        return state.result as RollResult
      }
      const value = readRoll(die, quat)
      const result: RollResult = {
        die,
        value,
        display: displayValue(die, value),
        quat,
        settled,
        at: Date.now(),
      }
      state = { phase: 'settled', result }
      emit()
      return result
    },
  }
}

export type RollStore = ReturnType<typeof createRollStore>
