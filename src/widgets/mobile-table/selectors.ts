// Селекторы виджета стола: фаза (data-phase — контракт чекеров/e2e),
// производные значения шапки/шторки. Логика 1-в-1 из прежнего chrome.ts.
import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from '@/app/store'
import { totalCount } from '@/features/table-setup/table-setup'

export type TablePhase = 'empty' | 'rolling' | 'charging' | 'loading' | 'ready'

export const selectCounts = (s: RootState) => s.setup.counts
export const selectTotal = (s: RootState) => totalCount(s.setup.counts)
export const selectEntries = (s: RootState) => s.history.entries
export const selectMtUi = (s: RootState) => s.mtUi
export const selectRolling = (s: RootState) => s.mtUi.rolling
export const selectLastResult = (s: RootState) => s.mtUi.lastResult
export const selectSound = (s: RootState) => s.sound
export const selectMusic = (s: RootState) => s.music
export const selectUiScale = (s: RootState) => s.uiScale.scale
export const selectPower = (s: RootState) => s.power.mode

/** Фаза стола: пусто → летит → зарядка → грузится → готов. */
export const selectPhase = createSelector([selectTotal, selectMtUi], (total, ui): TablePhase =>
  total === 0
    ? 'empty'
    : ui.rolling
      ? 'rolling'
      : ui.windActive
        ? 'charging'
        : ui.loaded < ui.instances
          ? 'loading'
          : 'ready',
)

/** Один расчёт стейта музыки для шапки/дровера/карточки. */
export const selectMusicEntry = createSelector([selectMusic], (m) => {
  const unavail = m.avail === 'unavailable'
  return {
    unavail,
    loading: !unavail && m.state === 'loading',
    on: !unavail && m.state === 'playing',
  }
})
