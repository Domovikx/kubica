// Пресеты стола: встроенные быстрые наборы + свои наборы пользователя.
// Чистая логика (без DOM) — тестируется Vitest. Персист — localStorage.
import type { DieId } from '@/entities/dice-geometry/geometry'
import { parseNotation } from '@/entities/dice-notation/notation'
import { emptyCounts, MAX_PER_DIE, MAX_TOTAL, type TableCounts } from './table-setup'

export interface TablePreset {
  name: string
  counts: TableCounts
  /** Нотация для тултипа (парсер понимает только латиницу). */
  formula: string
}

const countsOf = (patch: Partial<TableCounts>): TableCounts => ({
  ...emptyCounts(),
  ...patch,
})

/**
 * Встроенные: 1 тап = готовый стол (kh/kl пока как N костей, подсветка — 2.8).
 * Имена — русские (фидбек: никакого Fireball/Adv в RU-интерфейсе).
 */
export const BUILT_IN_PRESETS: readonly TablePreset[] = [
  { name: 'Преимущество 2d20', counts: countsOf({ d20: 2 }), formula: '2d20kh1' },
  { name: 'Характеристики 4d6', counts: countsOf({ d6: 4 }), formula: '4d6-L' },
  { name: 'Огненный шар 8d6', counts: countsOf({ d6: 8 }), formula: '8d6' },
  { name: 'Атака d20 d6', counts: countsOf({ d20: 1, d6: 1 }), formula: 'd20+d6' },
  { name: 'Пара d4 d6', counts: countsOf({ d4: 1, d6: 1 }), formula: 'd4+d6' },
  { name: 'd100', counts: countsOf({ d10: 2 }), formula: 'd100' },
]

const CUSTOM_KEY = 'kubica-presets-v1'
const HIDDEN_KEY = 'kubica-presets-hidden-v1'
const MAX_CUSTOM = 12

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const memFallback = (): StorageLike | undefined =>
  typeof localStorage !== 'undefined' ? localStorage : undefined

const clampCounts = (counts: TableCounts): TableCounts => {
  const out = emptyCounts()
  let total = 0
  const order: DieId[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20']
  for (const die of order) {
    const want = Math.max(0, Math.min(MAX_PER_DIE, Math.floor(counts[die] ?? 0)))
    const room = Math.max(0, MAX_TOTAL - total)
    out[die] = Math.min(want, room)
    total += out[die]
  }
  return out
}

/** Формула → счётчики стола (d100 = пара d10; kh/kl/модификаторы игнорируются — стол бросает горсть). */
export const formulaToCounts = (formula: string): TableCounts | null => {
  let expr
  try {
    expr = parseNotation(formula)
  } catch {
    return null
  }
  const out = emptyCounts()
  for (const st of expr.terms) {
    if (st.term.kind !== 'dice') continue
    const { count, sides } = st.term
    if (sides === 100) {
      out.d10 += count * 2
    } else {
      const die = `d${sides}` as DieId
      out[die] += count
    }
  }
  if (Object.values(out).every((v) => v === 0)) return null
  return clampCounts(out)
}

export const loadCustomPresets = (storage?: StorageLike): TablePreset[] => {
  const store = storage ?? memFallback()
  try {
    const raw = store?.getItem(CUSTOM_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<{ name?: unknown; counts?: unknown }>
    if (!Array.isArray(parsed)) return []
    const out: TablePreset[] = []
    for (const p of parsed.slice(0, MAX_CUSTOM)) {
      if (typeof p?.name !== 'string' || !p.name.trim()) continue
      const counts = { ...emptyCounts(), ...((p.counts as Partial<TableCounts>) ?? {}) }
      out.push({ name: p.name.trim().slice(0, 24), counts: clampCounts(counts), formula: '' })
    }
    return out
  } catch {
    return []
  }
}

export const saveCustomPreset = (
  name: string,
  counts: TableCounts,
  storage?: StorageLike,
): TablePreset[] => {
  const store = storage ?? memFallback()
  const clean = name.trim().slice(0, 24)
  if (!clean) return loadCustomPresets(store)
  const list = loadCustomPresets(store).filter((p) => p.name !== clean)
  list.unshift({ name: clean, counts: clampCounts(counts), formula: '' })
  const trimmed = list.slice(0, MAX_CUSTOM)
  try {
    store?.setItem(CUSTOM_KEY, JSON.stringify(trimmed))
  } catch {
    // Приватный режим — живём в памяти
  }
  return trimmed
}

export const deleteCustomPreset = (name: string, storage?: StorageLike): TablePreset[] => {
  const store = storage ?? memFallback()
  const list = loadCustomPresets(store).filter((p) => p.name !== name)
  try {
    store?.setItem(CUSTOM_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
  return list
}

/** Встроенные, которые пользователь удалил удержанием (переживают reload). */
export const loadHiddenBuiltIns = (storage?: StorageLike): string[] => {
  const store = storage ?? memFallback()
  try {
    const raw = store?.getItem(HIDDEN_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((n): n is string => typeof n === 'string' && !!n.trim())
      .map((n) => n.trim().slice(0, 24))
      .slice(0, 24)
  } catch {
    return []
  }
}

export const hideBuiltIn = (name: string, storage?: StorageLike): string[] => {
  const store = storage ?? memFallback()
  const list = loadHiddenBuiltIns(store)
  const clean = name.trim().slice(0, 24)
  if (!clean || list.includes(clean)) return list
  const next = [...list, clean]
  try {
    store?.setItem(HIDDEN_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}

/** Свободное имя для нового сета: «Сет 1», «Сет 2», … (первое не занятое). */
export const uniquePresetName = (existing: readonly { name: string }[]): string => {
  const names = new Set(existing.map((p) => p.name))
  let i = 1
  while (names.has(`Сет ${i}`)) i += 1
  return `Сет ${i}`
}
