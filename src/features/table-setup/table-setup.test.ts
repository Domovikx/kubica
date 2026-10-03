import { describe, expect, it } from 'vitest'
import {
  createSetupStore,
  emptyCounts,
  expandInstances,
  MAX_PER_DIE,
  MAX_TOTAL,
  totalCount,
} from './table-setup'

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

describe('table-setup: счётчики и капы', () => {
  it('пусто по умолчанию, total считает', () => {
    const store = createSetupStore(memStorage())
    expect(totalCount(store.get())).toBe(0)
    store.setCount('d6', 3)
    expect(store.get().d6).toBe(3)
    expect(totalCount(store.get())).toBe(3)
  })

  it('капы: на кость и на стол', () => {
    const store = createSetupStore(memStorage())
    store.setCount('d6', 999)
    expect(store.get().d6).toBe(MAX_PER_DIE)
    store.setCount('d4', MAX_TOTAL)
    store.setCount('d8', MAX_TOTAL)
    expect(totalCount(store.get())).toBeLessThanOrEqual(MAX_TOTAL)
  })

  it('add/sub, clear, подписка', () => {
    const store = createSetupStore(memStorage())
    const seen: number[] = []
    const off = store.subscribe((c) => seen.push(totalCount(c)))
    store.add('d20')
    store.add('d20')
    store.add('d20', -1)
    expect(store.get().d20).toBe(1)
    store.clear()
    expect(totalCount(store.get())).toBe(0)
    expect(seen).toEqual([1, 2, 1, 0])
    off()
  })

  it('персист переживает пересоздание стора', () => {
    const storage = memStorage()
    createSetupStore(storage).setCount('d4', 2)
    expect(createSetupStore(storage).get().d4).toBe(2)
  })

  it('expandInstances: стабильные ключи, порядок DIE_IDS', () => {
    const counts = { ...emptyCounts(), d6: 2, d4: 1 }
    expect(expandInstances(counts)).toEqual([
      { die: 'd4', key: 'd4#0' },
      { die: 'd6', key: 'd6#0' },
      { die: 'd6', key: 'd6#1' },
    ])
  })
})
