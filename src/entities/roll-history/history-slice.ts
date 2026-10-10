// RTK-слайс истории бросков (персист dice-rolls-v1, лимит 50, валидация
// при чтении) — замена удалённого в A3 ванильного стора history.ts. Чистые
// форматтеры (formatParts/formatLabel) остаются в history.ts.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { HistoryEntry, RollInput } from './history'

export const HISTORY_KEY = 'dice-rolls-v1'
export const MAX_ENTRIES = 50

const load = (storage?: Pick<Storage, 'getItem'> | null): HistoryEntry[] => {
  try {
    const raw = storage?.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is HistoryEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as HistoryEntry).die === 'string' &&
        typeof (e as HistoryEntry).value === 'number' &&
        typeof (e as HistoryEntry).at === 'number',
    )
  } catch {
    return []
  }
}

export const loadHistoryEntries = (storage?: Pick<Storage, 'getItem'> | null): HistoryEntry[] =>
  load(storage)

export interface HistoryState {
  entries: HistoryEntry[]
}

const toEntry = (result: RollInput): HistoryEntry => {
  const entry: HistoryEntry = {
    die: result.die,
    value: result.value,
    display: result.display,
    at: result.at,
  }
  if (result.label !== undefined) entry.label = result.label
  if (result.parts !== undefined) entry.parts = result.parts.map((p) => ({ ...p }))
  return entry
}

const historySlice = createSlice({
  name: 'history',
  initialState: (): HistoryState => ({ entries: [] }),
  reducers: {
    add(state, action: PayloadAction<RollInput>) {
      state.entries = [toEntry(action.payload), ...state.entries].slice(0, MAX_ENTRIES)
    },
    clear(state) {
      state.entries = []
    },
  },
})

export const historyActions = historySlice.actions
export const historyReducer = historySlice.reducer
