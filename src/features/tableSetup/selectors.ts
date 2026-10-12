// Селекторы сетапа стола: стейт (setup) живёт здесь же, в setupSlice.
// Структурная типизация вместо RootState — см. tableUi/selectors.ts.
import type { SetupState } from './setupSlice'
import { totalCount } from './tableSetup'

export const selectCounts = (s: { setup: SetupState }) => s.setup.counts
export const selectTotal = (s: { setup: SetupState }) => totalCount(s.setup.counts)
