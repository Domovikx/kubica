// Секция «О проекте» в бургере: короткое описание стека и геометрии.
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
        Kubica — точные кости D&D: d6 16 мм, набор d4–d20, грани N+1, честная физика. FreeCAD ·
        OpenSCAD · CadQuery → Blender → three.js.
      </p>
    </div>
  )
}
