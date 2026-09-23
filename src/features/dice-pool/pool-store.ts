// Стор пула: формула + фазы idle/rolling/settled + токен гонки (как roll-store).
// Степперы правят первый plain-терм своей грани, иначе дописывают +NdN.
import {
  normalize,
  parseNotation,
  type DiceSides,
  type RollExpr,
} from '@/entities/dice-notation/notation'
import type { PoolResult } from './pool'

export type PoolPhase = 'idle' | 'rolling' | 'settled'
export type StepperSides = Exclude<DiceSides, 100>

export interface PoolState {
  formula: string
  expr: RollExpr | null
  error: string | null
  phase: PoolPhase
  result: PoolResult | null
}

export type PoolListener = (state: PoolState) => void
export type PoolRoller = (expr: RollExpr) => Promise<PoolResult>

export const createPoolStore = (roller: PoolRoller) => {
  let state: PoolState = { formula: '', expr: null, error: null, phase: 'idle', result: null }
  const listeners = new Set<PoolListener>()
  let token = 0

  const emit = () => {
    for (const listener of listeners) listener({ ...state })
  }

  const applyFormula = (formula: string): void => {
    try {
      const expr = parseNotation(formula)
      state = { ...state, formula, expr, error: null, result: null }
    } catch (e) {
      state = {
        ...state,
        formula,
        expr: null,
        error: e instanceof Error ? e.message : String(e),
        result: null,
      }
    }
  }

  applyFormula('d20')
  state = { ...state, phase: 'idle' }

  return {
    subscribe(listener: PoolListener): () => void {
      listeners.add(listener)
      listener({ ...state })
      return () => {
        listeners.delete(listener)
      }
    },
    getState(): PoolState {
      return { ...state }
    },
    setFormula(formula: string): void {
      applyFormula(formula)
      state = { ...state, phase: 'idle' }
      emit()
    },
    applyPreset(formula: string): void {
      applyFormula(formula)
      state = { ...state, phase: 'idle' }
      emit()
    },
    adjustDie(sides: StepperSides, delta: number): void {
      const base: RollExpr = state.expr ?? { terms: [] }
      const terms = base.terms.map((t) => ({ sign: t.sign, term: { ...t.term } }))
      const idx = terms.findIndex(
        (t) => t.term.kind === 'dice' && t.term.sides === sides && t.term.op === null,
      )
      if (idx >= 0) {
        const cand = terms[idx]
        if (cand.term.kind === 'dice') {
          const next = Math.min(100, Math.max(0, cand.term.count + delta))
          if (next <= 0) terms.splice(idx, 1)
          else cand.term.count = next
        }
      } else if (delta > 0) {
        terms.push({
          sign: 1,
          term: { kind: 'dice', count: Math.min(100, delta), sides, op: null, opN: 0 },
        })
      }
      if (terms.length === 0) {
        state = {
          ...state,
          formula: '',
          expr: null,
          error: 'пустой пул',
          result: null,
          phase: 'idle',
        }
        emit()
        return
      }
      applyFormula(normalize({ terms }))
      state = { ...state, phase: 'idle' }
      emit()
    },
    async roll(): Promise<PoolResult> {
      if (!state.expr || state.error) throw new Error(state.error ?? 'пустой пул')
      const my = ++token
      const expr = state.expr
      state = { ...state, phase: 'rolling', result: null }
      emit()
      const result = await roller(expr)
      // Протухший бросок (поверх пришёл новый) — игнорируем
      if (my !== token) {
        return state.result as PoolResult
      }
      state = { ...state, phase: 'settled', result }
      emit()
      return result
    },
  }
}

export type PoolStore = ReturnType<typeof createPoolStore>
