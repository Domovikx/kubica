import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import { UI_SCALES } from './ui-scale'
import { loadUiScale, uiScaleActions } from './ui-scale-slice'

const memStorage = (data = new Map<string, string>()) => ({
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => void data.set(k, v),
  removeItem: (k: string) => void data.delete(k),
})

describe('ui-scale-slice: масштаб интерфейса (меню-бургер)', () => {
  it('дефолт — 100% (пустое хранилище)', () => {
    expect(createAppStore(memStorage()).getState().uiScale.scale).toBe(1)
  })

  it('шаги — ровно 100/125/150/175/200% (WCAG 1.4.4: до 200%)', () => {
    expect(UI_SCALES).toEqual([1, 1.25, 1.5, 1.75, 2])
  })

  it('roundtrip: выбранный масштаб переживает перечитывание', () => {
    const data = new Map<string, string>()
    const storage = memStorage(data)
    createAppStore(storage).dispatch(uiScaleActions.setScale(1.5))
    expect(createAppStore(storage).getState().uiScale.scale).toBe(1.5)
    expect(data.get('dice-uiscale')).toBe('1.5')
  })

  it('битое значение в хранилище падает на 100%, а не ломает масштаб', () => {
    expect(loadUiScale(memStorage(new Map([['dice-uiscale', 'uber']])))).toBe(1)
    expect(loadUiScale(memStorage(new Map([['dice-uiscale', '1.3']])))).toBe(1)
  })

  it('localStorage бросает исключение — масштаб дефолтный, а не падение', () => {
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
    expect(loadUiScale(throwing)).toBe(1)
    expect(() => createAppStore(throwing).dispatch(uiScaleActions.setScale(2))).not.toThrow()
  })
})
