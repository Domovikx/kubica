// RTK-слайс масштаба интерфейса (2.20): персист dice-uiscale, применение —
// через CSS-переменную --ui-scale (сайд-эффект в app bootstrap/store glue).
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { type UiScale, UI_SCALES, uiScale } from './ui-scale'

export const UI_SCALE_KEY = 'dice-uiscale'

export const loadUiScale = (storage?: Pick<Storage, 'getItem'> | null): UiScale => {
  try {
    const raw = storage?.getItem(UI_SCALE_KEY)
    if (raw === null || raw === undefined) return 1
    const v = Number(raw)
    return (UI_SCALES as readonly number[]).includes(v) ? (v as UiScale) : 1
  } catch {
    return 1
  }
}

export interface UiScaleState {
  scale: UiScale
}

const uiScaleSlice = createSlice({
  name: 'uiScale',
  initialState: (): UiScaleState => ({ scale: uiScale() }),
  reducers: {
    setScale(state, action: PayloadAction<UiScale>) {
      state.scale = action.payload
    },
  },
})

export const uiScaleActions = uiScaleSlice.actions
export const uiScaleReducer = uiScaleSlice.reducer
