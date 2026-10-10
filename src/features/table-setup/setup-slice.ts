// RTK-слайс набора стола (сколько каких костей на поле).
// Логика капов и персист-ключи — 1:1 к прежнему table-setup.ts (e2e/чекеры
// читают kubica-table-v1 напрямую). Запись в storage — app/persist glue.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { DIE_IDS, type DieId } from '@/entities/dice-geometry/geometry'
import { emptyCounts, MAX_PER_DIE, MAX_TOTAL, totalCount, type TableCounts } from './table-setup'

export const SETUP_KEY = 'kubica-table-v1'
export { MAX_PER_DIE, MAX_TOTAL }

/** Ставит счётчик с капами (тот же кламп, что у прежнего setCount). */
const applySetCount = (counts: TableCounts, die: DieId, n: number): void => {
  const want = Math.max(0, Math.min(MAX_PER_DIE, Math.floor(n)))
  const without = totalCount(counts) - counts[die]
  counts[die] = Math.min(want, Math.max(0, MAX_TOTAL - without))
}

/** Загрузка из storage с клампом; битый стор — пустой набор (как раньше). */
export const loadSetupCounts = (storage?: Pick<Storage, 'getItem'> | null): TableCounts => {
  const counts = emptyCounts()
  try {
    const raw = storage?.getItem(SETUP_KEY)
    if (!raw) return counts
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>
    for (const die of DIE_IDS) {
      const v = parsed[die]
      if (typeof v === 'number' && Number.isFinite(v)) {
        applySetCount(counts, die, v)
      }
    }
  } catch {
    // Битый стор — начинаем с пустого
  }
  return counts
}

export interface SetupState {
  counts: TableCounts
}

const setupSlice = createSlice({
  name: 'setup',
  initialState: (): SetupState => ({ counts: emptyCounts() }),
  reducers: {
    /** Поставить счётчик (с капами; 0 — убрать кость). */
    setCount(state, action: PayloadAction<{ die: DieId; n: number }>) {
      applySetCount(state.counts, action.payload.die, action.payload.n)
    },
    add(state, action: PayloadAction<{ die: DieId; delta?: number }>) {
      const { die, delta = 1 } = action.payload
      applySetCount(state.counts, die, state.counts[die] + delta)
    },
    clear(state) {
      for (const die of DIE_IDS) state.counts[die] = 0
    },
    /** Массовая установка (пресет/реролл): те же капы, что у setCount. */
    setAll(state, action: PayloadAction<TableCounts>) {
      const next = emptyCounts()
      for (const die of DIE_IDS) applySetCount(next, die, action.payload[die] ?? 0)
      state.counts = next
    },
  },
})

export const setupActions = setupSlice.actions
export const setupReducer = setupSlice.reducer
