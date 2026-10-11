// fitHeadStar из mountMobileTable: три колонки шапки ужимаются — Star
// (третий приоритет), потом звук, музыка (первая) уступают место паре
// «+»/бургер. Hidden управляется императивно через refs — React-проп не
// меняется (иначе битва с fit после каждого рендера). Без-deps
// useLayoutEffect — после каждого рендера, как старый refreshChrome.
import { useLayoutEffect, type RefObject } from 'react'

export interface HeadFitRefs {
  headRef: RefObject<HTMLDivElement | null>
  headCtlRef: RefObject<HTMLDivElement | null>
  headStarRef: RefObject<HTMLAnchorElement | null>
  soundRef: RefObject<HTMLButtonElement | null>
  musicRef: RefObject<HTMLButtonElement | null>
}

export const fitHeadStar = (refs: HeadFitRefs): void => {
  const { headRef, headCtlRef, headStarRef, soundRef, musicRef } = refs
  const head = headRef.current
  const headCtl = headCtlRef.current
  const headStar = headStarRef.current
  const soundBtn = soundRef.current
  const musicBtn = musicRef.current
  if (!head || !headCtl || !headStar || !soundBtn || !musicBtn) return
  headStar.hidden = false
  soundBtn.hidden = false
  musicBtn.hidden = false
  const measure = () => {
    const hr = head.getBoundingClientRect()
    const cs = getComputedStyle(head)
    const ctl = headCtl.getBoundingClientRect()
    return {
      hr,
      padL: parseFloat(cs.paddingLeft),
      padR: parseFloat(cs.paddingRight),
      ctl,
    }
  }
  // Музыка ближе всех к паре — уступает первой; звук — второй; Star — третий.
  let m = measure()
  const mus = musicBtn.getBoundingClientRect()
  if (mus.right > m.ctl.left - 1 || m.ctl.right > m.hr.right - m.padR + 1) musicBtn.hidden = true
  m = measure()
  const snd = soundBtn.getBoundingClientRect()
  if (snd.right > m.ctl.left - 1 || m.ctl.right > m.hr.right - m.padR + 1) soundBtn.hidden = true
  m = measure()
  const sr = headStar.getBoundingClientRect()
  headStar.hidden =
    sr.left < m.ctl.right + 1 ||
    sr.right > m.hr.right - m.padR + 1 ||
    sr.left < m.hr.left + m.padL + 1
}

/** Подписка на рендер (без deps) + resize: fit меряет реальные боксы. */
export const useHeadStarFit = (refs: HeadFitRefs): void => {
  useLayoutEffect(() => {
    fitHeadStar(refs)
  })
  useLayoutEffect(() => {
    const onResize = () => fitHeadStar(refs)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [refs])
}
