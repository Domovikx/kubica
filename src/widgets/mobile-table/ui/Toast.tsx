// Тост одиночного сообщения у низа (мотор — use-toast в корне). Рендер
// всегда (toHaveText требует наличия элемента), скрытие — hidden.
import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  root: {
    position: 'absolute',
    bottom: 'calc(40px + env(safe-area-inset-bottom))',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 30,
    width: 'max-content',
    maxWidth: 'calc(100% - 32px)',
    paddingLeft: 18,
    paddingRight: 18,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(20,22,26,0.94)',
    fontSize: 'var(--fs-sec)',
    fontWeight: 700,
    whiteSpace: 'normal',
  },
})

export interface ToastProps {
  toast: string | null
}

export const Toast = ({ toast }: ToastProps): React.JSX.Element => {
  const sx = stylex.props(styles.root)
  return (
    <div
      {...sx}
      className={`mtableToast ${sx.className ?? ''}`}
      data-testid="mtable-toast"
      hidden={toast === null}
    >
      {toast ?? ''}
    </div>
  )
}
