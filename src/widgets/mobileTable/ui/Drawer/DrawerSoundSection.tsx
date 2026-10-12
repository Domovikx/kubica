// Секция «Звук и вибрация» в бургере: тумблеры persist+стор, кнопка входа
// в карточку музыки (onOpenMusic — родитель открывает MusicCard).
import * as stylex from '@stylexjs/stylex'
import { useAppSelector } from '@/app'
import { musicIcon, soundIcon, vibrationIcon } from '@/shared'
import { selectMusicEntry, selectSound } from '../../model/selectors'
import { overlayStyles } from '../overlay.stylex'
import { useHapticsToggle, useMuteToggle } from '../useSoundToggle'
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
        dangerouslySetInnerHTML={{
          __html: `${soundIcon(muted)}<span>${muted ? 'Включить звук' : 'Выключить звук'}</span>`,
        }}
        onClick={toggleMute}
      />
      <button
        type="button"
        {...sxWideGap}
        className={`mtableWide ${sxWideGap.className ?? ''}`}
        data-testid="mtable-haptic-toggle"
        dangerouslySetInnerHTML={{
          __html: `${vibrationIcon()}<span>${
            haptics ? 'Выключить вибрацию' : 'Включить вибрацию'
          }</span>`,
        }}
        onClick={toggleHaptics}
      />
      <button
        type="button"
        {...sxWideGap}
        className={`mtableWide${music.on ? ' on' : ''} ${sxWideGap.className ?? ''}`}
        data-testid="mtable-drawer-music"
        aria-haspopup="dialog"
        aria-disabled={music.unavail ? 'true' : undefined}
        aria-label={
          music.unavail ? 'Фоновая музыка недоступна: нет доступа к YouTube' : 'Фоновая музыка'
        }
        dangerouslySetInnerHTML={{
          __html: `${musicIcon(music.on)}<span>Фоновая музыка</span>`,
        }}
        onClick={onOpenMusic}
      />
    </div>
  )
}
