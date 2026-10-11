// Форматирование набора и времени для шапки, шторки и истории (без DOM).
import { DIE_IDS } from '@/shared/dice/geometry'
import type { DieId } from '@/shared/dice/dieId.utils'
import type { PoolPart } from '@/entities/rollHistory/history'

/**
 * Текстовая разбивка пула (pure, без DOM): по строке на часть.
 * Удержанная — как есть, сброшенная — в скобках: `[7, 19]` → `['(7)', '19']`.
 * Визуальное приглушение — классами в виджетах; скринридеру — через aria.
 */
export const formatParts = (parts: readonly PoolPart[]): string[] =>
  parts.map((p) => (p.kept ? p.display : `(${p.display})`))

/**
 * Лейбл для показа: плюс-разделитель костей → пробел («d4+d6» → «d4 d6»).
 * Плюс-модификатор («2d20kh1+5») сохраняем — он часть нотации, не шум.
 * Хранение и реролл живут с «+» (парсер его требует) — заменяем только при рендере.
 */
export const formatLabel = (label: string): string => label.replace(/\+(?=\d*d\d)/g, ' ')
import type { TableCounts } from '@/features/tableSetup/tableSetup'

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
