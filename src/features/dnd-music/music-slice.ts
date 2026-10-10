// RTK-слайс-зеркало музыки для UI: {state, avail, volume}. Движок music.ts
// (таймеры/YT IFrame) НЕ переписываем — его onMusicChange диспатчит синк
// в этот слайс (подписка ставится в app bootstrap); громкость — write-through
// (компонент зовёт setMusicVolume — движок пишет dice-music-vol и применяет
// к плееру — и диспатчит значение сюда).
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { type MusicAvail, musicAvail, musicState, musicVolume, type MusicState } from './music'

export const MUSIC_VOL_KEY = 'dice-music-vol'
export const DEFAULT_MUSIC_VOL = 40

/** Кламп 0–100; битое — дефолт (тот же кламп, что у setMusicVolume). */
export const clampMusicVolume = (v: number): number =>
  Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : DEFAULT_MUSIC_VOL

export const loadMusicVolume = (storage?: Pick<Storage, 'getItem'> | null): number => {
  try {
    const raw = storage?.getItem(MUSIC_VOL_KEY)
    if (raw === null || raw === undefined) return DEFAULT_MUSIC_VOL
    const v = Number(raw)
    return Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v) : DEFAULT_MUSIC_VOL
  } catch {
    return DEFAULT_MUSIC_VOL
  }
}

export interface MusicUiState {
  state: MusicState
  avail: MusicAvail
  volume: number
}

const musicSlice = createSlice({
  name: 'music',
  initialState: (): MusicUiState => ({
    state: musicState(),
    avail: musicAvail(),
    volume: musicVolume(),
  }),
  reducers: {
    /** Синк из движка (onMusicChange): перечитываем геттеры. */
    syncFromEngine(state) {
      state.state = musicState()
      state.avail = musicAvail()
    },
    setVolume(state, action: PayloadAction<number>) {
      state.volume = clampMusicVolume(action.payload)
    },
  },
})

export const musicUiActions = musicSlice.actions
export const musicUiReducer = musicSlice.reducer
