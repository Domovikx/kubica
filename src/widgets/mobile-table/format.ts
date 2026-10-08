// Форматирование набора и времени для шапки, шторки и истории (без DOM).
import { DIE_IDS } from '@/entities/dice-geometry/geometry'
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
