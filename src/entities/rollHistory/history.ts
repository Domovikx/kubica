// История бросков: типы и чистые форматтеры (лейбл/разбивка).
// Хранение/подписка/лимит — RTK-слайс history-slice (персист glue — app/store).
import type { DieId } from '@/shared'

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
