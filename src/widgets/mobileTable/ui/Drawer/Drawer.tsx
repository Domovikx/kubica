// Бургер-меню (дроуэр): история (реролл, двухтап-очистка), сила броска,
// звук/вибро/музыка, масштаб, о проекте, соцсети. Разметка/логика 1-в-1 из
// mobile-table.ts (блок дровера); состояние — RTK, движок — через props.
// Секции — подкомпоненты в этой же папке (волна декомпозиции ui/).
import { useEffect, useRef } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import type { HistoryEntry } from '@/entities/rollHistory/history'
import { checkIcon, closeIcon } from '@/shared/ui/mdIcon.utils'
import { mtUiActions } from '../../mtUiSlice'
import { selectMtUi } from '../../selectors'
import { iconStyles } from '../../mt.stylex'
import { overlayStyles } from '../overlay.stylex'
import { loadStars } from '../../hooks/useStars'
import { drawerStyles as s } from './Drawer.stylex'
import { DrawerHistorySection } from './DrawerHistorySection'
import { DrawerPowerSection } from './DrawerPowerSection'
import { DrawerSoundSection } from './DrawerSoundSection'
import { DrawerScaleSection } from './DrawerScaleSection'
import { DrawerAboutSection } from './DrawerAboutSection'
import { DrawerSocialSection } from './DrawerSocialSection'

export interface DrawerProps {
  open: boolean
  showToast: (msg: string) => void
  onClose: () => void
  onReroll: (entry: HistoryEntry) => void
  onOpenMusic: () => void
}

export const Drawer = (props: DrawerProps): React.JSX.Element => {
  const { open, showToast, onClose, onReroll, onOpenMusic } = props
  const dispatch = useAppDispatch()
  const { dirtyDrawer, clearArmed } = useAppSelector(selectMtUi)

  const closeRef = useRef<HTMLButtonElement>(null)

  // Счётчик звёзд тянем лениво — при первом открытии меню (как легаси).
  useEffect(() => {
    if (open) {
      loadStars()
      closeRef.current?.focus()
    }
  }, [open])

  // Двухтап «Очистить»: первый тап взводит, 3 с — сброс.
  useEffect(() => {
    if (!clearArmed) return
    const t = window.setTimeout(() => dispatch(mtUiActions.setClearArmed(false)), 3000)
    return () => window.clearTimeout(t)
  }, [clearArmed, dispatch])

  const onPanelClick = (e: React.MouseEvent): void => {
    const t = e.target
    if (!(t instanceof Element)) return
    if (t.closest('a') || t.closest('button') === closeRef.current) return
    if (t.closest('button') || t.closest('input'))
      dispatch(mtUiActions.setDirty({ kind: 'drawer', dirty: true }))
  }
  const onPanelInput = (): void => {
    dispatch(mtUiActions.setDirty({ kind: 'drawer', dirty: true }))
  }

  const sxClose = stylex.props(iconStyles.btn, iconStyles.body, iconStyles.hover)
  const sxDrawer = stylex.props(s.drawer)
  const sxHead = stylex.props(overlayStyles.head)
  const sxTitle = stylex.props(overlayStyles.headTitle)
  const sxBody = stylex.props(s.body)

  return (
    <div
      {...sxDrawer}
      className={`mtableDrawer ${sxDrawer.className ?? ''}`}
      data-testid="mtable-drawer"
      hidden={!open}
      onClick={onPanelClick}
      onInput={onPanelInput}
    >
      <div
        {...sxHead}
        className={`mtableSheetHead ${sxHead.className ?? ''}`}
        data-testid="mtable-drawer-head"
      >
        <span {...sxTitle} className={sxTitle.className ?? undefined}>
          Меню
        </span>
        <button
          ref={closeRef}
          type="button"
          {...sxClose}
          className={`mtableIcon${dirtyDrawer ? ' mtableMorph' : ''} ${sxClose.className ?? ''}`}
          data-testid="mtable-drawer-close"
          aria-label={dirtyDrawer ? 'Готово' : 'Закрыть меню'}
          title={dirtyDrawer ? 'Готово' : 'Закрыть меню'}
          dangerouslySetInnerHTML={{ __html: dirtyDrawer ? checkIcon() : closeIcon() }}
          onClick={onClose}
        />
      </div>
      <div
        {...sxBody}
        className={`mtableDrawerBody ${sxBody.className ?? ''}`}
        data-testid="mtable-drawer-body"
      >
        <DrawerHistorySection onReroll={onReroll} />
        <DrawerPowerSection />
        <DrawerSoundSection onOpenMusic={onOpenMusic} />
        <DrawerScaleSection showToast={showToast} />
        <DrawerAboutSection />
        <DrawerSocialSection />
      </div>
    </div>
  )
}
