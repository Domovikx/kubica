// История бросков: типы и чистые форматтеры (лейбл/разбивка).
// Хранение/подписка/лимит — RTK-слайс history-slice (персист glue — app/store).
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

/**
 * Лейбл для показа: плюс-разделитель костей → пробел («d4+d6» → «d4 d6»).
 * Плюс-модификатор («2d20kh1+5») сохраняем — он часть нотации, не шум.
 * Хранение и реролл живут с «+» (парсер его требует) — заменяем только при рендере.
 */
export const formatLabel = (label: string): string => label.replace(/\+(?=\d*d\d)/g, ' ')

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
