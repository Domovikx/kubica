// Карточка фоновой музыки (3-й оверлей): тоггл play/pause, громкость,
// хост iframe (императивно монтирует YT, React-детей нет), хинт.
// Разметка/логика 1-в-1 из mobile-table.ts (блок musicCard); состояние —
// music-slice (зеркало движка music.ts).
import { useEffect, useRef } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { musicToggle, setMusicVolume } from '@/features/dnd-music/music'
import { musicUiActions } from '@/features/dnd-music/music-slice'
import { checkIcon, closeIcon, musicIcon } from '@/shared/ui/md-icon'
import { mtUiActions } from '../mt-ui-slice'
import { selectMusic, selectMusicEntry, selectMtUi } from '../selectors'
import { iconStyles } from '../mt-styles'
import { overlayStyles } from './overlay-styles'

export interface MusicCardProps {
  open: boolean
  onClose: () => void
}

const styles = stylex.create({
  card: {
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
    // Узкие экраны (≤600): карточка шире — поля 12px (тот же блок на троих).
    '@media (max-width: 600px)': {
      width: 'calc(100% - 24px)',
      maxHeight: 'calc(100% - 32px)',
    },
  },
  volRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minHeight: 'var(--tap)',
    marginTop: 4,
  },
  vol: {
    flex: 1,
    minWidth: 0,
    height: 'var(--tap)',
    margin: 0,
    // accent-color — акцент трека/башмака.
    accentColor: '#ef3124',
    cursor: 'pointer',
    ':focus-visible': {
      outline: '2px solid #fff',
      outlineOffset: 2,
    },
  },
  volVal: {
    minWidth: '3ch',
    textAlign: 'right',
    fontSize: 'var(--fs-meta)',
    fontWeight: 700,
    color: '#9aa0aa',
  },
})

export const MusicCard = ({ open, onClose }: MusicCardProps): React.JSX.Element => {
  const dispatch = useAppDispatch()
  const music = useAppSelector(selectMusic)
  const entry = useAppSelector(selectMusicEntry)
  const { dirtyMusic } = useAppSelector(selectMtUi)
  const closeRef = useRef<HTMLButtonElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  const onPanelClick = (e: React.MouseEvent): void => {
    const t = e.target
    if (!(t instanceof Element)) return
    if (t.closest('a') || t.closest('button') === closeRef.current) return
    if (t.closest('button') || t.closest('input'))
      dispatch(mtUiActions.setDirty({ kind: 'music', dirty: true }))
  }
  const onPanelInput = (): void => {
    dispatch(mtUiActions.setDirty({ kind: 'music', dirty: true }))
  }

  const s = music.state
  const on = entry.on
  const text = entry.unavail
    ? 'Нет доступа к YouTube'
    : s === 'loading'
      ? 'Загружаю…'
      : s === 'paused'
        ? 'Продолжить фон'
        : on
          ? 'Выключить фон'
          : 'Включить фон'

  const sxClose = stylex.props(iconStyles.btn, iconStyles.body, iconStyles.hover)

  const sxCard = stylex.props(styles.card)
  const sxHead = stylex.props(overlayStyles.head)
  const sxTitle = stylex.props(overlayStyles.headTitle)
  const sxRows = stylex.props(overlayStyles.rows)
  const sxSection = stylex.props(overlayStyles.section, overlayStyles.sectionNoBorder)
  const sxWide = stylex.props(overlayStyles.wide)
  const sxVolRow = stylex.props(styles.volRow)
  const sxVol = stylex.props(styles.vol)
  const sxVolVal = stylex.props(styles.volVal)
  const sxSectionHint = stylex.props(overlayStyles.sectionHint)

  return (
    <div
      {...sxCard}
      className={`mtableMusicCard ${sxCard.className ?? ''}`}
      data-testid="mtable-music-card"
      hidden={!open}
      role="dialog"
      aria-label="Фоновая музыка"
      onClick={onPanelClick}
      onInput={onPanelInput}
    >
      <div
        {...sxHead}
        className={`mtableSheetHead ${sxHead.className ?? ''}`}
        data-testid="mtable-music-card-head"
      >
        <span
          {...sxTitle}
          className={sxTitle.className ?? undefined}
          data-testid="mtable-music-card-title"
        >
          Фоновая музыка
        </span>
        <button
          ref={closeRef}
          type="button"
          {...sxClose}
          className={`mtableIcon${dirtyMusic ? ' mtableMorph' : ''} ${sxClose.className ?? ''}`}
          data-testid="mtable-music-close"
          aria-label={dirtyMusic ? 'Готово' : 'Закрыть фоновую музыку'}
          title={dirtyMusic ? 'Готово' : 'Закрыть фоновую музыку'}
          dangerouslySetInnerHTML={{ __html: dirtyMusic ? checkIcon() : closeIcon() }}
          onClick={onClose}
        />
      </div>
      <div
        {...sxRows}
        className={`mtableRows ${sxRows.className ?? ''}`}
        data-testid="mtable-music-card-body"
      >
        <div
          {...sxSection}
          className={`mtableSection ${sxSection.className ?? ''}`}
          data-testid="mtable-music-section"
        >
          <button
            type="button"
            {...sxWide}
            className={`mtableWide${on ? ' on' : ''} ${sxWide.className ?? ''}`}
            data-testid="mtable-music-toggle"
            aria-pressed={on}
            aria-busy={!entry.unavail && s === 'loading' ? 'true' : undefined}
            aria-disabled={entry.unavail ? 'true' : undefined}
            dangerouslySetInnerHTML={{
              __html: `${musicIcon(on)}<span>${text}</span>`,
            }}
            onClick={() => {
              if (hostRef.current) musicToggle(hostRef.current)
            }}
          />
          <div
            {...sxVolRow}
            className={`mtableMusicVolRow ${sxVolRow.className ?? ''}`}
            data-testid="mtable-music-vol-row"
          >
            <input
              {...sxVol}
              className={`mtableMusicVol ${sxVol.className ?? ''}`}
              data-testid="mtable-music-volume"
              type="range"
              min={0}
              max={100}
              step={5}
              value={music.volume}
              aria-label="Громкость фона"
              onChange={(e) => {
                const v = Number(e.target.value)
                setMusicVolume(v)
                dispatch(musicUiActions.setVolume(v))
              }}
            />
            <span
              {...sxVolVal}
              className={`mtableMusicVolVal ${sxVolVal.className ?? ''}`}
              data-testid="mtable-music-vol-val"
            >
              {music.volume}
            </span>
          </div>
          {/* Хост iframe: React-детей нет, YT вставляет его императивно;
              CSS :empty → display:none при закрытой карточке. */}
          <div ref={hostRef} className="mtableMusicHost" data-testid="mtable-music-player" />
          <p
            {...sxSectionHint}
            className={`mtableSectionHint ${sxSectionHint.className ?? ''}`}
            data-testid="mtable-music-hint"
          >
            {entry.unavail
              ? 'Нет доступа к YouTube — фон недоступен'
              : 'Играет с YouTube: нужна сеть, реклама возможна'}
          </p>
        </div>
      </div>
    </div>
  )
}
