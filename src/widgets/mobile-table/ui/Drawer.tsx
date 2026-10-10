// Бургер-меню (дроуэр): история (реролл, двухтап-очистка), сила броска,
// звук/вибро/музыка, масштаб, о проекте, соцсети. Разметка/логика 1-в-1 из
// mobile-table.ts (блок дровера); состояние — RTK, движок — через props.
import { useEffect, useRef } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { formatLabel, formatParts, type HistoryEntry } from '@/entities/roll-history/history'
import { historyActions } from '@/entities/roll-history/history-slice'
import { THROW_POWERS, setThrowPower } from '@/features/roll-dice/power'
import { powerActions } from '@/features/roll-dice/power-slice'
import { UI_SCALES, setUiScale, type UiScale } from '@/features/ui-scale/ui-scale'
import { uiScaleActions } from '@/features/ui-scale/ui-scale-slice'
import { hapticsEnabled, isMuted, setHaptics, setMuted, buzz as vibrate } from '@/shared/dice/sound'
import { soundActions } from '@/shared/dice/sound-slice'
import {
  checkIcon,
  closeIcon,
  githubIcon,
  likeIcon,
  musicIcon,
  soundIcon,
  telegramIcon,
  vibrationIcon,
} from '@/shared/ui/md-icon'
import { mtUiActions } from '../mt-ui-slice'
import {
  selectEntries,
  selectMusicEntry,
  selectMtUi,
  selectPower,
  selectSound,
  selectUiScale,
} from '../selectors'
import { fmtTime } from '../format'
import { partClass } from '../format'
import { iconStyles } from '../mt-styles'
import { overlayStyles } from './overlay-styles'
import { loadStars, useStarCount } from '../hooks/use-stars'

export interface DrawerProps {
  open: boolean
  showToast: (msg: string) => void
  onClose: () => void
  onReroll: (entry: HistoryEntry) => void
  onOpenMusic: () => void
}

const styles = stylex.create({
  drawer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 21,
    width: 'min(calc(360px * var(--ui-scale)), calc(100% - 48px))',
    maxHeight: 'calc(100% - 48px)',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#121419',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#2a2e36',
    borderRadius: 14,
    overflow: 'hidden',
    '@media (max-width: 600px)': {
      width: 'calc(100% - 24px)',
      maxHeight: 'calc(100% - 32px)',
    },
  },
  body: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    paddingBottom: 'env(safe-area-inset-bottom)',
  },
  sectionHead: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    fontWeight: 800,
    fontSize: 'var(--fs-body)',
  },
  sectionTitle: {
    display: 'block',
    padding: '8px 0',
    fontWeight: 800,
    fontSize: 'var(--fs-body)',
  },
  link: {
    minHeight: 'var(--tap)',
    padding: '0 12px',
    marginRight: -12,
    borderWidth: 'medium',
    borderStyle: 'none',
    borderColor: 'currentColor',
    backgroundColor: 'transparent',
    color: '#9aa0aa',
    fontFamily: 'inherit',
    fontSize: 'var(--fs-sec)',
    cursor: 'pointer',
  },
  hist: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  empty: {
    color: '#9aa0aa',
    fontSize: 'var(--fs-sec)',
    lineHeight: 1.4,
    margin: '4px 0',
  },
  hrow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    width: '100%',
    textAlign: 'left',
    backgroundColor: '#1d2026',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderRadius: 12,
    padding: '9px 12px',
    color: '#f0f2f5',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  hv: {
    color: '#ef3124',
    fontWeight: 800,
    fontSize: 'var(--fs-title)',
  },
  hmeta: {
    color: '#9aa0aa',
    fontSize: 'var(--fs-meta)',
  },
  hp: {
    marginLeft: 'auto',
    color: '#9aa0aa',
    fontSize: 'var(--fs-meta)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '45%',
  },
  hredo: {
    color: '#9aa0aa',
    fontSize: 'var(--fs-body)',
    marginLeft: 2,
  },
  wideGap: {
    marginTop: 8,
  },
  scaleRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  scale: {
    minHeight: 'var(--tap)',
    padding: '0 12px',
    borderWidth: 'medium',
    borderStyle: 'none',
    borderColor: 'currentColor',
    borderRadius: 999,
    backgroundColor: '#1d2026',
    color: '#f0f2f5',
    fontFamily: 'inherit',
    fontSize: 'var(--fs-sec)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  about: {
    fontSize: 'var(--fs-sec)',
    color: '#9aa0aa',
    margin: 0,
    lineHeight: 1.5,
  },
  social: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    minHeight: 'var(--tap)',
    padding: '0 12px',
    borderRadius: 12,
    backgroundColor: '#1d2026',
    color: '#f0f2f5',
    fontSize: 'var(--fs-body)',
    fontWeight: 700,
    textDecoration: 'none',
    ':hover': {
      backgroundColor: '#242832',
    },
    ':focus-visible': {
      outline: '2px solid #fff',
      outlineOffset: 2,
    },
  },
  socialGap: {
    marginTop: 8,
  },
})

export const Drawer = (props: DrawerProps): React.JSX.Element => {
  const { open, showToast, onClose, onReroll, onOpenMusic } = props
  const dispatch = useAppDispatch()
  const entries = useAppSelector(selectEntries)
  const { muted, haptics } = useAppSelector(selectSound)
  const music = useAppSelector(selectMusicEntry)
  const scale = useAppSelector(selectUiScale)
  const power = useAppSelector(selectPower)
  const { dirtyDrawer, clearArmed } = useAppSelector(selectMtUi)
  const starCount = useStarCount()

  const closeRef = useRef<HTMLButtonElement>(null)

  // Счётчик звёзд тянем лениво — при первом открытии меню (как легаси).
  useEffect(() => {
    if (open) {
      loadStars()
      closeRef.current?.focus()
    }
  }, [open])

  // Двухтап «Очистить»: первый тап взводит, 3 с — сброс.
  useEffect(() => {
    if (!clearArmed) return
    const t = window.setTimeout(() => dispatch(mtUiActions.setClearArmed(false)), 3000)
    return () => window.clearTimeout(t)
  }, [clearArmed, dispatch])

  const onPanelClick = (e: React.MouseEvent): void => {
    const t = e.target
    if (!(t instanceof Element)) return
    if (t.closest('a') || t.closest('button') === closeRef.current) return
    if (t.closest('button') || t.closest('input'))
      dispatch(mtUiActions.setDirty({ kind: 'drawer', dirty: true }))
  }
  const onPanelInput = (): void => {
    dispatch(mtUiActions.setDirty({ kind: 'drawer', dirty: true }))
  }

  // Лайкалка в шторке: 0 звёзд — не социальное доказательство, мету прячем
  // (сама строка-ссылка живёт всегда), показываем от 1.
  const starMenuLabel =
    starCount !== null && starCount >= 1
      ? `Оценить репозиторий Kubica на GitHub, звёзд: ${starCount} (откроется в новой вкладке)`
      : 'Оценить репозиторий Kubica звездой на GitHub (откроется в новой вкладке)'

  const sxClose = stylex.props(iconStyles.btn, iconStyles.body, iconStyles.hover)

  const sxDrawer = stylex.props(styles.drawer)
  const sxHead = stylex.props(overlayStyles.head)
  const sxTitle = stylex.props(overlayStyles.headTitle)
  const sxBody = stylex.props(styles.body)
  const sxSection = stylex.props(overlayStyles.section)
  const sxSectionHead = stylex.props(styles.sectionHead)
  const sxSectionTitle = stylex.props(styles.sectionTitle)
  const sxLink = stylex.props(styles.link)
  const sxHist = stylex.props(styles.hist)
  const sxEmpty = stylex.props(styles.empty)
  const sxHrow = stylex.props(styles.hrow)
  const sxHv = stylex.props(styles.hv)
  const sxHmeta = stylex.props(styles.hmeta)
  const sxHp = stylex.props(styles.hp)
  const sxHredo = stylex.props(styles.hredo)
  const sxSectionHint = stylex.props(overlayStyles.sectionHint)
  const sxWide = stylex.props(overlayStyles.wide)
  const sxWideGap = stylex.props(overlayStyles.wide, styles.wideGap)
  const sxScaleRow = stylex.props(styles.scaleRow)
  const sxScale = stylex.props(styles.scale)
  const sxAbout = stylex.props(styles.about)
  const sxSocial = stylex.props(styles.social)
  const sxSocialGap = stylex.props(styles.social, styles.socialGap)

  return (
    <div
      {...sxDrawer}
      className={`mtableDrawer ${sxDrawer.className ?? ''}`}
      data-testid="mtable-drawer"
      hidden={!open}
      onClick={onPanelClick}
      onInput={onPanelInput}
    >
      <div
        {...sxHead}
        className={`mtableSheetHead ${sxHead.className ?? ''}`}
        data-testid="mtable-drawer-head"
      >
        <span {...sxTitle} className={sxTitle.className ?? undefined}>
          Меню
        </span>
        <button
          ref={closeRef}
          type="button"
          {...sxClose}
          className={`mtableIcon${dirtyDrawer ? ' mtableMorph' : ''} ${sxClose.className ?? ''}`}
          data-testid="mtable-drawer-close"
          aria-label={dirtyDrawer ? 'Готово' : 'Закрыть меню'}
          title={dirtyDrawer ? 'Готово' : 'Закрыть меню'}
          dangerouslySetInnerHTML={{ __html: dirtyDrawer ? checkIcon() : closeIcon() }}
          onClick={onClose}
        />
      </div>
      <div
        {...sxBody}
        className={`mtableDrawerBody ${sxBody.className ?? ''}`}
        data-testid="mtable-drawer-body"
      >
        <div
          {...sxSection}
          className={`mtableSection ${sxSection.className ?? ''}`}
          data-testid="mtable-history-section"
        >
          <div
            {...sxSectionHead}
            className={`mtableSectionHead ${sxSectionHead.className ?? ''}`}
            data-testid="mtable-history-head"
          >
            <span>История</span>
            <button
              type="button"
              {...sxLink}
              className={`mtableLink ${sxLink.className ?? ''}`}
              data-testid="mtable-link"
              onClick={() => {
                if (!clearArmed) {
                  dispatch(mtUiActions.setClearArmed(true))
                  return
                }
                dispatch(mtUiActions.setClearArmed(false))
                dispatch(historyActions.clear())
              }}
            >
              {clearArmed ? 'Точно?' : 'Очистить'}
            </button>
          </div>
          <div
            {...sxHist}
            className={`mtableHist ${sxHist.className ?? ''}`}
            data-testid="mtable-hist"
          >
            {entries.length === 0 ? (
              <p
                {...sxEmpty}
                className={`mtableEmpty ${sxEmpty.className ?? ''}`}
                data-testid="mtable-history-empty"
              >
                Пока пусто — кинь кости
              </p>
            ) : (
              entries.slice(0, 5).map((entry, i) => {
                const texts = entry.parts ? formatParts(entry.parts) : []
                return (
                  <button
                    key={`${entry.at}-${i}`}
                    type="button"
                    {...sxHrow}
                    className={`mtableHrow ${sxHrow.className ?? ''}`}
                    data-testid="mtable-hrow"
                    title="Повторить этот набор"
                    onClick={() => onReroll(entry)}
                  >
                    <span
                      {...sxHv}
                      className={`mtableHv ${sxHv.className ?? ''}`}
                      data-testid="mtable-hv"
                    >
                      {entry.display}
                    </span>
                    <span
                      {...sxHmeta}
                      className={`mtableHmeta ${sxHmeta.className ?? ''}`}
                      data-testid="mtable-hmeta"
                    >
                      {entry.label
                        ? `${formatLabel(entry.label)} · ${fmtTime(entry.at)}`
                        : fmtTime(entry.at)}
                    </span>
                    <span
                      {...sxHp}
                      className={`mtableHp ${sxHp.className ?? ''}`}
                      data-testid="mtable-hp"
                    >
                      {entry.parts?.map((p, j) => {
                        const cls = partClass(p) || (!p.kept ? 'partDrop' : '')
                        return (
                          <span key={j} className={cls || undefined}>
                            {texts[j]}
                          </span>
                        )
                      })}
                    </span>
                    <span
                      {...sxHredo}
                      className={`mtableHredo ${sxHredo.className ?? ''}`}
                      data-testid="mtable-hredo"
                    >
                      ↻
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div
          {...sxSection}
          className={`mtableSection ${sxSection.className ?? ''}`}
          data-testid="mtable-power-section"
        >
          <span
            {...sxSectionTitle}
            className={`mtableSectionTitle ${sxSectionTitle.className ?? ''}`}
            data-testid="mtable-power-title"
          >
            Сила броска
          </span>
          {THROW_POWERS.map((p, pi) => {
            const sxP = pi > 0 ? sxWideGap : sxWide
            return (
              <button
                key={p.mode}
                type="button"
                {...sxP}
                className={`mtableWide${p.mode === power ? ' on' : ''} ${sxP.className ?? ''}`}
                data-testid="mtable-wide"
                onClick={() => {
                  setThrowPower(p.mode)
                  dispatch(powerActions.setMode(p.mode))
                }}
              >
                {p.name}
              </button>
            )
          })}
          <p
            {...sxSectionHint}
            className={`mtableSectionHint ${sxSectionHint.className ?? ''}`}
            data-testid="mtable-power-hint"
          >
            Кость заряжается удержанием 3–5 с — сильнее бросок (и флик при отпускании)
          </p>
        </div>

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
            onClick={() => {
              const next = !isMuted()
              setMuted(next)
              dispatch(soundActions.setMuted(next))
            }}
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
            onClick={() => {
              const next = !hapticsEnabled()
              setHaptics(next)
              dispatch(soundActions.setHaptics(next))
            }}
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

        <div
          {...sxSection}
          className={`mtableSection ${sxSection.className ?? ''}`}
          data-testid="mtable-scale-section"
        >
          <span
            {...sxSectionTitle}
            className={`mtableSectionTitle ${sxSectionTitle.className ?? ''}`}
            data-testid="mtable-scale-title"
          >
            Масштаб интерфейса
          </span>
          <div
            {...sxScaleRow}
            className={`mtableScaleRow ${sxScaleRow.className ?? ''}`}
            data-testid="mtable-scale-row"
          >
            {UI_SCALES.map((s: UiScale) => {
              const pct = Math.round(s * 100)
              return (
                <button
                  key={s}
                  type="button"
                  {...sxScale}
                  className={`mtableScale${s === scale ? ' on' : ''} ${sxScale.className ?? ''}`}
                  data-testid="mtable-scale"
                  aria-label={`Масштаб интерфейса ${pct}%`}
                  aria-pressed={s === scale}
                  onClick={() => {
                    setUiScale(s)
                    dispatch(uiScaleActions.setScale(s))
                    showToast(`Масштаб ${pct}%`)
                    vibrate(15)
                  }}
                >
                  {`${pct}%`}
                </button>
              )
            })}
          </div>
        </div>

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
      </div>
    </div>
  )
}
