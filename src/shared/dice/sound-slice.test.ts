import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import { loadHaptics, loadMuted, soundActions } from './sound-slice'

const memStorage = (data = new Map<string, string>()) => ({
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => void data.set(k, v),
  removeItem: (k: string) => void data.delete(k),
})

describe('sound-slice: мьют/вибро (UI-зеркало)', () => {
  it('дефолты: звук вкл (не замьючен), вибро вкл', () => {
    const s = createAppStore(memStorage()).getState().sound
    expect(s.muted).toBe(false)
    expect(s.haptics).toBe(true)
  })

  it('roundtrip: тумблеры переживают перечитывание', () => {
    const data = new Map<string, string>()
    const storage = memStorage(data)
    const store = createAppStore(storage)
    store.dispatch(soundActions.setMuted(true))
    store.dispatch(soundActions.setHaptics(false))
    expect(data.get('dice-muted')).toBe('1')
    expect(data.get('dice-haptics')).toBe('0')
    const s2 = createAppStore(storage).getState().sound
    expect(s2.muted).toBe(true)
    expect(s2.haptics).toBe(false)
  })

  it('битые значения: мьют — только «1» = true, вибро — «0» = выкл', () => {
    expect(loadMuted(memStorage(new Map([['dice-muted', '5']])))).toBe(false)
    expect(loadHaptics(memStorage(new Map([['dice-haptics', '5']])))).toBe(true)
  })

  it('localStorage бросает — дефолты, диспатч не падает', () => {
    const throwing = {
      getItem: (): string | null => {
        throw new Error('blocked')
      },
      setItem: (): void => {
        throw new Error('blocked')
      },
      removeItem: (): void => {
        throw new Error('blocked')
      },
    }
    expect(loadMuted(throwing)).toBe(false)
    expect(loadHaptics(throwing)).toBe(true)
    expect(() => createAppStore(throwing).dispatch(soundActions.setMuted(true))).not.toThrow()
  })
})
