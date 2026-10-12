// Селекторы музыки: расчёт «unavail/loading/on» — одна точка правды для
// шапки, дроуэра и карточки музыки. Стейт (music) живёт в musicSlice.
// Структурная типизация вместо RootState — см. tableUi/selectors.ts.
import { createSelector } from '@reduxjs/toolkit'
import type { MusicUiState } from './musicSlice'

export const selectMusic = (s: { music: MusicUiState }): MusicUiState => s.music

/** Один расчёт стейта музыки для шапки/дровера/карточки. */
export const selectMusicEntry = createSelector([selectMusic], (m) => {
  const unavail = m.avail === 'unavailable'
  return {
    unavail,
    loading: !unavail && m.state === 'loading',
    on: !unavail && m.state === 'playing',
  }
})
