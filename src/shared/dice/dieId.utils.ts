// Идентификатор кости — общий тип всех слоёв. Жил в entities-геометрии, но
// shared/ui/die-glyph ему нужен, а shared не импортирует entities (правило
// слоёв, ARCHITECTURE.md). Источник истины здесь; таблицы геометрии — сосед
// shared/dice/geometry.ts.
export type DieId = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20'
