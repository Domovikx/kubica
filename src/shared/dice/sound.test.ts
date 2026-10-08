import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  hapticsEnabled,
  hitParams,
  isMuted,
  playThock,
  rattleHit,
  setHaptics,
  setMuted,
  startRattle,
  stopRattle,
} from './sound'

const seeded = (seq: number[]) => {
  let i = 0
  return () => seq[i++ % seq.length]
}

describe('sound: параметры модального удара (pure)', () => {
  it('классы высоты: d20 ниже d6 (и моды, и тело)', () => {
    const rand = seeded([0.5])
    const small = hitParams('d6', 1, rand)
    const big = hitParams('d20', 1, seeded([0.5]))
    expect(big.modes[0].freq).toBeLessThan(small.modes[0].freq)
    expect(big.bodyFreq).toBeLessThan(small.bodyFreq)
  })

  it('структура удара: 3 моды с убывающим gain, позитивные decay', () => {
    const p = hitParams('d6', 0.7, seeded([0.5]))
    expect(p.modes).toHaveLength(3)
    expect(p.modes[0].gain).toBeGreaterThan(p.modes[1].gain)
    expect(p.modes[1].gain).toBeGreaterThan(p.modes[2].gain)
    for (const m of p.modes) {
      expect(m.freq).toBeGreaterThan(1500)
      expect(m.freq).toBeLessThan(6000)
      expect(m.decay).toBeGreaterThan(0)
    }
    expect(p.attackDur).toBeGreaterThan(0.005)
    expect(p.attackDur).toBeLessThan(0.02)
    expect(p.peak).toBeGreaterThan(0)
  })

  it('сила масштабирует пик и яркость атаки', () => {
    const soft = hitParams('d6', 0.1, seeded([0.5]))
    const hard = hitParams('d6', 1, seeded([0.5]))
    expect(hard.peak).toBeGreaterThan(soft.peak)
    expect(hard.attackFreq).toBeGreaterThan(soft.attackFreq)
  })

  it('неизвестная кость — small-класс, интенсивность каппится 0..1', () => {
    const p = hitParams('d100', 5, seeded([0.5]))
    expect(p.modes[0].freq).toBeGreaterThan(1500)
    const zero = hitParams('d6', -2, seeded([0.5]))
    expect(zero.peak).toBeGreaterThan(0)
  })
})

describe('sound: микроудар рокота (pure)', () => {
  it('короткий, приглушённый, иногда яркий', () => {
    const h = rattleHit(seeded([0.5]))
    expect(h.dur).toBeGreaterThanOrEqual(0.03)
    expect(h.dur).toBeLessThanOrEqual(0.06)
    expect(h.lpFreq).toBeGreaterThanOrEqual(900)
    expect(h.lpFreq).toBeLessThanOrEqual(1400)
    expect(h.pan).toBeGreaterThanOrEqual(-0.3)
    expect(h.pan).toBeLessThanOrEqual(0.3)
    // bright ~15%: сид 0.5 -> false, сид 0.05 -> true
    expect(rattleHit(seeded([0.05])).bright).toBe(true)
    expect(rattleHit(seeded([0.5])).bright).toBe(false)
  })
})

describe('sound: безопасность без AudioContext (node/headless)', () => {
  it('движок молча no-op, ничего не бросает', () => {
    expect(() => {
      startRattle()
      playThock('d6', 0.5)
      playThock('d20')
      stopRattle()
    }).not.toThrow()
  })
})

describe('sound: тумблеры мьюта и вибро (персист)', () => {
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

  it('дефолт: звук вкл, вибро вкл; roundtrip переживает перечитывание', () => {
    expect(isMuted()).toBe(false)
    expect(hapticsEnabled()).toBe(true)
    setMuted(true)
    setHaptics(false)
    expect(isMuted()).toBe(true)
    expect(hapticsEnabled()).toBe(false)
    setMuted(false)
    setHaptics(true)
    expect(isMuted()).toBe(false)
    expect(hapticsEnabled()).toBe(true)
  })

  it('битые значения в хранилище не выключают звук и вибро молча', () => {
    store.set('dice-muted', 'да')
    store.set('dice-haptics', 'нет')
    expect(isMuted()).toBe(false)
    expect(hapticsEnabled()).toBe(true)
  })

  it('битое хранилище (бросает) — тумблеры на дефолтах, без падения', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('quota')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('quota')
      },
    })
    expect(isMuted()).toBe(false)
    expect(hapticsEnabled()).toBe(true)
    expect(() => setMuted(true)).not.toThrow()
    expect(() => setHaptics(false)).not.toThrow()
  })
})
