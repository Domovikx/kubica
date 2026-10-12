// Шапка оверлея (шит/дроуэр/карточка музыки): заголовок + крестик-морф
// (dirty → check, «Готово»). Доп. ведущая кнопка слева (например, «Убрать
// все» в шторке) — через leading. Один подкомпонент вместо трёх копий.
import * as stylex from '@stylexjs/stylex'
import { checkIcon, closeIcon } from '@/shared'
import { iconStyles } from './mt.stylex'
import { overlayStyles } from './overlay.stylex'

export interface OverlayHeadProps {
  title: React.ReactNode
  dirty: boolean
  /** aria/title крестика в покое; в dirty — всегда «Готово». */
  closeLabel: string
  onClose: () => void
  closeRef: React.RefObject<HTMLButtonElement | null>
  headTestId: string
  closeTestId: string
  titleTestId?: string
  leading?: React.ReactNode
}

export const OverlayHead = (props: OverlayHeadProps): React.JSX.Element => {
  const { title, dirty, closeLabel, onClose, closeRef, headTestId, closeTestId } = props

  const sxClose = stylex.props(iconStyles.btn, iconStyles.body, iconStyles.hover)
  const sxHead = stylex.props(overlayStyles.head)
  const sxTitle = stylex.props(overlayStyles.headTitle)

  return (
    <div
      {...sxHead}
      className={`mtableSheetHead ${sxHead.className ?? ''}`}
      data-testid={headTestId}
    >
      <span {...sxTitle} className={sxTitle.className ?? undefined} data-testid={props.titleTestId}>
        {title}
      </span>
      {props.leading}
      <button
        ref={closeRef}
        type="button"
        {...sxClose}
        className={`mtableIcon${dirty ? ' mtableMorph' : ''} ${sxClose.className ?? ''}`}
        data-testid={closeTestId}
        aria-label={dirty ? 'Готово' : closeLabel}
        title={dirty ? 'Готово' : closeLabel}
        dangerouslySetInnerHTML={{ __html: dirty ? checkIcon() : closeIcon() }}
        onClick={onClose}
      />
    </div>
  )
}
