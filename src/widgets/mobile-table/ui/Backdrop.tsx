// Подложка под оверлеями: тап — закрыть (как backdrop в легаси).
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch } from '@/app/hooks'
import { mtUiActions } from '../mt-ui-slice'

export interface BackdropProps {
  visible: boolean
}

const styles = stylex.create({
  backdrop: {
    position: 'absolute',
    inset: 0,
    // Выше глобального .result-попа (z-index 10), иначе поп висит над меню.
    zIndex: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
})

export const Backdrop = ({ visible }: BackdropProps): React.JSX.Element => {
  const dispatch = useAppDispatch()
  const sx = stylex.props(styles.backdrop)
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
