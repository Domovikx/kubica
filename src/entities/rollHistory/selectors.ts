// Селектор записей истории: стейт (history) живёт здесь же, в historySlice.
// Структурная типизация вместо RootState — см. tableUi/selectors.ts.
import type { HistoryState } from './historySlice'

export const selectEntries = (s: { history: HistoryState }) => s.history.entries
