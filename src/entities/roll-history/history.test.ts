import { describe, expect, it, vi } from 'vitest'
import { createHistoryStore } from './history'
import type { RollResult } from '@/features/roll-dice/roll-store'

const memStorage = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      data.set(k, v)
    },
    removeItem: (k: string) => {
      data.delete(k)
    },
  }
}

const result = (over: Partial<RollResult> = {}): RollResult => ({
  die: 'd20',
  value: 17,
  display: '17',
  quat: [0, 0, 0, 1],
  settled: true,
  at: 1000,
  ...over,
})

describe('roll-history', () => {
  it('add кладёт запись первой, display хранится как есть', () => {
    const h = createHistoryStore(memStorage())
    h.add(result({ die: 'd20', value: 17 }))
    h.add(result({ die: 'd10', value: 0, display: '10', at: 2000 }))
    const list = h.list()
    expect(list).toHaveLength(2)
    expect(list[0].die).toBe('d10')
    expect(list[0].display).toBe('10')
    expect(list[1].die).toBe('d20')
  })

  it('лимит 50 записей', () => {
    const h = createHistoryStore(memStorage())
    for (let i = 0; i < 60; i++) h.add(result({ at: i }))
    expect(h.list()).toHaveLength(50)
    expect(h.list()[0].at).toBe(59)
  })

  it('персист между инстансами через одно хранилище', () => {
    const storage = memStorage()
    const h1 = createHistoryStore(storage)
    h1.add(result({ die: 'd6', value: 4 }))
    const h2 = createHistoryStore(storage)
    expect(h2.list()).toHaveLength(1)
    expect(h2.list()[0].die).toBe('d6')
  })

  it('битый JSON не роняет стор', () => {
    const storage = memStorage()
    storage.setItem('dice-rolls-v1', 'не json {{{')
    const h = createHistoryStore(storage)
    expect(h.list()).toEqual([])
    h.add(result())
    expect(h.list()).toHaveLength(1)
  })

  it('подписка и clear', () => {
    const h = createHistoryStore(memStorage())
    const listener = vi.fn()
    const off = h.subscribe(listener)
    expect(listener).toHaveBeenCalledTimes(1)
    h.add(result())
    expect(listener).toHaveBeenCalledTimes(2)
    h.clear()
    expect(h.list()).toEqual([])
    off()
    h.add(result())
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('переполнение quota не роняет add', () => {
    const storage = memStorage()
    const h = createHistoryStore({
      ...storage,
      setItem: () => {
        throw new Error('quota')
      },
    })
    h.add(result())
    expect(h.list()).toHaveLength(1)
  })

  it('пул с parts переживает персист, старые записи без parts читаются', () => {
    const storage = memStorage()
    const h1 = createHistoryStore(storage)
    h1.add(result())
    h1.add({
      ...result({ at: 2000 }),
      label: '2d20kh1',
      parts: [
        { die: 'd20', value: 17, display: '17', kept: true },
        { die: 'd20', value: 3, display: '3', kept: false },
      ],
    })
    const h2 = createHistoryStore(storage)
    expect(h2.list()).toHaveLength(2)
    expect(h2.list()[0].label).toBe('2d20kh1')
    expect(h2.list()[0].parts).toHaveLength(2)
    expect(h2.list()[1].parts).toBeUndefined()
  })
})
