// Форматирование набора и времени для шапки, шторки и истории (без DOM).
import { DIE_IDS, type DieId } from '@/entities/dice-geometry/geometry'
import type { PoolPart } from '@/entities/roll-history/history'
import type { TableCounts } from '@/features/table-setup/table-setup'

export const fmtTime = (at: number): string => {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Краткая сводка набора для кнопки («d4×1+d6×2», пусто — «пусто»). */
export const summarize = (counts: TableCounts): string => {
  const parts: string[] = []
  for (const die of DIE_IDS) {
    const n = counts[die] ?? 0
    if (n > 0) parts.push(`${die}×${n}`)
  }
  return parts.length > 0 ? parts.join('+') : 'пусто'
}

/** Короткая запись набора для шапки/заголовка шторки («2d4 d12»). */
export const shortSet = (counts: TableCounts): string => {
  const parts: string[] = []
  for (const die of DIE_IDS) {
    const n = counts[die] ?? 0
    if (n > 0) parts.push(n > 1 ? `${n}${die}` : die)
  }
  return parts.join(' ')
}

/** Экстремумы грани для подсветки: 1/0 — провал, верх — золото. */
const MAX_FACE: Record<DieId, number> = { d4: 4, d6: 6, d8: 8, d10: 9, d12: 12, d20: 20 }

/** Класс части разбивки: провал/максимум (отсчёт 1-в-1 из mobile-table.ts). */
export const partClass = (p: PoolPart): string => {
  if (!(DIE_IDS as readonly string[]).includes(p.die)) return ''
  const die = p.die as DieId
  if (p.value === 1 || (die === 'd10' && p.value === 0)) return 'partMin'
  if (p.value === MAX_FACE[die]) return 'partMax'
  return ''
}
