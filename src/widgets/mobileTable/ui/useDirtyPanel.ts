// Делегат «панель изменена» для оверлеев (шит/дроуэр/карточка музыки):
// тап по кнопке/инпуту (кроме ссылок и самого крестика) взводит dirty-морф.
// Один владелец правил вместо трёх копий в компонентах (волна 2 ревью).
import { useAppDispatch } from '@/app/hooks'
import { mtUiActions, type OverlayKind } from '@/features/tableUi/model/mtUiSlice'

export const useDirtyPanel = (
  kind: OverlayKind,
  closeRef: React.RefObject<HTMLButtonElement | null>,
): {
  onPanelClick: (e: React.MouseEvent) => void
  onPanelInput: () => void
} => {
  const dispatch = useAppDispatch()

  const onPanelClick = (e: React.MouseEvent): void => {
    const t = e.target
    if (!(t instanceof Element)) return
    if (t.closest('a') || t.closest('button') === closeRef.current) return
    if (t.closest('button') || t.closest('input'))
      dispatch(mtUiActions.setDirty({ kind, dirty: true }))
  }
  const onPanelInput = (): void => {
    dispatch(mtUiActions.setDirty({ kind, dirty: true }))
  }

  return { onPanelClick, onPanelInput }
}
