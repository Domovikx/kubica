// Утилиты пресетов шторки: отображаемые наборы (встроенные с тенями своих
// переопределений + свои), сравнение counts. Только для папки Sheet.
import { DIE_IDS } from '@/shared/dice/geometry'
import type { DieId } from '@/shared/dice/dieId.utils'
import {
  BUILT_IN_PRESETS,
  loadCustomPresets,
  loadHiddenBuiltIns,
} from '@/features/tableSetup/presets'
import type { TableCounts } from '@/features/tableSetup/tableSetup'

export const BUILT_IN_NAMES = new Set(BUILT_IN_PRESETS.map((p) => p.name))

export const sameCounts = (a: TableCounts, b: TableCounts): boolean =>
  DIE_IDS.every((die: DieId) => (a[die] ?? 0) === (b[die] ?? 0))

/** Отображаемые наборы: встроенные (с учётом своих переопределений) + свои. */
export const displaySets = (): {
  fast: Array<{ name: string; counts: TableCounts }>
  mine: Array<{ name: string; counts: TableCounts }>
} => {
  const customs = loadCustomPresets()
  const hidden = new Set(loadHiddenBuiltIns())
  const shadow = new Map(
    customs.filter((p) => BUILT_IN_NAMES.has(p.name)).map((p) => [p.name, p.counts]),
  )
  const fast = BUILT_IN_PRESETS.filter((p) => !hidden.has(p.name)).map((p) => ({
    name: p.name,
    counts: shadow.get(p.name) ?? p.counts,
  }))
  const mine = customs
    .filter((p) => !BUILT_IN_NAMES.has(p.name))
    .map((p) => ({ name: p.name, counts: p.counts }))
  return { fast, mine }
}
