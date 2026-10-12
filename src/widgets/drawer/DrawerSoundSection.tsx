// Секция «Звук и вибрация» в бургере: тумблеры persist+стор, кнопка входа
// в карточку музыки (onOpenMusic — родитель открывает MusicCard).
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

  const sxSection = stylex.props(overlayStyles.section)
  const sxSectionTitle = stylex.props(s.sectionTitle)
  const sxWide = stylex.props(overlayStyles.wide)
  const sxWideGap = stylex.props(overlayStyles.wide, s.wideGap)
  const sxMusic = stylex.props(
    overlayStyles.wide,
    s.wideGap,
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
        {...sxWide}
        className={`mtableWide ${sxWide.className ?? ''}`}
        data-testid="mtable-sound-toggle"
        onClick={toggleMute}
      >
        {soundIcon(muted, sxWideSvg.className)}
        <span>{muted ? 'Включить звук' : 'Выключить звук'}</span>
      </button>
      <button
        type="button"
        {...sxWideGap}
        className={`mtableWide ${sxWideGap.className ?? ''}`}
        data-testid="mtable-haptic-toggle"
        onClick={toggleHaptics}
      >
        {vibrationIcon(sxWideSvg.className)}
        <span>{haptics ? 'Выключить вибрацию' : 'Включить вибрацию'}</span>
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
        <span>Фоновая музыка</span>
      </button>
    </div>
  )
}
