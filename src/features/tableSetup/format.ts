// Форматтеры счётчиков и пресетов (без DOM): тип TableCounts живёт в этом
// же слайсе. Переход из pages/HomePage/lib/format (разнесение 2026-10-12).
import { DIE_IDS } from '@/shared'
import type { TableCounts } from './tableSetup'

/**
 * Лейбл для показа: плюс-разделитель костей → пробел («d4+d6» → «d4 d6»).
 * Плюс-модификатор («2d20kh1+5») сохраняем — он часть нотации, не шум.
 * Хранение и реролл живут с «+» (парсер его требует) — заменяем только при рендере.
 */
export const formatLabel = (label: string): string => label.replace(/\+(?=\d*d\d)/g, ' ')

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
