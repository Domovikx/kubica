// Единый RTK-store приложения (см. амандированный план задачи mobile-split).
// Слайсы: setup (набор стола), history (броски), uiScale, power, sound, music
// (зеркало движка), mtUi (транзиент виджета). Персист — свой glue без
// redux-persist: preloadedState из localStorage на старте + подписка, пишет
// только изменившиеся слайсы (ключи 1:1 к прежним: kubica-table-v1,
// dice-rolls-v1, dice-uiscale, dice-power, dice-muted, dice-haptics).
import { configureStore } from '@reduxjs/toolkit'
import {
  historyActions,
  HISTORY_KEY,
  historyReducer,
  loadHistoryEntries,
} from '@/entities/roll-history/history-slice'
import { loadMusicVolume, musicUiActions, musicUiReducer } from '@/features/dnd-music/music-slice'
import {
  loadThrowPower,
  POWER_KEY,
  powerActions,
  powerReducer,
} from '@/features/roll-dice/power-slice'
import {
  loadSetupCounts,
  SETUP_KEY,
  setupActions,
  setupReducer,
} from '@/features/table-setup/setup-slice'
import { applyUiScale } from '@/features/ui-scale/ui-scale'
import {
  loadUiScale,
  UI_SCALE_KEY,
  uiScaleActions,
  uiScaleReducer,
} from '@/features/ui-scale/ui-scale-slice'
import {
  HAPTICS_KEY,
  loadHaptics,
  loadMuted,
  MUTE_KEY,
  soundActions,
  soundReducer,
} from '@/shared/dice/sound-slice'
import { mtUiActions, mtUiReducer } from '@/widgets/mobile-table/mt-ui-slice'

type PersistStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const defaultStorage = (): PersistStorage | undefined =>
  typeof localStorage !== 'undefined' ? localStorage : undefined

export const createAppStore = (storage?: PersistStorage | null) => {
  const s = storage === undefined ? defaultStorage() : (storage ?? undefined)
  const store = configureStore({
    reducer: {
      setup: setupReducer,
      history: historyReducer,
      uiScale: uiScaleReducer,
      power: powerReducer,
      sound: soundReducer,
      music: musicUiReducer,
      mtUi: mtUiReducer,
    },
    preloadedState: s
      ? {
          setup: { counts: loadSetupCounts(s) },
          history: { entries: loadHistoryEntries(s) },
          uiScale: { scale: loadUiScale(s) },
          power: { mode: loadThrowPower(s) },
          sound: { muted: loadMuted(s), haptics: loadHaptics(s) },
          music: { state: 'off' as const, avail: 'unknown' as const, volume: loadMusicVolume(s) },
        }
      : undefined,
  })

  if (s) {
    let prev = store.getState()
    store.subscribe(() => {
      const state = store.getState()
      try {
        if (state.setup !== prev.setup) s.setItem(SETUP_KEY, JSON.stringify(state.setup.counts))
        if (state.history !== prev.history) {
          if (state.history.entries.length === 0) s.removeItem(HISTORY_KEY)
          else s.setItem(HISTORY_KEY, JSON.stringify(state.history.entries))
        }
        if (state.uiScale !== prev.uiScale) {
          s.setItem(UI_SCALE_KEY, String(state.uiScale.scale))
          applyUiScale(state.uiScale.scale)
        }
        if (state.power !== prev.power) s.setItem(POWER_KEY, state.power.mode)
        if (state.sound !== prev.sound) {
          s.setItem(MUTE_KEY, state.sound.muted ? '1' : '0')
          s.setItem(HAPTICS_KEY, state.sound.haptics ? '1' : '0')
        }
      } catch {
        // Приватный режим / переполнение — персист не критичен
      }
      prev = state
    })
  }

  return store
}

export type AppStore = ReturnType<typeof createAppStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']

/** Синглтон приложения (Provider и вне-React диспатчи: table-roll, boot). */
export const store: AppStore = createAppStore()

export const appActions = {
  setup: setupActions,
  history: historyActions,
  uiScale: uiScaleActions,
  power: powerActions,
  sound: soundActions,
  music: musicUiActions,
  mtUi: mtUiActions,
} as const
