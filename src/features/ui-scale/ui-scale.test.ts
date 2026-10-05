import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UI_SCALES, applyUiScale, setUiScale, uiScale } from './ui-scale'

// vitest-окружение — node: localStorage нет, стабим свой (in-memory).
const store = new Map<string, string>()

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

describe('ui-scale: масштаб интерфейса (меню-бургер)', () => {
  it('дефолт — 100% (пустое хранилище)', () => {
    expect(uiScale()).toBe(1)
  })

  it('шаги — ровно 100/125/150/175/200% (WCAG 1.4.4: до 200%)', () => {
    expect(UI_SCALES).toEqual([1, 1.25, 1.5, 1.75, 2])
  })

  it('roundtrip: выбранный масштаб переживает перечитывание', () => {
    setUiScale(1.5)
    expect(uiScale()).toBe(1.5)
    expect(store.get('dice-uiscale')).toBe('1.5')
  })

  it('битое значение в хранилище падает на 100%, а не ломает масштаб', () => {
    store.set('dice-uiscale', 'uber')
    expect(uiScale()).toBe(1)
    store.set('dice-uiscale', '1.3')
    expect(uiScale()).toBe(1)
  })

  it('localStorage бросает исключение — масштаб дефолтный, а не падение', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(uiScale()).toBe(1)
    expect(() => setUiScale(2)).not.toThrow()
  })

  it('applyUiScale без document не падает (node)', () => {
    expect(() => applyUiScale(1.75)).not.toThrow()
  })
})
