import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THROW_POWERS, setThrowPower, throwPower, throwPowerBoost } from './power'

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

describe('power: сила броска ?m=1 (меню вместо зарядки)', () => {
  it('дефолт — Обычный (пустое хранилище)', () => {
    expect(throwPower()).toBe('normal')
    expect(throwPowerBoost()).toBe(0)
  })

  it('roundtrip: выбранный режим переживает перечитывание', () => {
    setThrowPower('mighty')
    expect(throwPower()).toBe('mighty')
    expect(throwPowerBoost()).toBe(1)
  })

  it('битое значение в хранилище падает на «Обычный», а не ломает бросок', () => {
    store.set('dice-power', 'uber')
    expect(throwPower()).toBe('normal')
    expect(throwPowerBoost(throwPower())).toBe(0)
  })

  it('boost-шкала: 1.0× / 1.3× / 1.6× (та же формула 1+boost×0.6, что у зарядки)', () => {
    expect(THROW_POWERS.map((p) => p.mode)).toEqual(['normal', 'strong', 'mighty'])
    for (const p of THROW_POWERS) {
      expect(1 + p.boost * 0.6).toBeCloseTo(Number(p.name.match(/1\.\d/)?.[0] ?? '1.0'))
    }
  })

  it('localStorage бросает исключение — режим дефолтный, а не падение', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(throwPower()).toBe('normal')
    expect(() => setThrowPower('strong')).not.toThrow()
  })
})
