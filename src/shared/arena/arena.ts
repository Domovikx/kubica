// Единый конфиг арены-лотка: физика (features/roll-dice) и витрина (shared/three)
// ОБЯЗАНЫ пользоваться этими числами, иначе кости лежат мимо бортов.
// Апофема подбиралась глазом: кость ~35-40% ширины лотка (как настоящий D&D-лоток).
export const ARENA_APOTHEM = 26
/** Апофема фетра (напуск под раму). */
export const FELT_APOTHEM = 26.2
/** Толщина бруса рамы (внутренний край ровно ARENA_APOTHEM). */
export const FRAME_THICK = 4
/** Высота борта. */
export const FRAME_H = 4
/**
 * Стол: лотка нет — только условные прямоугольные
 * невидимые границы (половинные экстенты). Кость ~25% ширины стекла.
 * Дефолт — под 1–2 кости.
 */
export const GLASS_HALF_X = 30
export const GLASS_HALF_Z = 20

/**
 * Кадр камеры под пачку: крайний слот + место кости + небольшой запас.
 * Чем больше костей, тем шире кадр (иначе кости-микробы или за кадром).
 */
export const glassHalves = (maxSlotX: number, maxSlotZ: number): { hx: number; hz: number } => ({
  hx: Math.max(24, maxSlotX + 20),
  hz: Math.max(16, maxSlotZ + 16),
})
