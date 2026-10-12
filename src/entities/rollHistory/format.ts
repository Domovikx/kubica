// Форматтеры частей пула и времени истории (без DOM): тип PoolPart живёт
// в этом же слайсе (history.ts). Переход из pages/HomePage/lib/format
// (разнесение 2026-10-12).
import { DIE_IDS } from '@/shared'
import type { DieId } from '@/shared'
import type { PoolPart } from './history'

/**
 * Текстовая разбивка пула (pure, без DOM): по строке на часть.
 * Удержанная — как есть, сброшенная — в скобках: `[7, 19]` → `['(7)', '19']`.
 * Визуальное приглушение — классами в виджетах; скринридеру — через aria.
 */
export const formatParts = (parts: readonly PoolPart[]): string[] =>
  parts.map((p) => (p.kept ? p.display : `(${p.display})`))

export const fmtTime = (at: number): string => {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
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
