// Секция «О проекте» в бургере: короткое SEO-описание (что это и зачем) с
// продуктовыми выгодами; тех-детали пайплайна здесь не нужны.
import * as stylex from '@stylexjs/stylex'
import { overlayStyles } from '@/shared'
import { drawerStyles as s } from './Drawer.stylex'

export const DrawerAboutSection = (): React.JSX.Element => {
  const sxSection = stylex.props(overlayStyles.section)
  const sxSectionTitle = stylex.props(s.sectionTitle)
  const sxAbout = stylex.props(s.about)

  return (
    <div
      {...sxSection}
      className={`mtableSection ${sxSection.className ?? ''}`}
      data-testid="mtable-about-section"
    >
      <span
        {...sxSectionTitle}
        className={`mtableSectionTitle ${sxSectionTitle.className ?? ''}`}
        data-testid="mtable-about-title"
      >
        О проекте
      </span>
      <p
        {...sxAbout}
        className={`mtableAbout ${sxAbout.className ?? ''}`}
        data-testid="mtable-about"
      >
        Kubica — бесплатный онлайн-стол для бросков костей: d20, d6 и набор d4–d20 для D&D,
        Pathfinder и настольных игр. Реалистичная 3D-физика, звук броска и честный рандом, история и
        готовые наборы — играйте в браузере, без установки и регистрации. Точные модели костей: d6
        16 мм, грани N+1.
      </p>
    </div>
  )
}
