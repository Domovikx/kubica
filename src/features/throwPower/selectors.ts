// Селектор режима силы броска: стейт (power) живёт здесь же, в throwPowerSlice.
// Структурная типизация вместо RootState — см. tableUi/selectors.ts.
import type { PowerState } from './throwPowerSlice'

export const selectPower = (s: { power: PowerState }) => s.power.mode
