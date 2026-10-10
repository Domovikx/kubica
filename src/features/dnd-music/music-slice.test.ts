import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAppStore } from '@/app/store'
import { clampMusicVolume, loadMusicVolume, musicUiActions } from './music-slice'

// vitest-окружение — node: хранилище стабим своё (in-memory). Стейт-машина
// движка покрыта music.test.ts; здесь — зеркало слайса и громкость.
const store = new Map<string, string>()
const asStorage = () => ({
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('music-slice: громкость (персист dice-music-vol)', () => {
  it('дефолт — 40 (пустое хранилище)', () => {
    expect(createAppStore(null).getState().music.volume).toBe(40)
    expect(loadMusicVolume(asStorage())).toBe(40)
  })

  it('preloadedState читает dice-music-vol, написанный движком', () => {
    // Движок setMusicVolume пишет dice-music-vol сам (glue не дублирует) —
    // слайс при старте читает ключ через preloadedState.
    store.set('dice-music-vol', '70')
    expect(createAppStore(asStorage()).getState().music.volume).toBe(70)
  })

  it('битое значение падает на дефолт, set клампится в 0–100', () => {
    store.set('dice-music-vol', 'loud')
    expect(loadMusicVolume(asStorage())).toBe(40)
    store.set('dice-music-vol', '250')
    expect(loadMusicVolume(asStorage())).toBe(40)
    expect(clampMusicVolume(150)).toBe(100)
    expect(clampMusicVolume(-5)).toBe(0)
  })

  it('localStorage бросает — громкость дефолтная, чтение не падает', () => {
    expect(
      loadMusicVolume({
        getItem: () => {
          throw new Error('blocked')
        },
      }),
    ).toBe(40)
  })
})

describe('music-slice: зеркало состояния движка', () => {
  it('syncFromEngine перечитывает геттеры движка (off/unknown в node)', () => {
    const appStore = createAppStore(null)
    appStore.dispatch(musicUiActions.setVolume(55))
    appStore.dispatch(musicUiActions.syncFromEngine())
    const m = appStore.getState().music
    expect(m.state).toBe('off')
    expect(m.avail).toBe('unknown')
    expect(m.volume).toBe(55) // громкость syncFromEngine не трогает
  })
})
