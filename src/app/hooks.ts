// Типизированные хуки react-redux (RTK-канон). Снаружи — через публичный
// API app (src/app/index.ts: store + hooks); точечная лицензия на импорт
// app из widgets/features — в .dependency-cruiser.mjs (инфраструктура,
// не верхнеуровневая зависимость).
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from './store'

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export const useAppSelector = useSelector.withTypes<RootState>()
