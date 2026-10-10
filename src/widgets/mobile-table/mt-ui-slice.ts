// RTK-слайс транзиентного UI-состояния виджета стола: оверлеи (шит/дроуэр/
// карточка музыки + dirty-флаги морфа крестика), фаза броска (rolling/
// windActive), итог последнего броска, выбранный сет, двухтап «Очистить»,
// загрузка GLB (loaded/instances/loadError → фаза loading).
// Сторы setup/history/music/sound/side/power — отдельные слайсы (см. store).
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { PoolPart } from '@/entities/roll-history/history'

export type OverlayKind = 'sheet' | 'drawer' | 'music'

export interface MtUiState {
  sheetOpen: boolean
  drawerOpen: boolean
  musicCardOpen: boolean
  /** Морф крестика в «Готово» (панель изменена). */
  dirtySheet: boolean
  dirtyDrawer: boolean
  dirtyMusic: boolean
  rolling: boolean
  /** Зарядка (wind-up) — фаза charging. */
  windActive: boolean
  lastResult: { label: string; total: number; parts: PoolPart[] } | null
  /** Выбранный сет (aria-pressed чипа, «Обновить набор»). */
  activeSet: string | null
  /** Двухтап «Очистить историю»: armed → повторный тап подтверждает. */
  clearArmed: boolean
  /** Загрузка GLB-моделей (фаза loading: loaded < instances). */
  loaded: number
  instances: number
  loadError: string
}

const initialState = (): MtUiState => ({
  sheetOpen: false,
  drawerOpen: false,
  musicCardOpen: false,
  dirtySheet: false,
  dirtyDrawer: false,
  dirtyMusic: false,
  rolling: false,
  windActive: false,
  lastResult: null,
  activeSet: null,
  clearArmed: false,
  loaded: 0,
  instances: 0,
  loadError: '',
})

const dirtyKey = (kind: OverlayKind): 'dirtySheet' | 'dirtyDrawer' | 'dirtyMusic' =>
  kind === 'sheet' ? 'dirtySheet' : kind === 'drawer' ? 'dirtyDrawer' : 'dirtyMusic'

const mtUiSlice = createSlice({
  name: 'mtUi',
  initialState,
  reducers: {
    openOverlay(state, action: PayloadAction<OverlayKind>) {
      const kind = action.payload
      // Как в легаси openSheet/openDrawer/openMusicCard: открыт ровно один
      // оверлей, морф открытого крестика сбрасывается (rest при открытии).
      state.sheetOpen = kind === 'sheet'
      state.drawerOpen = kind === 'drawer'
      state.musicCardOpen = kind === 'music'
      if (kind === 'sheet') state.dirtySheet = false
      else if (kind === 'drawer') state.dirtyDrawer = false
      else state.dirtyMusic = false
    },
    closeOverlays(state) {
      state.sheetOpen = false
      state.drawerOpen = false
      state.musicCardOpen = false
      state.dirtySheet = false
      state.dirtyDrawer = false
      state.dirtyMusic = false
    },
    setDirty(state, action: PayloadAction<{ kind: OverlayKind; dirty: boolean }>) {
      state[dirtyKey(action.payload.kind)] = action.payload.dirty
    },
    setRolling(state, action: PayloadAction<boolean>) {
      state.rolling = action.payload
    },
    setWindActive(state, action: PayloadAction<boolean>) {
      state.windActive = action.payload
    },
    setLastResult(
      state,
      action: PayloadAction<{ label: string; total: number; parts: PoolPart[] } | null>,
    ) {
      // Guard: тот же null (mount/синк без изменений) — без нового состояния.
      if (state.lastResult === action.payload) return
      state.lastResult = action.payload
    },
    setActiveSet(state, action: PayloadAction<string | null>) {
      state.activeSet = action.payload
    },
    setClearArmed(state, action: PayloadAction<boolean>) {
      state.clearArmed = action.payload
    },
    setLoadProgress(state, action: PayloadAction<{ loaded: number; instances: number }>) {
      state.loaded = action.payload.loaded
      state.instances = action.payload.instances
    },
    setLoadError(state, action: PayloadAction<string>) {
      state.loadError = action.payload
    },
  },
})

export const mtUiActions = mtUiSlice.actions
export const mtUiReducer = mtUiSlice.reducer
