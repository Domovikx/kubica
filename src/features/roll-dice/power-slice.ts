// RTK-слайс силы броска (меню-бургер, персист dice-power). Boost-формула и
// чтение для жестов остаются в power.ts (throwPowerBoost читает localStorage).
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { type ThrowPowerMode, throwPower } from './power'

export const POWER_KEY = 'dice-power'

const isMode = (v: string | null): v is ThrowPowerMode =>
  v === 'normal' || v === 'strong' || v === 'mighty'

export const loadThrowPower = (storage?: Pick<Storage, 'getItem'> | null): ThrowPowerMode => {
  try {
    const v = storage?.getItem(POWER_KEY) ?? null
    return isMode(v) ? v : 'normal'
  } catch {
    return 'normal'
  }
}

export interface PowerState {
  mode: ThrowPowerMode
}

const powerSlice = createSlice({
  name: 'power',
  initialState: (): PowerState => ({ mode: throwPower() }),
  reducers: {
    setMode(state, action: PayloadAction<ThrowPowerMode>) {
      state.mode = action.payload
    },
  },
})

export const powerActions = powerSlice.actions
export const powerReducer = powerSlice.reducer
