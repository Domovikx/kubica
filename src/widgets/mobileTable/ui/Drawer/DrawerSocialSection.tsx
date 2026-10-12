// Секция «Соцсети» в бургере: GitHub/Telegram/оценка репозитория; счётчик
// звёзд (ленивый fetch) показываем от 0, когда данные есть; сама ссылка — всегда.
import * as stylex from '@stylexjs/stylex'
import { githubIcon, likeIcon, telegramIcon } from '@/shared'
import { starReviewLabel, useStarCount } from '@/features'
import { overlayStyles } from '../overlay.stylex'
import { drawerStyles as s } from './Drawer.stylex'

export const DrawerSocialSection = (): React.JSX.Element => {
  const starCount = useStarCount()
  const starMenuLabel = starReviewLabel(starCount)

  const sxSection = stylex.props(overlayStyles.section)
  const sxSectionTitle = stylex.props(s.sectionTitle)
  const sxSocial = stylex.props(s.social)
  const sxSocialGap = stylex.props(s.social, s.socialGap)

  return (
    <div
      {...sxSection}
      className={`mtableSection ${sxSection.className ?? ''}`}
      data-testid="mtable-social-section"
    >
      <span
        {...sxSectionTitle}
        className={`mtableSectionTitle ${sxSectionTitle.className ?? ''}`}
        data-testid="mtable-social-title"
      >
        Соцсети
      </span>
      {/* Иконка — прямой ребёнок <a> (svg), как legacy innerHTML. */}
      <a
        {...sxSocial}
        className={`mtableSocial ${sxSocial.className ?? ''}`}
        data-testid="mtable-social"
        href="https://github.com/DomovikX"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Профиль GitHub DomovikX (откроется в новой вкладке)"
        dangerouslySetInnerHTML={{
          __html: `${githubIcon()}<span class="mtableSocialName">GitHub</span><span class="mtableSocialMeta">@DomovikX</span>`,
        }}
      />
      <a
        {...sxSocialGap}
        className={`mtableSocial ${sxSocialGap.className ?? ''}`}
        data-testid="mtable-social"
        href="https://t.me/Domovikx"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Канал Domovikx в Telegram (откроется в новой вкладке)"
        dangerouslySetInnerHTML={{
          __html: `${telegramIcon()}<span class="mtableSocialName">Telegram</span><span class="mtableSocialMeta">@Domovikx</span>`,
        }}
      />
      <a
        {...sxSocialGap}
        className={`mtableSocial mtableStar ${sxSocialGap.className ?? ''}`}
        data-testid="mtable-star"
        href="https://github.com/Domovikx/kubica"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={starMenuLabel}
        dangerouslySetInnerHTML={{
          __html: `${likeIcon()}<span class="mtableSocialName">Оценить репозиторий</span><span class="mtableSocialMeta" data-testid="star-count"${
            starCount === null || starCount < 1 ? ' hidden' : ''
          }>${starCount !== null && starCount >= 1 ? starCount : ''}</span>`,
        }}
      />
    </div>
  )
}
