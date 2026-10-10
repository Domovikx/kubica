// Хинт-empty-state: композиция на свободном центре (пусто → шит) / статус
// (грузится disabled, ошибка загрузки). Разметка 1-в-1 из mobile-table.ts;
// состояния — из chrome.refresh. Всегда в DOM, скрытие — hidden.
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { addIcon } from '@/shared/ui/md-icon'
import { dieGlyph } from '@/shared/ui/die-glyph'
import { selectMtUi, selectPhase, selectTotal } from '../selectors'
import { mtUiActions } from '../mt-ui-slice'

const styles = stylex.create({
  hint: {
    position: 'absolute',
    top: '44%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 5,
    width: 'min(calc(320px * var(--ui-scale)), calc(100% - 32px))',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: 0,
    padding: 16,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#2a2e36',
    borderRadius: 14,
    backgroundColor: 'rgba(18, 20, 25, 0.94)',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
    color: '#f0f2f5',
    fontFamily: 'inherit',
    textAlign: 'center',
    cursor: 'pointer',
  },
  hintDisabled: {
    cursor: 'default',
    opacity: 0.7,
  },
  glyph: {
    display: 'flex',
    gap: 10,
    color: '#c9cdd4',
  },
  title: {
    marginTop: 12,
    fontSize: 'var(--fs-headline)',
    fontWeight: 700,
    lineHeight: 1.3,
  },
  sub: {
    marginTop: 4,
    maxWidth: '100%',
    fontSize: 'var(--fs-sec)',
    fontWeight: 600,
    lineHeight: 1.4,
    color: '#9aa0aa',
  },
  cta: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 'var(--tap)',
    minHeight: 'var(--tap)',
    marginTop: 14,
    padding: 0,
    borderWidth: 'medium',
    borderStyle: 'none',
    borderColor: 'currentColor',
    borderRadius: 999,
    backgroundColor: 'transparent',
    color: '#f0f2f5',
  },
  info: {
    maxWidth: '100%',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
    fontSize: 'var(--fs-cap)',
    fontWeight: 600,
    lineHeight: 1.45,
    // Приглушение — только цветом: opacity 0.75 резал контраст до 4.45 (< AA).
    color: '#9aa0aa',
  },
})

export const Hint = (): React.JSX.Element => {
  const dispatch = useAppDispatch()
  const total = useAppSelector(selectTotal)
  const phase = useAppSelector(selectPhase)
  const { loadError, loaded, instances } = useAppSelector(selectMtUi)

  const status = loadError !== '' || phase === 'loading'
  const hidden = !loadError && total !== 0 && phase !== 'loading'
  const subHidden = status || total !== 0
  const title = loadError
    ? `Не загрузилась: ${loadError}`
    : total === 0
      ? 'Добавь кости на стол'
      : `Гружу… ${loaded}/${instances}`

  const sxHint = stylex.props(styles.hint, phase === 'loading' && styles.hintDisabled)
  const sxGlyph = stylex.props(styles.glyph)
  const sxTitle = stylex.props(styles.title)
  const sxSub = stylex.props(styles.sub)
  const sxCta = stylex.props(styles.cta)
  const sxInfo = stylex.props(styles.info)

  return (
    <button
      type="button"
      {...sxHint}
      className={`mtableHint ${sxHint.className ?? ''}`}
      data-testid="mtable-hint"
      hidden={hidden}
      disabled={phase === 'loading'}
      onClick={() => dispatch(mtUiActions.openOverlay('sheet'))}
    >
      <span
        {...sxGlyph}
        className={`mtableHintGlyph ${sxGlyph.className ?? ''}`}
        data-testid="mtable-hint-glyph"
        aria-hidden="true"
        dangerouslySetInnerHTML={{
          __html: dieGlyph('d4') + dieGlyph('d6') + dieGlyph('d20'),
        }}
      />
      <span
        {...sxTitle}
        className={`mtableHintTitle ${sxTitle.className ?? ''}`}
        data-testid="mtable-hint-title"
      >
        {title}
      </span>
      <span
        {...sxSub}
        className={`mtableHintSub ${sxSub.className ?? ''}`}
        data-testid="mtable-hint-sub"
        hidden={subHidden}
      >
        Пресеты и любой состав — внутри
      </span>
      <span
        {...sxCta}
        className={`mtableHintCta ${sxCta.className ?? ''}`}
        data-testid="mtable-hint-cta"
        hidden={subHidden}
        dangerouslySetInnerHTML={{ __html: addIcon() }}
      />
      <span
        {...sxInfo}
        className={`mtableHintInfo ${sxInfo.className ?? ''}`}
        data-testid="mtable-hint-info"
        hidden={subHidden}
      >
        Kubica — стол для бросков костей
      </span>
    </button>
  )
}
