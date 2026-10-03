// Контурные SVG-глифы костей для меню (шторка «+ Кости», палитры).
// Чистая функция → строка SVG (stroke currentColor, 24×24).
import type { DieId } from '@/entities/dice-geometry/geometry'

const SHAPES: Record<DieId, string> = {
  d4: '<polygon points="12,4 20,19 4,19"/>',
  d6: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  d8: '<polygon points="12,3 19,12 12,21 5,12"/>',
  d10: '<polygon points="12,3 18,10 15,20 9,20 6,10"/>',
  d12: '<polygon points="12,4 19,9.5 16.5,18 7.5,18 5,9.5"/>',
  d20: '<polygon points="12,3.5 19,7.75 19,16.25 12,20.5 5,16.25 5,7.75"/>',
}

export const DIE_HINTS: Record<DieId, string> = {
  d4: 'пирамида',
  d6: 'куб · урон',
  d8: 'меч, топор',
  d10: 'процентная',
  d12: 'тяжёлый урон',
  d20: 'проверки, крит',
}

/** Инлайн-SVG глифа кости (наследует цвет текста через currentColor). */
export const dieGlyph = (die: DieId): string =>
  `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">${SHAPES[die]}</svg>`
