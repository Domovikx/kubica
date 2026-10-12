// Селектор масштаба UI: стейт (uiScale) живёт здесь же, в uiScaleSlice.
// Структурная типизация вместо RootState — см. tableUi/selectors.ts.
import type { UiScaleState } from './uiScaleSlice'

export const selectUiScale = (s: { uiScale: UiScaleState }) => s.uiScale.scale
