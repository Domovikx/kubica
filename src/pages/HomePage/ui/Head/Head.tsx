// Шапка стола (React): три колонки — звук/музыка, пара «+»/бургер, Star.
// Разметка 1-в-1 из head.ts; fit (укорачивание колонок) — use-fit-head-star.
// Иконки/спаны — React-дети кнопок (волна Whtml): размеры svg — stylex
// (iconStyles.svgHead + headStyles.starSvg), спиннер/подпись/пилюля —
// headStyles; бургер/состав переключают ветку по рендерам как раньше.
// hidden у sound/music/star управляется императивно через refs (см.
// fitHeadStar); пилюля счётчика — React-проп hidden (data-driven, fit её
// не трогает). Состояния (disabled/aria-disabled/on/hasSum) известны
// React — условные объекты stylex, не CSS-варианты.
import { useMemo, useRef } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppSelector } from '@/app'
import { addIcon, iconStyles, likeIcon, menuIcon, musicIcon, soundIcon } from '@/shared'
import {
  selectCounts,
  selectLastResult,
  selectMusicEntry,
  selectRolling,
  selectSound,
  selectUiScale,
  shortSet,
  starReviewLabel,
  summarize,
  useMuteToggle,
  useStarCount,
} from '@/features'
import { useHeadStarFit, type HeadFitRefs } from './useFitHeadStar'
import { headStyles as s } from './Head.stylex'

export interface HeadProps {
  headRef: React.RefObject<HTMLDivElement | null>
  onOpenSheet: () => void
  onOpenDrawer: () => void
  onOpenMusic: () => void
}

export const Head = (props: HeadProps): React.JSX.Element => {
  const { headRef } = props
  // Fit-рефы шапки — владеет Head (контейнер их не читал, только прокидывал).
  const headCtlRef = useRef<HTMLDivElement>(null)
  const headStarRef = useRef<HTMLAnchorElement>(null)
  const soundRef = useRef<HTMLButtonElement>(null)
  const musicRef = useRef<HTMLButtonElement>(null)
  const toggleMute = useMuteToggle()
  const counts = useAppSelector(selectCounts)
  const rolling = useAppSelector(selectRolling)
  const lastResult = useAppSelector(selectLastResult)
  const { muted } = useAppSelector(selectSound)
  const music = useAppSelector(selectMusicEntry)
  // Подписка на масштаб без присваивания: форсирует ре-рендер → fitHeadStar
  // меряет реальные боксы уже при новом --ui-scale.
  useAppSelector(selectUiScale)
  const starCount = useStarCount()

  const totalN = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts])
  const short = shortSet(counts)

  const fitRefs = useMemo<HeadFitRefs>(
    () => ({ headRef, headCtlRef, headStarRef, soundRef, musicRef }),
    [headRef, headCtlRef, headStarRef, soundRef, musicRef],
  )
  useHeadStarFit(fitRefs)

  const sxHead = stylex.props(s.head)
  const sxLeft = stylex.props(s.headLeft)
  const sxSound = stylex.props(iconStyles.btn, iconStyles.body, iconStyles.hover)
  const sxMusic = stylex.props(
    iconStyles.btn,
    iconStyles.body,
    iconStyles.hover,
    music.on && s.musicOn,
    music.unavail && iconStyles.ariaOff,
  )
  const sxCtl = stylex.props(s.headCtl)
  const sxAdd = stylex.props(s.add)
  const sxBurger = stylex.props(
    iconStyles.btn,
    s.burger,
    !rolling && iconStyles.hover,
    rolling && iconStyles.disabled,
    !rolling && lastResult && s.burgerSum,
  )
  const sxSide = stylex.props(s.headSide)
  const sxStar = stylex.props(s.star)
  const sxSvg = stylex.props(iconStyles.svgHead)
  const sxSpin = stylex.props(s.spin)
  const sxStarSvg = stylex.props(iconStyles.svgHead, s.starSvg)
  const sxStarLabel = stylex.props(s.starLabel)
  const sxStarCount = stylex.props(s.starCount)

  // Burger: rolling → спиннер; итог → сумма; покой → иконка меню. Ветка —
  // span/svg/text прямым ребёнком (стили stylex, маркеры в className).
  const burgerChild: React.ReactNode = rolling ? (
    <span
      {...sxSpin}
      className={`mtableSpin ${sxSpin.className ?? ''}`}
      data-testid="mtable-spin"
    />
  ) : lastResult ? (
    String(lastResult.total)
  ) : (
    menuIcon(sxSvg.className)
  )
  const addChild: React.ReactNode = totalN > 0 ? short : addIcon(sxSvg.className)
  const diceLabel = totalN > 0 ? `Выбор костей: ${short}` : 'Выбор костей'

  // Шапка — ряд как на GitHub: цифра видна всегда, когда она известна
  // (GitHub показывает и 0); без данных/офлайн пилюля скрыта (hidden).
  const headStarLabel = starReviewLabel(starCount)

  return (
    <div
      ref={headRef}
      {...sxHead}
      className={`mtableHead ${sxHead.className ?? ''}`}
      data-testid="mtable-head"
    >
      <div
        {...sxLeft}
        className={`mtableHeadLeft ${sxLeft.className ?? ''}`}
        data-testid="mtable-head-left"
      >
        <button
          ref={soundRef}
          type="button"
          {...sxSound}
          className={`mtableIcon mtableSound ${sxSound.className ?? ''}`}
          data-testid="mtable-sound"
          aria-label={muted ? 'Включить звук' : 'Выключить звук'}
          aria-pressed={!muted}
          onClick={toggleMute}
        >
          {soundIcon(muted, sxSvg.className)}
        </button>
        <button
          ref={musicRef}
          type="button"
          {...sxMusic}
          className={`mtableIcon mtableMusic${music.on ? ' on' : ''} ${sxMusic.className ?? ''}`}
          data-testid="mtable-music"
          aria-haspopup="dialog"
          aria-disabled={music.unavail ? 'true' : undefined}
          aria-label={
            music.unavail
              ? 'Фоновая музыка недоступна: нет доступа к YouTube'
              : music.loading
                ? 'Загружаю фоновую музыку…'
                : 'Фоновая музыка'
          }
          aria-busy={music.loading ? 'true' : undefined}
          onClick={props.onOpenMusic}
        >
          {music.loading ? (
            <span
              {...sxSpin}
              className={`mtableSpin ${sxSpin.className ?? ''}`}
              data-testid="mtable-music-spin"
            />
          ) : (
            musicIcon(music.on, sxSvg.className)
          )}
        </button>
      </div>
      <div
        ref={headCtlRef}
        {...sxCtl}
        className={`mtableHeadCtl ${sxCtl.className ?? ''}`}
        data-testid="mtable-head-ctl"
      >
        <button
          type="button"
          {...sxAdd}
          className={`mtableIcon mtableAdd ${sxAdd.className ?? ''}`}
          data-testid="mtable-add"
          aria-label={diceLabel}
          title={totalN > 0 ? summarize(counts) : diceLabel}
          onClick={props.onOpenSheet}
        >
          {addChild}
        </button>
        <button
          type="button"
          {...sxBurger}
          className={`mtableIcon mtableBurger${!rolling && lastResult ? ' hasSum' : ''} ${sxBurger.className ?? ''}`}
          data-testid="mtable-burger"
          aria-label="Меню"
          aria-busy={rolling ? 'true' : undefined}
          disabled={rolling}
          onClick={props.onOpenDrawer}
        >
          {burgerChild}
        </button>
      </div>
      <div
        {...sxSide}
        className={`mtableHeadSide ${sxSide.className ?? ''}`}
        data-testid="mtable-head-side"
      >
        <a
          ref={headStarRef}
          href="https://github.com/Domovikx/kubica"
          target="_blank"
          rel="noopener noreferrer"
          {...sxStar}
          className={`mtableIcon mtableHeadStar ${sxStar.className ?? ''}`}
          data-testid="mtable-head-star"
          aria-label={headStarLabel}
        >
          {likeIcon(sxStarSvg.className)}
          <span {...sxStarLabel} className={`mtableHeadStarLabel ${sxStarLabel.className ?? ''}`}>
            Star
          </span>
          <span
            {...sxStarCount}
            className={`mtableHeadStarCount ${sxStarCount.className ?? ''}`}
            data-testid="mtable-head-star-count"
            hidden={starCount === null}
          >
            {starCount === null ? '' : starCount}
          </span>
        </a>
      </div>
    </div>
  )
}
