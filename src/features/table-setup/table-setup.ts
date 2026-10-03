// Набор стола: сколько каких костей на поле (N инстансов, а не 0/1).
// Чистая логика + тонкий персист — тестируется без DOM.
import { DIE_IDS, type DieId } from '@/entities/dice-geometry/geometry'

/** Лимит инстансов одной кости (фаербол 8d6 влезает). */
export const MAX_PER_DIE = 8
/** Лимит костей на столе (физика пачки + кадр держат с запасом). */
export const MAX_TOTAL = 10

export type TableCounts = Record<DieId, number>

export const emptyCounts = (): TableCounts => ({
  d4: 0,
  d6: 0,
  d8: 0,
  d10: 0,
  d12: 0,
  d20: 0,
})

/** Развёртка в инстансы (стабильные ключи `d6#0…`): порядок — как в DIE_IDS. */
export const expandInstances = (counts: TableCounts): Array<{ die: DieId; key: string }> => {
  const out: Array<{ die: DieId; key: string }> = []
  for (const die of DIE_IDS) {
    const n = Math.max(0, Math.min(MAX_PER_DIE, Math.floor(counts[die] ?? 0)))
    for (let i = 0; i < n; i++) out.push({ die, key: `${die}#${i}` })
  }
  return out
}

export const totalCount = (counts: TableCounts): number =>
  DIE_IDS.reduce((sum, die) => sum + Math.max(0, Math.floor(counts[die] ?? 0)), 0)

export type SetupListener = (counts: TableCounts) => void

const STORAGE_KEY = 'kubica-table-v1'

const load = (storage: Pick<Storage, 'getItem'> | undefined): TableCounts => {
  const counts = emptyCounts()
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return counts
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>
    for (const die of DIE_IDS) {
      const v = parsed[die]
      if (typeof v === 'number' && Number.isFinite(v)) {
        counts[die] = Math.max(0, Math.min(MAX_PER_DIE, Math.floor(v)))
      }
    }
  } catch {
    // Битый стор — начинаем с пустого
  }
  return counts
}

export const createSetupStore = (
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  initial?: Partial<TableCounts>,
) => {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)
  const counts: TableCounts = load(store)
  if (initial) {
    for (const die of DIE_IDS) {
      if (initial[die] !== undefined) {
        counts[die] = Math.max(0, Math.min(MAX_PER_DIE, Math.floor(initial[die] as number)))
      }
    }
  }
  const listeners = new Set<SetupListener>()

  const snapshot = (): TableCounts => ({ ...counts })
  const emit = () => {
    const copy = snapshot()
    for (const listener of listeners) listener(copy)
  }
  const persist = () => {
    try {
      store?.setItem(STORAGE_KEY, JSON.stringify(counts))
    } catch {
      // Приватный режим — живём в памяти
    }
  }

  return {
    subscribe(listener: SetupListener): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    get(): TableCounts {
      return snapshot()
    },
    /** Поставить счётчик (с капами; 0 — убрать кость). */
    setCount(die: DieId, n: number): TableCounts {
      const want = Math.max(0, Math.min(MAX_PER_DIE, Math.floor(n)))
      const without = totalCount(counts) - counts[die]
      counts[die] = Math.min(want, Math.max(0, MAX_TOTAL - without))
      persist()
      emit()
      return snapshot()
    },
    add(die: DieId, delta = 1): TableCounts {
      return this.setCount(die, counts[die] + delta)
    },
    clear(): void {
      for (const die of DIE_IDS) counts[die] = 0
      persist()
      emit()
    },
  }
}

export type SetupStore = ReturnType<typeof createSetupStore>

// Синглтон приложения (виджет стола и home делят один набор).
let shared: SetupStore | null = null

export const getSetupStore = (initial?: Partial<TableCounts>): SetupStore => {
  if (!shared) shared = createSetupStore(undefined, initial)
  else if (initial) {
    for (const die of DIE_IDS) {
      if (initial[die] !== undefined) shared.setCount(die, initial[die] as number)
    }
  }
  return shared
}
