// Карточка фоновой музыки (3-й оверлей): тоггл play/pause, громкость,
// хост iframe (императивно монтирует YT, React-детей нет), хинт.
// Разметка/логика 1-в-1 из mobile-table.ts (блок musicCard); состояние —
// music-slice (зеркало движка music.ts).
import { useEffect, useRef } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app'
import { musicToggle, setMusicVolume, musicUiActions } from '@/features'

import { musicIcon } from '@/shared'
import { selectMusic, selectMusicEntry, selectMtUi } from '@/features'
import { OverlayHead } from '@/shared'
import { useDirtyPanel } from '@/features'
import { overlayStyles } from '@/shared'

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
    // Поп оверлея: кадры mtablePop — глобальные в app/styles.css.
    animationName: 'mtablePop',
    animationDuration: '0.16s',
    animationTimingFunction: 'ease-out',
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
  const { onPanelClick, onPanelInput } = useDirtyPanel('music', closeRef)

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

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

  const sxCard = stylex.props(styles.card)
  const sxRows = stylex.props(overlayStyles.rows)
  const sxSection = stylex.props(overlayStyles.section, overlayStyles.sectionNoBorder)
  const sxWide = stylex.props(overlayStyles.wide, entry.unavail && overlayStyles.wideOff)
  const sxWideSvg = stylex.props(overlayStyles.wideSvg)
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
      <OverlayHead
        title="Фоновая музыка"
        dirty={dirtyMusic}
        closeLabel="Закрыть фоновую музыку"
        onClose={onClose}
        closeRef={closeRef}
        headTestId="mtable-music-card-head"
        closeTestId="mtable-music-close"
        titleTestId="mtable-music-card-title"
      />
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
            onClick={() => {
              if (hostRef.current) musicToggle(hostRef.current)
            }}
          >
            {musicIcon(on, sxWideSvg.className)}
            <span>{text}</span>
          </button>
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
