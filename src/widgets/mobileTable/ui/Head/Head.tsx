// Шапка стола (React): три колонки — звук/музыка, пара «+»/бургер, Star.
// Разметка 1-в-1 из head.ts; fit (укорачивание колонок) — use-fit-head-star.
// Иконки — dangerouslySetInnerHTML на самой кнопке (svg прямым ребёнком;
// размеры svg-детей — глобальные правила `.mtableIcon > svg` в styles.css,
// они же достают span-ы innerHTML — mtableSpin/label/count); бургер/состав
// переключают ветку innerHTML → переключение между __html и children по
// рендерам допустимо. hidden у sound/music/star управляется императивно
// через refs (см. fitHeadStar); пилюля счётчика — React-проп hidden
// (data-driven, fit её не трогает). Состояния (disabled/aria-disabled/on/
// hasSum) известны React — условные объекты stylex, не CSS-варианты.
import { useMemo, useRef } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppSelector } from '@/app'
import { addIcon, menuIcon, musicIcon, soundIcon, likeIcon } from '@/shared'
import {
  selectCounts,
  selectLastResult,
  selectMusicEntry,
  selectRolling,
  selectSound,
  selectUiScale,
} from '../../model/selectors'
import { shortSet, summarize } from '../../lib/format'
import { iconStyles } from '../mt.stylex'
import { useHeadStarFit, type HeadFitRefs } from './useFitHeadStar'
import { useMuteToggle } from '../useSoundToggle'
import { starReviewLabel, useStarCount } from '@/features'
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

  // Burger: rolling → спиннер; итог → сумма; покой → иконка меню. Ветка
  // одна строка innerHTML — span/svg прямой ребёнок (стили по маркерам).
  const burgerHtml = rolling
    ? '<span class="mtableSpin" data-testid="mtable-spin"></span>'
    : lastResult
      ? String(lastResult.total)
      : menuIcon()
  const diceHtml = totalN > 0 ? short : addIcon()
  const diceLabel = totalN > 0 ? `Выбор костей: ${short}` : 'Выбор костей'

  // Шапка — ряд как на GitHub: цифра видна всегда, когда она известна
  // (GitHub показывает и 0); без данных/офлайн пилюля скрыта (hidden).
  const headStarLabel = starReviewLabel(starCount)

  // Star: иконка прямым ребёнком + подпись + пилюля-счётчик одной строкой
  // innerHTML — как легаси innerHTML+append. Пилюля всегда в DOM, hidden
  // пока данных нет (легаси: span создан сразу, hidden=true).
  const starHtml =
    likeIcon() +
    '<span class="mtableHeadStarLabel">Star</span>' +
    `<span class="mtableHeadStarCount" data-testid="mtable-head-star-count"${
      starCount === null ? ' hidden' : ''
    }>${starCount === null ? '' : starCount}</span>`

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
          dangerouslySetInnerHTML={{ __html: soundIcon(muted) }}
          onClick={toggleMute}
        />
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
          dangerouslySetInnerHTML={{
            __html: music.loading
              ? '<span class="mtableSpin" data-testid="mtable-music-spin"></span>'
              : musicIcon(music.on),
          }}
          onClick={props.onOpenMusic}
        />
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
          dangerouslySetInnerHTML={{ __html: diceHtml }}
          onClick={props.onOpenSheet}
        />
        <button
          type="button"
          {...sxBurger}
          className={`mtableIcon mtableBurger${!rolling && lastResult ? ' hasSum' : ''} ${sxBurger.className ?? ''}`}
          data-testid="mtable-burger"
          aria-label="Меню"
          aria-busy={rolling ? 'true' : undefined}
          disabled={rolling}
          dangerouslySetInnerHTML={{ __html: burgerHtml }}
          onClick={props.onOpenDrawer}
        />
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
          dangerouslySetInnerHTML={{ __html: starHtml }}
        />
      </div>
    </div>
  )
}
