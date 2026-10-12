// Селекторы UI-состояния стола: стейт (mtUi) живёт здесь же, в mtUiSlice.
// Типизация структурная, не RootState: features не импортируют app/store —
// иначе цикл store → features → store (разнесение слоёв 2026-10-12).
import type { MtUiState } from './mtUiSlice'

export const selectMtUi = (s: { mtUi: MtUiState }): MtUiState => s.mtUi
export const selectRolling = (s: { mtUi: MtUiState }) => s.mtUi.rolling
export const selectLastResult = (s: { mtUi: MtUiState }) => s.mtUi.lastResult
