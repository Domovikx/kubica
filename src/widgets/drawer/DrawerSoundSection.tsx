// Секция «Звук и вибрация» в бургере: тумблеры persist+стор, кнопка входа
// в карточку музыки (onOpenMusic — родитель открывает MusicCard). На ≤360
// (минимум 260): без заголовка и текста — компактный ряд иконок-кнопок
// (по решению человека к задаче 260px).
import * as stylex from '@stylexjs/stylex'
import { useAppSelector } from '@/app'
import { musicIcon, soundIcon, vibrationIcon } from '@/shared'
import { selectMusicEntry, selectSound } from '@/features'
import { overlayStyles } from '@/shared'
import { useHapticsToggle, useMuteToggle } from '@/features'
import { drawerStyles as s } from './Drawer.stylex'

export const DrawerSoundSection = (props: { onOpenMusic: () => void }): React.JSX.Element => {
  const { onOpenMusic } = props
  const { muted, haptics } = useAppSelector(selectSound)
  const music = useAppSelector(selectMusicEntry)
  const toggleMute = useMuteToggle()
  const toggleHaptics = useHapticsToggle()

  const sxSection = stylex.props(overlayStyles.section, s.soundRow)
  const sxSectionTitle = stylex.props(s.sectionTitle, s.soundTitle)
  const sxLong = stylex.props(s.soundLong)
  const sxBtn = stylex.props(overlayStyles.wide, s.iconBtn)
  const sxWideGap = stylex.props(overlayStyles.wide, s.wideGap, s.iconBtn)
  const sxMusic = stylex.props(
    overlayStyles.wide,
    s.wideGap,
    s.iconBtn,
    music.unavail && overlayStyles.wideOff,
  )
  const sxWideSvg = stylex.props(overlayStyles.wideSvg)

  return (
    <div
      {...sxSection}
      className={`mtableSection ${sxSection.className ?? ''}`}
      data-testid="mtable-sound-section"
    >
      <span
        {...sxSectionTitle}
        className={`mtableSectionTitle ${sxSectionTitle.className ?? ''}`}
        data-testid="mtable-sound-title"
      >
        Звук и вибрация
      </span>
      <button
        type="button"
        {...sxBtn}
        className={`mtableWide ${sxBtn.className ?? ''}`}
        data-testid="mtable-sound-toggle"
        aria-label={muted ? 'Включить звук' : 'Выключить звук'}
        aria-pressed={!muted}
        onClick={toggleMute}
      >
        {soundIcon(muted, sxWideSvg.className)}
        <span {...sxLong} className={sxLong.className ?? undefined}>
          {muted ? 'Включить звук' : 'Выключить звук'}
        </span>
      </button>
      <button
        type="button"
        {...sxWideGap}
        className={`mtableWide ${sxWideGap.className ?? ''}`}
        data-testid="mtable-haptic-toggle"
        aria-label={haptics ? 'Выключить вибрацию' : 'Включить вибрацию'}
        aria-pressed={haptics}
        onClick={toggleHaptics}
      >
        {vibrationIcon(sxWideSvg.className)}
        <span {...sxLong} className={sxLong.className ?? undefined}>
          {haptics ? 'Выключить вибрацию' : 'Включить вибрацию'}
        </span>
      </button>
      <button
        type="button"
        {...sxMusic}
        className={`mtableWide${music.on ? ' on' : ''} ${sxMusic.className ?? ''}`}
        data-testid="mtable-drawer-music"
        aria-haspopup="dialog"
        aria-disabled={music.unavail ? 'true' : undefined}
        aria-label={
          music.unavail ? 'Фоновая музыка недоступна: нет доступа к YouTube' : 'Фоновая музыка'
        }
        onClick={onOpenMusic}
      >
        {musicIcon(music.on, sxWideSvg.className)}
        <span {...sxLong} className={sxLong.className ?? undefined}>
          Фоновая музыка
        </span>
      </button>
    </div>
  )
}
