import { describe, expect, it, vi } from 'vitest'
import {
  createHistoryStore,
  formatLabel,
  formatParts,
  type PoolPart,
  type RollInput,
} from './history'

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

const result = (over: Partial<RollInput> = {}): RollInput => ({
  die: 'd20',
  value: 17,
  display: '17',
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

  it('не-массив в хранилище читается как пустая история', () => {
    const storage = memStorage()
    storage.setItem('dice-rolls-v1', JSON.stringify({ die: 'd6' }))
    expect(createHistoryStore(storage).list()).toEqual([])
  })

  it('мусорные записи отфильтрованы, валидные остаются', () => {
    const storage = memStorage()
    storage.setItem(
      'dice-rolls-v1',
      JSON.stringify([
        null,
        'строка',
        { die: 'd6' },
        { die: 'd6', value: 4, at: 1000 },
        { die: 5, value: 1, at: 1 },
      ]),
    )
    const list = createHistoryStore(storage).list()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ die: 'd6', value: 4, at: 1000 })
  })

  it('запись — только поля истории: лишнего в JSON нет', () => {
    const storage = memStorage()
    const h = createHistoryStore(storage)
    h.add(result({ label: '2d20kh1' }))
    h.add(result({ at: 2000 }))
    const raw = storage.getItem('dice-rolls-v1') as string
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
    expect(Object.keys(parsed[0]).sort()).toEqual(['at', 'die', 'display', 'value'])
    expect(Object.keys(parsed[1]).sort()).toEqual(['at', 'die', 'display', 'label', 'value'])
    expect(raw).not.toContain('undefined')
  })
})

describe('formatLabel: лейбл для показа', () => {
  it('плюс-разделитель костей → пробел', () => {
    expect(formatLabel('d4+d6')).toBe('d4 d6')
    expect(formatLabel('d20+d6')).toBe('d20 d6')
    expect(formatLabel('4d6+2d4')).toBe('4d6 2d4')
  })

  it('модификаторы и минус остаются частью нотации', () => {
    expect(formatLabel('2d20kh1+5')).toBe('2d20kh1+5')
    expect(formatLabel('4d6-L')).toBe('4d6-L')
    expect(formatLabel('8d6')).toBe('8d6')
  })
})

describe('formatParts: текстовая разбивка пула', () => {
  const part = (over: Partial<PoolPart>): PoolPart => ({
    die: 'd20',
    value: 1,
    display: '1',
    kept: true,
    ...over,
  })

  it('advantage 2d20kh1 [7, 19]: сброшенная в скобках', () => {
    expect(
      formatParts([
        part({ value: 7, display: '7', kept: false }),
        part({ value: 19, display: '19', kept: true }),
      ]),
    ).toEqual(['(7)', '19'])
  })

  it('все удержаны — как есть, пустой пул — пусто', () => {
    expect(
      formatParts([
        part({ die: 'd6', value: 3, display: '3' }),
        part({ die: 'd6', value: 5, display: '5' }),
      ]),
    ).toEqual(['3', '5'])
    expect(formatParts([])).toEqual([])
  })

  it('display не пересчитывается (d10: «10» проходит как есть)', () => {
    expect(formatParts([part({ die: 'd10', value: 0, display: '10', kept: false })])).toEqual([
      '(10)',
    ])
  })
})
