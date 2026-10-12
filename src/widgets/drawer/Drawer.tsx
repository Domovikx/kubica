// Бургер-меню (дроуэр): история (реролл, двухтап-очистка), сила броска,
// звук/вибро/музыка, масштаб, о проекте, соцсети. Разметка/логика 1-в-1 из
// mobile-table.ts (блок дровера); состояние — RTK, движок — через props.
// Секции — подкомпоненты в этой же папке (волна декомпозиции ui/).
import { useEffect, useRef } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app'
import type { HistoryEntry } from '@/entities'
import { mtUiActions, loadStars } from '@/features'
import { selectMtUi } from '@/features'

import { OverlayHead } from '@/shared'
import { useDirtyPanel } from '@/features'
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
  const { onPanelClick, onPanelInput } = useDirtyPanel('drawer', closeRef)

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

  const sxDrawer = stylex.props(s.drawer)
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
      <OverlayHead
        title="Меню"
        dirty={dirtyDrawer}
        closeLabel="Закрыть меню"
        onClose={onClose}
        closeRef={closeRef}
        headTestId="mtable-drawer-head"
        closeTestId="mtable-drawer-close"
      />
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
