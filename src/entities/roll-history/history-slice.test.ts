import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import type { RollInput } from './history'
import { historyActions } from './history-slice'

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

describe('history-slice', () => {
  it('add кладёт запись первой, display хранится как есть', () => {
    const store = createAppStore(memStorage())
    store.dispatch(historyActions.add(result({ die: 'd20', value: 17 })))
    store.dispatch(historyActions.add(result({ die: 'd10', value: 0, display: '10', at: 2000 })))
    const list = store.getState().history.entries
    expect(list).toHaveLength(2)
    expect(list[0].die).toBe('d10')
    expect(list[0].display).toBe('10')
    expect(list[1].die).toBe('d20')
  })

  it('лимит 50 записей', () => {
    const store = createAppStore(memStorage())
    for (let i = 0; i < 60; i++) store.dispatch(historyActions.add(result({ at: i })))
    expect(store.getState().history.entries).toHaveLength(50)
    expect(store.getState().history.entries[0].at).toBe(59)
  })

  it('персист между инстансами через одно хранилище', () => {
    const storage = memStorage()
    createAppStore(storage).dispatch(historyActions.add(result({ die: 'd6', value: 4 })))
    const store2 = createAppStore(storage)
    expect(store2.getState().history.entries).toHaveLength(1)
    expect(store2.getState().history.entries[0].die).toBe('d6')
  })

  it('битый JSON не роняет стор', () => {
    const storage = memStorage()
    storage.setItem('dice-rolls-v1', 'не json {{{')
    const store = createAppStore(storage)
    expect(store.getState().history.entries).toEqual([])
    store.dispatch(historyActions.add(result()))
    expect(store.getState().history.entries).toHaveLength(1)
  })

  it('clear очищает и удаляет ключ персиста', () => {
    const storage = memStorage()
    const store = createAppStore(storage)
    store.dispatch(historyActions.add(result()))
    expect(storage.getItem('dice-rolls-v1')).not.toBeNull()
    store.dispatch(historyActions.clear())
    expect(store.getState().history.entries).toEqual([])
    expect(storage.getItem('dice-rolls-v1')).toBeNull()
  })

  it('переполнение quota не роняет add', () => {
    const storage = memStorage()
    const store = createAppStore({
      ...storage,
      setItem: () => {
        throw new Error('quota')
      },
    })
    store.dispatch(historyActions.add(result()))
    expect(store.getState().history.entries).toHaveLength(1)
  })

  it('пул с parts переживает персист, старые записи без parts читаются', () => {
    const storage = memStorage()
    const s1 = createAppStore(storage)
    s1.dispatch(historyActions.add(result()))
    s1.dispatch(
      historyActions.add({
        ...result({ at: 2000 }),
        label: '2d20kh1',
        parts: [
          { die: 'd20', value: 17, display: '17', kept: true },
          { die: 'd20', value: 3, display: '3', kept: false },
        ],
      }),
    )
    const s2 = createAppStore(storage)
    expect(s2.getState().history.entries).toHaveLength(2)
    expect(s2.getState().history.entries[0].label).toBe('2d20kh1')
    expect(s2.getState().history.entries[0].parts).toHaveLength(2)
    expect(s2.getState().history.entries[1].parts).toBeUndefined()
  })

  it('не-массив в хранилище читается как пустая история', () => {
    const storage = memStorage()
    storage.setItem('dice-rolls-v1', JSON.stringify({ die: 'd6' }))
    expect(createAppStore(storage).getState().history.entries).toEqual([])
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
    const list = createAppStore(storage).getState().history.entries
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ die: 'd6', value: 4, at: 1000 })
  })

  it('запись — только поля истории: лишнего в JSON нет', () => {
    const storage = memStorage()
    const store = createAppStore(storage)
    store.dispatch(historyActions.add(result({ label: '2d20kh1' })))
    store.dispatch(historyActions.add(result({ at: 2000 })))
    const raw = storage.getItem('dice-rolls-v1') as string
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
    expect(Object.keys(parsed[0]).sort()).toEqual(['at', 'die', 'display', 'value'])
    expect(Object.keys(parsed[1]).sort()).toEqual(['at', 'die', 'display', 'label', 'value'])
    expect(raw).not.toContain('undefined')
  })
})
