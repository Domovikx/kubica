// Типизированные хуки react-redux (RTK-канон). Импорт разрешён из
// widgets/features/pages точечной лицензией в .dependency-cruiser.mjs
// (store/hooks — инфраструктура, не верхнеуровневая зависимость).
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './store'

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
