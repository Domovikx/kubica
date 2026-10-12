// Селектор звука/вибрации: стейт (sound) живёт здесь же, в soundSlice.
// Структурная типизация вместо RootState — см. tableUi/selectors.ts.
import type { SoundState } from './soundSlice'

export const selectSound = (s: { sound: SoundState }): SoundState => s.sound
