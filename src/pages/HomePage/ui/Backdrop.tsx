// Подложка под оверлеями: тап — закрыть (как backdrop в легаси).
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch } from '@/app'
import { mtUiActions } from '@/features'

/** Вход подложки: кадры (бывший глобальный @keyframes mtableFade). */
const fade = stylex.keyframes({
  from: { opacity: 0 },
})

export interface BackdropProps {
  visible: boolean
}

const styles = stylex.create({
  backdrop: {
    position: 'absolute',
    inset: 0,
    // 20 — выше хинта (5), ниже оверлеев (21): меню/шторка кликабельны
    // поверх подложки.
    zIndex: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  // Вход только видимой подложки (раньше .mtableBackdrop:not([hidden])).
  fade: {
    animationName: fade,
    animationDuration: '0.16s',
    animationTimingFunction: 'ease-out',
  },
})

export const Backdrop = ({ visible }: BackdropProps): React.JSX.Element => {
  const dispatch = useAppDispatch()
  const sx = stylex.props(styles.backdrop, visible && styles.fade)
  return (
    <div
      {...sx}
      className={`mtableBackdrop ${sx.className ?? ''}`}
      data-testid="mtable-backdrop"
      hidden={!visible}
      onClick={() => dispatch(mtUiActions.closeOverlays())}
    />
  )
}
