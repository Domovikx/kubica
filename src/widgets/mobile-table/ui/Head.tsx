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
import { useMemo } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { soundActions } from '@/shared/dice/sound-slice'
import { isMuted, setMuted } from '@/shared/dice/sound'
import { addIcon, menuIcon, musicIcon, soundIcon, likeIcon } from '@/shared/ui/md-icon'
import {
  selectCounts,
  selectLastResult,
  selectMusicEntry,
  selectRolling,
  selectSound,
  selectUiScale,
} from '../selectors'
import { shortSet, summarize } from '../format'
import { iconStyles } from '../mt-styles'
import { useHeadStarFit, type HeadFitRefs } from '../hooks/use-fit-head-star'
import { useStarCount } from '../hooks/use-stars'

const styles = stylex.create({
  head: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 6,
    display: 'grid',
    gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
    alignItems: 'center',
    gap: 10,
    paddingTop: 'calc(8px + env(safe-area-inset-top))',
    paddingLeft: 12,
    paddingRight: 12,
    paddingBottom: 8,
  },
  headLeft: {
    gridColumn: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    justifySelf: 'start',
  },
  headCtl: {
    position: 'relative',
    gridColumn: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  headSide: {
    gridColumn: 3,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    justifySelf: 'end',
  },
  /** Ряд Star: своя база (min-w:0, шкала --icon-like), ссылка, не кнопка. */
  star: {
    display: 'inline-flex',
    minWidth: 0,
    minHeight: 'var(--tap)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 0,
    paddingBottom: 0,
    // Shorthand `border` stylex молча не компилирует (0.19.1) — суб-свойства.
    borderWidth: 'medium',
    borderStyle: 'none',
    borderColor: 'currentColor',
    borderRadius: 12,
    backgroundColor: 'transparent',
    color: '#f0f2f5',
    fontFamily: 'inherit',
    fontSize: 'var(--fs-body)',
    fontWeight: 800,
    textDecorationLine: 'none',
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    ':active': {
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    ':focus-visible': {
      outline: '2px solid #fff',
      outlineOffset: 2,
    },
  },
  /** Кнопка набора: «+» / текст состава (p-0 из iconStyles.body не нужен). */
  add: {
    display: 'inline-flex',
    minWidth: 'var(--tap)',
    minHeight: 'var(--tap)',
    alignItems: 'center',
    justifyContent: 'center',
    // Shorthand `border` stylex молча не компилирует (0.19.1) — суб-свойства.
    borderWidth: 'medium',
    borderStyle: 'none',
    borderColor: 'currentColor',
    borderRadius: 12,
    backgroundColor: 'transparent',
    color: '#f0f2f5',
    fontFamily: 'inherit',
    fontWeight: 800,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    ':active': {
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 0,
    paddingBottom: 0,
    fontSize: 'min(var(--fs-sec), calc(16px * var(--ui-scale)))',
    whiteSpace: 'nowrap',
    maxWidth: 'calc(100vw - 48px - var(--tap))',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  /** Бургер: сумма/меню/лоадер, headline-шкала (base — iconStyles.btn). */
  burger: {
    padding: 0,
    fontSize: 'var(--fs-headline)',
  },
  burgerSum: {
    color: '#ef3124',
  },
  /** Музыка включена (легаси onstate:text-...). */
  musicOn: {
    color: '#ef3124',
  },
})

export interface HeadProps {
  headRef: React.RefObject<HTMLDivElement | null>
  headCtlRef: React.RefObject<HTMLDivElement | null>
  headStarRef: React.RefObject<HTMLAnchorElement | null>
  soundRef: React.RefObject<HTMLButtonElement | null>
  musicRef: React.RefObject<HTMLButtonElement | null>
  onOpenSheet: () => void
  onOpenDrawer: () => void
  onOpenMusic: () => void
}

export const Head = (props: HeadProps): React.JSX.Element => {
  const { headRef, headCtlRef, headStarRef, soundRef, musicRef } = props
  const dispatch = useAppDispatch()
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
  const headStarLabel =
    starCount !== null
      ? `Оценить репозиторий Kubica на GitHub, звёзд: ${starCount} (откроется в новой вкладке)`
      : 'Оценить репозиторий на GitHub (откроется в новой вкладке)'

  // Star: иконка прямым ребёнком + подпись + пилюля-счётчик одной строкой
  // innerHTML — как легаси innerHTML+append. Пилюля всегда в DOM, hidden
  // пока данных нет (легаси: span создан сразу, hidden=true).
  const starHtml =
    likeIcon() +
    '<span class="mtableHeadStarLabel">Star</span>' +
    `<span class="mtableHeadStarCount" data-testid="mtable-head-star-count"${
      starCount === null ? ' hidden' : ''
    }>${starCount === null ? '' : starCount}</span>`

  const sxHead = stylex.props(styles.head)
  const sxLeft = stylex.props(styles.headLeft)
  const sxSound = stylex.props(iconStyles.btn, iconStyles.body, iconStyles.hover)
  const sxMusic = stylex.props(
    iconStyles.btn,
    iconStyles.body,
    iconStyles.hover,
    music.on && styles.musicOn,
    music.unavail && iconStyles.ariaOff,
  )
  const sxCtl = stylex.props(styles.headCtl)
  const sxAdd = stylex.props(styles.add)
  const sxBurger = stylex.props(
    iconStyles.btn,
    styles.burger,
    !rolling && iconStyles.hover,
    rolling && iconStyles.disabled,
    !rolling && lastResult && styles.burgerSum,
  )
  const sxSide = stylex.props(styles.headSide)
  const sxStar = stylex.props(styles.star)

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
          onClick={() => {
            const next = !isMuted()
            setMuted(next)
            dispatch(soundActions.setMuted(next))
          }}
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
