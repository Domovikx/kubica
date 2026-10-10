import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import { THROW_POWERS } from './power'
import { loadThrowPower, powerActions } from './power-slice'

const memStorage = (data = new Map<string, string>()) => ({
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => void data.set(k, v),
  removeItem: (k: string) => void data.delete(k),
})

describe('power-slice: сила броска стола (меню вместо зарядки)', () => {
  it('дефолт — Обычный (пустое хранилище)', () => {
    expect(createAppStore(memStorage()).getState().power.mode).toBe('normal')
  })

  it('roundtrip: выбранный режим переживает перечитывание', () => {
    const data = new Map<string, string>()
    const storage = memStorage(data)
    createAppStore(storage).dispatch(powerActions.setMode('mighty'))
    expect(createAppStore(storage).getState().power.mode).toBe('mighty')
    expect(data.get('dice-power')).toBe('mighty')
  })

  it('битое значение в хранилище падает на «Обычный», а не ломает бросок', () => {
    expect(loadThrowPower(memStorage(new Map([['dice-power', 'uber']])))).toBe('normal')
  })

  it('boost-шкала: 1.0× / 1.3× / 1.6× (та же формула 1+boost×0.6, что у зарядки)', () => {
    expect(THROW_POWERS.map((p) => p.mode)).toEqual(['normal', 'strong', 'mighty'])
    for (const p of THROW_POWERS) {
      expect(1 + p.boost * 0.6).toBeCloseTo(Number(p.name.match(/1\.\d/)?.[0] ?? '1.0'))
    }
  })

  it('localStorage бросает исключение — режим дефолтный, а не падение', () => {
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
    expect(loadThrowPower(throwing)).toBe('normal')
    expect(() => createAppStore(throwing).dispatch(powerActions.setMode('strong'))).not.toThrow()
  })
})
