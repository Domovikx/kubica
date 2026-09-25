// История бросков: персист в localStorage, подписка, лимит.
// Чистая логика + тонкий слой хранения — тестируется без DOM.
import type { DieId } from '@/entities/dice-geometry/geometry'

/** Минимальная форма результата броска (структурно совместима с RollResult из стора). */
export interface RollInput {
  die: DieId
  value: number
  display: string
  at: number
  label?: string
  parts?: PoolPart[]
}

/** Одна кость пула в разбивке (kept=false — сброшена через kh/kl/dh/dl). */
export interface PoolPart {
  die: string
  value: number
  display: string
  kept: boolean
}

/**
 * Текстовая разбивка пула (pure, без DOM): по строке на часть.
 * Удержанная — как есть, сброшенная — в скобках: `[7, 19]` → `['(7)', '19']`.
 * Визуальное приглушение — классами в виджетах; скринридеру — через aria.
 */
export const formatParts = (parts: readonly PoolPart[]): string[] =>
  parts.map((p) => (p.kept ? p.display : `(${p.display})`))

export interface HistoryEntry {
  die: DieId
  value: number
  display: string
  at: number
  /** Формула пула (только для бросков пула). */
  label?: string
  /** Разбивка пула (только для бросков пула; старые записи читаются без неё). */
  parts?: PoolPart[]
}

export type HistoryListener = (entries: readonly HistoryEntry[]) => void

const STORAGE_KEY = 'dice-rolls-v1'
const MAX_ENTRIES = 50

const load = (storage: Pick<Storage, 'getItem'>): HistoryEntry[] => {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is HistoryEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as HistoryEntry).die === 'string' &&
        typeof (e as HistoryEntry).value === 'number' &&
        typeof (e as HistoryEntry).at === 'number',
    )
  } catch {
    return []
  }
}

export const createHistoryStore = (
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
) => {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)
  let entries: HistoryEntry[] = store ? load(store) : []
  const listeners = new Set<HistoryListener>()

  const emit = () => {
    const snapshot = [...entries]
    for (const listener of listeners) listener(snapshot)
  }

  const persist = () => {
    try {
      store?.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      // Приватный режим / переполнение — история живёт только в памяти
    }
  }

  return {
    subscribe(listener: HistoryListener): () => void {
      listeners.add(listener)
      listener([...entries])
      return () => {
        listeners.delete(listener)
      }
    },
    list(): readonly HistoryEntry[] {
      return [...entries]
    },
    add(result: RollInput): HistoryEntry {
      const entry: HistoryEntry = {
        die: result.die,
        value: result.value,
        display: result.display,
        at: result.at,
      }
      if (result.label !== undefined) entry.label = result.label
      if (result.parts !== undefined) entry.parts = result.parts.map((p) => ({ ...p }))
      entries = [entry, ...entries].slice(0, MAX_ENTRIES)
      persist()
      emit()
      return entry
    },
    clear(): void {
      entries = []
      try {
        store?.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
      emit()
    },
  }
}

export type HistoryStore = ReturnType<typeof createHistoryStore>

// Синглтон для приложения (общий между панелями и виджетом истории)
let shared: HistoryStore | null = null

export const getHistoryStore = (): HistoryStore => {
  if (!shared) shared = createHistoryStore()
  return shared
}
