// RTK-слайс звука/вибро (UI-зеркало): персист dice-muted/dice-haptics.
// Паттерн write-through: обработчик зовёт движок (setMuted/setHaptics — он
// пишет localStorage и стопит рокот) и диспатчит то же значение в слайс;
// движок читает localStorage напрямую (isMuted/hapticsEnabled) — ключи те же.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { hapticsEnabled, isMuted } from './sound'

export const MUTE_KEY = 'dice-muted'
export const HAPTICS_KEY = 'dice-haptics'

export const loadMuted = (storage?: Pick<Storage, 'getItem'> | null): boolean => {
  try {
    return storage?.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

/** Вибрация отдельно от звука (дефолт вкл; «0» — выкл, как у hapticsEnabled). */
export const loadHaptics = (storage?: Pick<Storage, 'getItem'> | null): boolean => {
  try {
    return storage?.getItem(HAPTICS_KEY) !== '0'
  } catch {
    return true
  }
}

export interface SoundState {
  muted: boolean
  haptics: boolean
}

const soundSlice = createSlice({
  name: 'sound',
  initialState: (): SoundState => ({ muted: isMuted(), haptics: hapticsEnabled() }),
  reducers: {
    setMuted(state, action: PayloadAction<boolean>) {
      state.muted = action.payload
    },
    setHaptics(state, action: PayloadAction<boolean>) {
      state.haptics = action.payload
    },
  },
})

export const soundActions = soundSlice.actions
export const soundReducer = soundSlice.reducer
