import { describe, expect, it, vi } from 'vitest'
import { createPoolStore, type PoolRoller } from './pool-store'
import type { PoolResult } from './pool'

const canned = (total: number): PoolResult => ({ total, parts: [], label: 'd20' })

describe('pool-store: формула и степперы', () => {
  it('стартует с d20 без ошибки', () => {
    const store = createPoolStore(async () => canned(1))
    const s = store.getState()
    expect(s.formula).toBe('d20')
    expect(s.error).toBeNull()
    expect(s.phase).toBe('idle')
  })

  it('невалидная формула даёт текст ошибки и блокирует бросок', async () => {
    const roller = vi.fn()
    const store = createPoolStore(roller)
    store.setFormula('4d6-')
    expect(store.getState().error).not.toBeNull()
    expect(store.getState().expr).toBeNull()
    await expect(store.roll()).rejects.toThrowError()
    expect(roller).not.toHaveBeenCalled()
  })

  it('степпер растит/схлопывает plain-терм', () => {
    const store = createPoolStore(async () => canned(1))
    store.adjustDie(6, 1)
    expect(store.getState().formula).toBe('d20+d6')
    store.adjustDie(20, 1)
    expect(store.getState().formula).toBe('2d20+d6')
    store.adjustDie(20, -1)
    expect(store.getState().formula).toBe('d20+d6')
  })

  it('степпер в ноль убирает терм; пустой пул — ошибка', () => {
    const store = createPoolStore(async () => canned(1))
    store.setFormula('d6')
    store.adjustDie(6, -1)
    const s = store.getState()
    expect(s.expr).toBeNull()
    expect(s.error).not.toBeNull()
  })

  it('пресет подставляет формулу', () => {
    const store = createPoolStore(async () => canned(1))
    store.applyPreset('8d6')
    expect(store.getState().formula).toBe('8d6')
    expect(store.getState().error).toBeNull()
  })
})

describe('pool-store: бросок и гонки', () => {
  const deferredRoller = () => {
    const queue: Array<(r: PoolResult) => void> = []
    const roller: PoolRoller = () =>
      new Promise<PoolResult>((resolve) => {
        queue.push(resolve)
      })
    return { roller, queue }
  }

  it('idle → rolling → settled с результатом', async () => {
    const store = createPoolStore(async () => canned(7))
    const phases: string[] = []
    store.subscribe((s) => phases.push(s.phase))
    expect(store.getState().phase).toBe('idle')
    const result = await store.roll()
    expect(result.total).toBe(7)
    expect(phases).toEqual(['idle', 'rolling', 'settled'])
    expect(store.getState().result?.total).toBe(7)
  })

  it('протухший бросок игнорируется', async () => {
    const { roller, queue } = deferredRoller()
    const store = createPoolStore(roller)
    const seen: number[] = []
    store.subscribe((s) => {
      if (s.phase === 'settled' && s.result) seen.push(s.result.total)
    })
    const p1 = store.roll()
    const p2 = store.roll()
    queue[0]({ total: 1, parts: [], label: 'stale' })
    await p1
    queue[1]({ total: 2, parts: [], label: 'fresh' })
    const r2 = await p2
    expect(r2.total).toBe(2)
    expect(seen).toEqual([2])
  })

  it('отписка останавливает уведомления', async () => {
    const store = createPoolStore(async () => canned(1))
    const listener = vi.fn()
    const off = store.subscribe(listener)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    await store.roll()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
