// Экранные производные: фаза стола (data-phase — DOM-контракт чекеров/e2e).
// Селекторы стейта живут рядом со своими редьюсерами (features/entities);
// здесь — только то, что принадлежит экрану и связяет два слайса.
import { createSelector } from '@reduxjs/toolkit'
import { selectMtUi, selectTotal } from '@/features'

export type TablePhase = 'empty' | 'rolling' | 'charging' | 'loading' | 'ready'

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
