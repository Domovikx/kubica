// Секция «Соцсети» в бургере: GitHub/Telegram/оценка репозитория; счётчик
// звёзд (ленивый fetch) показываем от 0, когда данные есть; сама ссылка — всегда.
import * as stylex from '@stylexjs/stylex'
import { githubIcon, likeIcon, telegramIcon } from '@/shared'
import { starReviewLabel, useStarCount } from '@/features'
import { overlayStyles } from '@/shared'
import { drawerStyles as s } from './Drawer.stylex'

export const DrawerSocialSection = (): React.JSX.Element => {
  const starCount = useStarCount()
  const starMenuLabel = starReviewLabel(starCount)

  const sxSection = stylex.props(overlayStyles.section)
  const sxSectionTitle = stylex.props(s.sectionTitle)
  const sxSocial = stylex.props(s.social)
  const sxSocialGap = stylex.props(s.social, s.socialGap)
  const sxSocialSvg = stylex.props(s.socialSvg)
  const sxStarSvg = stylex.props(s.socialSvg, s.socialStar)
  const sxSocialName = stylex.props(s.socialName)
  const sxSocialMeta = stylex.props(s.socialMeta)

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
      {/* Иконка — прямой ребёнок <a> (svg), как в легаси innerHTML. */}
      <a
        {...sxSocial}
        className={`mtableSocial ${sxSocial.className ?? ''}`}
        data-testid="mtable-social"
        href="https://github.com/DomovikX"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Профиль GitHub DomovikX (откроется в новой вкладке)"
      >
        {githubIcon(sxSocialSvg.className)}
        <span {...sxSocialName} className={`mtableSocialName ${sxSocialName.className ?? ''}`}>
          GitHub
        </span>
        <span {...sxSocialMeta} className={`mtableSocialMeta ${sxSocialMeta.className ?? ''}`}>
          @DomovikX
        </span>
      </a>
      <a
        {...sxSocialGap}
        className={`mtableSocial ${sxSocialGap.className ?? ''}`}
        data-testid="mtable-social"
        href="https://t.me/Domovikx"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Канал Domovikx в Telegram (откроется в новой вкладке)"
      >
        {telegramIcon(sxSocialSvg.className)}
        <span {...sxSocialName} className={`mtableSocialName ${sxSocialName.className ?? ''}`}>
          Telegram
        </span>
        <span {...sxSocialMeta} className={`mtableSocialMeta ${sxSocialMeta.className ?? ''}`}>
          @Domovikx
        </span>
      </a>
      <a
        {...sxSocialGap}
        className={`mtableSocial mtableStar ${sxSocialGap.className ?? ''}`}
        data-testid="mtable-star"
        href="https://github.com/Domovikx/kubica"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={starMenuLabel}
      >
        {likeIcon(sxStarSvg.className)}
        <span {...sxSocialName} className={`mtableSocialName ${sxSocialName.className ?? ''}`}>
          Оценить репозиторий
        </span>
        <span
          {...sxSocialMeta}
          className={`mtableSocialMeta ${sxSocialMeta.className ?? ''}`}
          data-testid="star-count"
          hidden={starCount === null || starCount < 1}
        >
          {starCount !== null && starCount >= 1 ? starCount : ''}
        </span>
      </a>
    </div>
  )
}
