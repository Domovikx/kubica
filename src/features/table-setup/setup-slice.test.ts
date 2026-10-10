import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import { totalCount } from './table-setup'
import { MAX_PER_DIE, MAX_TOTAL, setupActions } from './setup-slice'

const memStorage = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v)
    },
    removeItem: (k: string) => {
      data.delete(k)
    },
  }
}

describe('setup-slice: счётчики и капы', () => {
  it('пусто по умолчанию, total считает', () => {
    const store = createAppStore(memStorage())
    expect(totalCount(store.getState().setup.counts)).toBe(0)
    store.dispatch(setupActions.setCount({ die: 'd6', n: 3 }))
    expect(store.getState().setup.counts.d6).toBe(3)
    expect(totalCount(store.getState().setup.counts)).toBe(3)
  })

  it('капы: на кость и на стол', () => {
    const store = createAppStore(memStorage())
    store.dispatch(setupActions.setCount({ die: 'd6', n: 999 }))
    expect(store.getState().setup.counts.d6).toBe(MAX_PER_DIE)
    store.dispatch(setupActions.setCount({ die: 'd4', n: MAX_TOTAL }))
    store.dispatch(setupActions.setCount({ die: 'd8', n: MAX_TOTAL }))
    expect(totalCount(store.getState().setup.counts)).toBeLessThanOrEqual(MAX_TOTAL)
  })

  it('add/sub, clear, подписка', () => {
    const store = createAppStore(memStorage())
    const seen: number[] = []
    const off = store.subscribe(() => seen.push(totalCount(store.getState().setup.counts)))
    store.dispatch(setupActions.add({ die: 'd20' }))
    store.dispatch(setupActions.add({ die: 'd20' }))
    store.dispatch(setupActions.add({ die: 'd20', delta: -1 }))
    expect(store.getState().setup.counts.d20).toBe(1)
    store.dispatch(setupActions.clear())
    expect(totalCount(store.getState().setup.counts)).toBe(0)
    expect(seen).toEqual([1, 2, 1, 0])
    off()
  })

  it('персист переживает пересоздание стора', () => {
    const storage = memStorage()
    createAppStore(storage).dispatch(setupActions.setCount({ die: 'd4', n: 2 }))
    expect(createAppStore(storage).getState().setup.counts.d4).toBe(2)
  })
})
