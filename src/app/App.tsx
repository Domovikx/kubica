import { HomePage } from '@/pages/home/home'

/**
 * React-оболочка приложения (новый стек, этап 1): рендерит страницу-стол.
 * Legacy-виджет mobile-table монтируется внутрь HomePage (см. pages/home) —
 * шапка/шит/канва остаются vanilla, React постепенно их вытесняет (strangler).
 * Сюда же позже встанут React-шапка, роутинг и прочие общие слоты.
 */
export const App = () => <HomePage />
