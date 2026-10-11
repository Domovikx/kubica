// Стили шторки «+ Кости»: панель, блок пресетов, строки-степперы, CTA
// «Сохранить сет». Ховер/.on — глобальные правила в styles.css.
import * as stylex from '@stylexjs/stylex'

export const sheetStyles = stylex.create({
  sheet: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 21,
    width: 'min(calc(360px * var(--ui-scale)), calc(100% - 48px))',
    maxHeight: 'calc(100% - 48px)',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#121419',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#2a2e36',
    borderRadius: 14,
    overflow: 'hidden',
    paddingBottom: 'env(safe-area-inset-bottom)',
    // Узкие экраны (≤600): карточка шире — поля 12px (тот же блок на троих
    // в легаси; специфика stylex-медиа бьёт базу того же объекта).
    '@media (max-width: 600px)': {
      width: 'calc(100% - 24px)',
      maxHeight: 'calc(100% - 32px)',
    },
  },
  preBlock: {
    padding: '6px 14px 8px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#1d2026',
  },
  preCap: {
    display: 'block',
    padding: '6px 0 0',
    fontSize: 'var(--fs-cap)',
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#9aa0aa',
  },
  preHint: {
    margin: '8px 0 0',
    fontSize: 'var(--fs-meta)',
    lineHeight: 1.4,
    color: '#9aa0aa',
  },
  sets: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  empty: {
    color: '#9aa0aa',
    fontSize: 'var(--fs-sec)',
    lineHeight: 1.4,
    margin: '4px 0',
  },
  row: {
    display: 'flex',
    // wrap: при масштабе ≥150% степперы/глиф не влезают в строку 320.
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    padding: '8px 14px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#1d2026',
  },
  glyph: {
    display: 'flex',
    width: 'calc(var(--icon-row) + 8px)',
    justifyContent: 'center',
    color: '#c9cdd4',
    flexShrink: 0,
  },
  name: {
    fontWeight: 800,
    fontSize: 'var(--fs-title)',
    width: 'calc(40px * var(--ui-scale))',
  },
  desc: {
    fontSize: 'var(--fs-meta)',
    lineHeight: 1.35,
    color: '#9aa0aa',
    flex: 1,
  },
  step: {
    width: 'var(--tap)',
    height: 'var(--tap)',
    borderRadius: 12,
    borderWidth: 'medium',
    borderStyle: 'none',
    borderColor: 'currentColor',
    backgroundColor: '#22262e',
    color: '#f0f2f5',
    fontSize: 'var(--fs-headline)',
    fontFamily: 'inherit',
    cursor: 'pointer',
    flexShrink: 0,
    ':hover': {
      backgroundColor: '#2a2f38',
    },
    ':disabled': {
      opacity: 0.3,
      cursor: 'default',
    },
  },
  n: {
    fontWeight: 800,
    minWidth: 'calc(28px * var(--ui-scale))',
    textAlign: 'center',
    fontSize: 'var(--fs-headline)',
  },
  formulaRow: {
    display: 'flex',
    gap: 8,
    padding: '12px 14px 4px',
  },
  ok: {
    // Сохранение занимает всю строку (инпута имени больше нет) — flex:1
    // из descendant-правила .mtableFormulaRow .mtableOk (Ok всегда внутри).
    flex: 1,
    minHeight: 'var(--tap)',
    padding: '0 18px',
    borderWidth: 'medium',
    borderStyle: 'none',
    borderColor: 'currentColor',
    borderRadius: 12,
    // Фон CTA: #d92b1c вместо бренда — см. .mtableChip.on.
    backgroundColor: '#d92b1c',
    color: '#fff',
    fontFamily: 'inherit',
    fontSize: 'var(--fs-body)',
    fontWeight: 800,
    cursor: 'pointer',
    ':disabled': {
      opacity: 0.45,
    },
  },
})
