// Набор стола: сколько каких костей на поле (N инстансов, а не 0/1).
// Чистые функции и капы — тестируются без DOM; хранение — RTK-слайс setup-slice.
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
