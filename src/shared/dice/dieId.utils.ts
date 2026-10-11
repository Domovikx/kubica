// Идентификатор кости — общий тип всех слоёв.
// Жил в entities/dice-geometry, но shared/ui/die-glyph ему нужен, а shared
// не импортирует entities (правило слоёв, ARCHITECTURE.md). Источник истины
// здесь; entities/dice-geometry реэкспортирует для существующих потребителей.
export type DieId = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20'
