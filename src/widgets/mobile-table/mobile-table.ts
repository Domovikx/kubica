// Стол Kubica (мобайл-фёрст, макет F): дока нет, шторка «+ Кости» (пресеты-глифы
// + SVG-ряды степперов), бургер-меню (история/сила/звук/инфо), поле — главное.
import { DIE_IDS, faceValue, physMaxDim, type DieId } from '@/entities/dice-geometry/geometry'
import {
  formatLabel,
  formatParts,
  getHistoryStore,
  type HistoryEntry,
  type PoolPart,
} from '@/entities/roll-history/history'
import { quatForD4VertexUp, quatForValueDown, quatMul, quatYaw } from '@/shared/dice/face-orient'
import { diceOverlap, type DicePose, type StepCallback } from '@/shared/dice/physics'
import { resolveD4Below, screenUpWorld } from '@/shared/dice/readout'
import {
  buzz as vibrate,
  hapticsEnabled,
  isMuted,
  playThock,
  setHaptics,
  setMuted,
  startRattle,
  stopRattle,
} from '@/shared/dice/sound'
import {
  THROW_POWERS,
  setThrowPower,
  throwPower,
  throwPowerBoost,
} from '@/features/roll-dice/power'
import {
  disposeMusic,
  musicAvail,
  musicState,
  musicToggle,
  musicVolume,
  onMusicChange,
  onMusicNotice,
  probeMusic,
  setMusicVolume,
} from '@/features/dnd-music/music'
import { UI_SCALES, applyUiScale, setUiScale, uiScale } from '@/features/ui-scale/ui-scale'
import {
  commitTableResult,
  labelTableResult,
  rollTable,
  tickTableWorld,
  type TableDieResult,
} from '@/features/table-roll/table-roll'
import {
  expandInstances,
  getSetupStore,
  totalCount,
  type TableCounts,
} from '@/features/table-setup/table-setup'
import {
  BUILT_IN_PRESETS,
  deleteCustomPreset,
  hideBuiltIn,
  loadCustomPresets,
  loadHiddenBuiltIns,
  saveCustomPreset,
  uniquePresetName,
} from '@/features/table-setup/presets'
import { createTable, type Table } from '@/shared/three/table'
import {
  addIcon,
  checkIcon,
  clearAllIcon,
  closeIcon,
  githubIcon,
  menuIcon,
  musicIcon,
  soundIcon,
  likeIcon,
  telegramIcon,
  vibrationIcon,
} from '@/shared/ui/md-icon'
import { DIE_HINTS, dieGlyph } from '@/shared/ui/die-glyph'
import { fmtTime, shortSet } from './format'
import { computeLayout } from './layout'
import { createChrome } from './chrome'
import { createGestures } from './gestures'
import { createStarCounter } from './stars'
import { createWatermark } from './watermark'
import './mobile-table.css'

const buzz = (die: DieId, value: number): void => {
  if (die === 'd20' && value === 20) vibrate([30, 50, 30])
  else if (die === 'd20' && value === 1) vibrate(80)
  else vibrate(15)
}

interface Instance {
  die: DieId
  key: string
}

/** DEV-хук для тестов/чекеров: точка кости на экране (см. mountMobileTable). */
type WindowWithMTable = Window & {
  __mtable?: { diePoint: () => { x: number; y: number } | null }
}

export const mountMobileTable = (
  container: HTMLElement,
): {
  update: () => void
  resize: () => void
  dispose: () => void
} => {
  const setup = getSetupStore()
  const history = getHistoryStore()
  // Масштаб интерфейса (2.20): персист до сборки — токены читают --ui-scale.
  applyUiScale(uiScale())
  container.innerHTML = ''
  const section = document.createElement('section')
  section.className = 'mtable'
  section.dataset.testid = 'mtable'

  const canvas = document.createElement('canvas')
  canvas.className = 'mtableCanvas'
  canvas.dataset.testid = 'mtable-canvas'
  // Декорация для SR: итог озвучивает кнопка (aria-live ниже).
  canvas.setAttribute('aria-hidden', 'true')

  // Водяной знак — в watermark.ts (адаптив под вьюпорт, декор для глаз).
  const watermark = createWatermark()

  const head = document.createElement('div')
  head.className = 'mtableHead'
  head.dataset.testid = 'mtable-head'
  const burger = document.createElement('button')
  burger.className = 'mtableIcon mtableBurger'
  burger.dataset.testid = 'mtable-burger'
  burger.type = 'button'
  burger.innerHTML = menuIcon()
  burger.setAttribute('aria-label', 'Меню')
  // Пусто — значок «+» (пара бургер-иконке), набор — текст («2d4 d12»);
  // сумма броска — на бургере. См. refreshChrome.
  const diceBtn = document.createElement('button')
  diceBtn.className = 'mtableIcon mtableAdd'
  diceBtn.dataset.testid = 'mtable-add'
  diceBtn.type = 'button'
  diceBtn.innerHTML = addIcon()
  diceBtn.setAttribute('aria-label', 'Выбор костей')
  // Лайк в шапке (2.17, четвёртый заход): РЯД как на GitHub — иконка + подпись
  // «Star» + счётчик в пилюле (присланный юзером фрагмент счётчика Stars).
  // Ссылка на github.com/Domovikx/kubica (target/rel как в шторке), стоит
  // справа; звук — слева (центр целиком у священной пары «+»/бургер, 2.15).
  // Надпись «Kubica» из шапки убрана — стала водяным знаком (см. watermark).
  const headStar = document.createElement('a')
  headStar.className = 'mtableIcon mtableHeadStar'
  headStar.dataset.testid = 'mtable-head-star'
  headStar.href = 'https://github.com/Domovikx/kubica'
  headStar.target = '_blank'
  headStar.rel = 'noopener noreferrer'
  const headStarCount = document.createElement('span')
  headStarCount.className = 'mtableHeadStarCount'
  headStarCount.dataset.testid = 'mtable-head-star-count'
  headStarCount.hidden = true
  const headStarLabel = document.createElement('span')
  headStarLabel.className = 'mtableHeadStarLabel'
  headStarLabel.textContent = 'Star'
  headStar.innerHTML = likeIcon()
  headStar.append(headStarLabel, headStarCount)
  const soundBtn = document.createElement('button')
  soundBtn.className = 'mtableIcon mtableSound'
  soundBtn.dataset.testid = 'mtable-sound'
  soundBtn.type = 'button'
  const syncSound = () => {
    soundBtn.innerHTML = soundIcon(isMuted())
    soundBtn.setAttribute('aria-label', isMuted() ? 'Включить звук' : 'Выключить звук')
    soundBtn.setAttribute('aria-pressed', String(!isMuted()))
  }
  syncSound()
  soundBtn.addEventListener('click', () => {
    setMuted(!isMuted())
    syncSound()
    syncDrawerSound()
  })
  // Фоновая музыка (2.22): в левой колонке рядом со звуком. 2.23: кнопка —
  // вход в отдельное меню (aria-haspopup), не тоггл; play/pause живёт внутри
  // карточки (секция переехала из бургера). Стейт-машина в features/dnd-music,
  // рендер — тут; смена стейта дёргает syncMusic/syncCardMusic/syncDrawerMusic
  // (onMusicChange; общий расчёт — musicEntry, см. ниже).
  const musicBtn = document.createElement('button')
  musicBtn.className = 'mtableIcon mtableMusic'
  musicBtn.dataset.testid = 'mtable-music'
  musicBtn.type = 'button'
  musicBtn.setAttribute('aria-haspopup', 'dialog')
  // Один расчёт стейта на два входа (кнопка шапки + строка дровера): так
  // aria-disabled/индикация playing не разъезжаются между ними.
  const musicEntry = (): { unavail: boolean; loading: boolean; on: boolean } => {
    const unavail = musicAvail() === 'unavailable'
    const s = musicState()
    return { unavail, loading: !unavail && s === 'loading', on: !unavail && s === 'playing' }
  }
  const syncMusic = (): void => {
    const { unavail, loading, on } = musicEntry()
    // YouTube недоступен: кнопка гасится с объяснением (aria-disabled, не
    // нативный disabled — остаётся фокусируемой, скринридер озвучит причину;
    // тап всё равно открывает карточку — там тоггл и хинт объясняют почему).
    // setAttribute, а не toggleAttribute: ARIA читает только "true"/"false".
    if (unavail) musicBtn.setAttribute('aria-disabled', 'true')
    else musicBtn.removeAttribute('aria-disabled')
    if (unavail) {
      musicBtn.innerHTML = musicIcon(false)
      musicBtn.setAttribute('aria-label', 'Фоновая музыка недоступна: нет доступа к YouTube')
      musicBtn.removeAttribute('aria-busy')
      musicBtn.classList.remove('on')
      return
    }
    if (loading) {
      // Пока грузится API/плеер — тот же спиннер, что на бургере.
      musicBtn.innerHTML = '<span class="mtableSpin" data-testid="mtable-music-spin"></span>'
      musicBtn.setAttribute('aria-label', 'Загружаю фоновую музыку…')
      musicBtn.setAttribute('aria-busy', 'true')
      musicBtn.classList.remove('on')
      return
    }
    // Вход в меню: label статичен («Включить/Выключить» врало бы — тап не
    // переключает); состояние звучит внутри карточки, снаружи — иконка note/off.
    musicBtn.innerHTML = musicIcon(on)
    musicBtn.setAttribute('aria-label', 'Фоновая музыка')
    musicBtn.removeAttribute('aria-pressed')
    musicBtn.removeAttribute('aria-busy')
    musicBtn.classList.toggle('on', on)
  }
  syncMusic()
  // openMusicCard объявляется ниже (блок оверлеев) — вызов только по клику,
  // после монтирования, поэтому ссылка в замыкании безопасна.
  musicBtn.addEventListener('click', () => openMusicCard())
  // Шапка: слева звук, по центру пара «+»/бургер (2.15), справа ряд Star.
  const headCtl = document.createElement('div')
  headCtl.className = 'mtableHeadCtl'
  headCtl.dataset.testid = 'mtable-head-ctl'
  headCtl.append(diceBtn, burger)
  const headLeft = document.createElement('div')
  headLeft.className = 'mtableHeadLeft'
  headLeft.dataset.testid = 'mtable-head-left'
  // Звук первым (позиция не меняется, когда музыка уходит по fit), музыка —
  // вторым, ближе к паре: она же первой и уступает место на узких.
  headLeft.append(soundBtn, musicBtn)
  const headSide = document.createElement('div')
  headSide.className = 'mtableHeadSide'
  headSide.dataset.testid = 'mtable-head-side'
  headSide.append(headStar)
  head.append(headLeft, headCtl, headSide)

  // Лайк и полный состав в узкой шапке не влезают (320px: 24 паддинга + 20
  // gap'ов + лайк 44 + пара 98 + текст 225 = 411 > 320 — физически не влезает,
  // резать состав/пару нельзя). Grid держит правой трети её min-content
  // (44 под лайк), остаток уходит в левую: пока остаток ≥ 44 — лайк ровно у
  // правого паддинга, но центр (пара) смещается влево на половину разницы;
  // когда остаток кончается — лайк вылезает за контент-бокс и скрывается
  // (тогда пара снова по центру, h-scroll нет — у .mtable overflow: clip).
  // На пустом столе, после «Убрать все» и на 390/768 (в т.ч. с полным
  // составом) — лайк всегда на месте; ссылка на репо в шторке живёт всегда.
  const fitHeadStar = (): void => {
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
    // Фоновая музыка (2.22) — привилегия: она ближе всех к паре и уступает
    // первой (атмосфера), звук броска — второй (нужен для игры), Star — третий.
    let m = measure()
    const mus = musicBtn.getBoundingClientRect()
    if (mus.right > m.ctl.left - 1 || m.ctl.right > m.hr.right - m.padR + 1) musicBtn.hidden = true
    // Звук слева: пока пара «+»/бургер упирается в правый контент-бокс —
    // звук виноват в сдвиге (на 320 с полным составом левая колонка выталкивает
    // центр за экран) → прячем (звук дублируется пунктом в бургере).
    m = measure()
    const snd = soundBtn.getBoundingClientRect()
    if (snd.right > m.ctl.left - 1 || m.ctl.right > m.hr.right - m.padR + 1) soundBtn.hidden = true
    // Ряд Star справа: правее пары и внутри контент-бокса (320/390 с полным
    // составом ряд широкий — уступает, ссылка остаётся в шторке).
    m = measure()
    const sr = headStar.getBoundingClientRect()
    headStar.hidden =
      sr.left < m.ctl.right + 1 ||
      sr.right > m.hr.right - m.padR + 1 ||
      sr.left < m.hr.left + m.padL + 1
  }

  const applyCounts = (counts: TableCounts) => {
    setup.clear()
    for (const die of DIE_IDS) {
      const n = counts[die] ?? 0
      if (n > 0) setup.setCount(die, n)
    }
  }
  const sameCounts = (a: TableCounts, b: TableCounts): boolean =>
    DIE_IDS.every((die) => (a[die] ?? 0) === (b[die] ?? 0))

  // Хинт-empty-state: центрированная композиция на свободном центре экрана
  // (костей нет — центр пуст). Весь блок — кнопка → шторка; внутри глифы +
  // заголовок + подстрока + CTA «+ Кости» + тихая инфо-строка о приложении.
  // Состояния: пусто / грузится (disabled, статус) / ошибка — см. refreshChrome.
  const hint = document.createElement('button')
  hint.className = 'mtableHint'
  hint.dataset.testid = 'mtable-hint'
  hint.type = 'button'
  hint.hidden = true
  hint.addEventListener('click', () => openSheet())
  const hintGlyph = document.createElement('span')
  hintGlyph.className = 'mtableHintGlyph'
  hintGlyph.dataset.testid = 'mtable-hint-glyph'
  hintGlyph.setAttribute('aria-hidden', 'true')
  hintGlyph.innerHTML = dieGlyph('d4') + dieGlyph('d6') + dieGlyph('d20')
  const hintTitle = document.createElement('span')
  hintTitle.className = 'mtableHintTitle'
  hintTitle.dataset.testid = 'mtable-hint-title'
  const hintSub = document.createElement('span')
  hintSub.className = 'mtableHintSub'
  hintSub.dataset.testid = 'mtable-hint-sub'
  const hintCta = document.createElement('span')
  hintCta.className = 'mtableHintCta'
  hintCta.dataset.testid = 'mtable-hint-cta'
  // Простой «+» — та же геометрия и svg, что у кнопки набора в шапке (addIcon(),
  // слот 24px → 21px здесь), без текста: слов «Кости» и так хватает в заголовке
  // и подстроке, а сам плюс рифмуется с шапкой. Плашки-кружка нет — акцент даёт
  // цвет линии, контурную пилюлю — рамка.
  hintCta.innerHTML = addIcon()
  // Слот под монетизацию: тихая строка о приложении. Сейчас — только текст;
  // позже сюда встанет баннер/ссылка (для ссылки элемент выносят из кнопки —
  // <a> внутри <button> недопустим; обёртка и позиция блока не меняются).
  const hintInfo = document.createElement('span')
  hintInfo.className = 'mtableHintInfo'
  hintInfo.dataset.testid = 'mtable-hint-info'
  hintInfo.textContent = 'Kubica — стол для бросков костей'
  hint.append(hintGlyph, hintTitle, hintSub, hintCta, hintInfo)

  // Итог броска визуально нигде (суммы — по граням, история — в меню):
  // для скринридера — невидимый живой регион (бывший aria-live на кнопке).
  const live = document.createElement('div')
  live.className = 'mtableLive'
  live.dataset.testid = 'mtable-live'
  live.setAttribute('role', 'status')

  // Футер: только разбивка пробелами; только чтение (тапы летят сквозь него),
  // скринридеру итог — живой регион. Сумма — на бургере сверху (минимализм).
  const foot = document.createElement('div')
  foot.className = 'mtableFoot'
  foot.dataset.testid = 'mtable-foot'
  foot.hidden = true
  foot.setAttribute('aria-hidden', 'true')
  const footParts = document.createElement('span')
  footParts.className = 'mtableFootParts'
  footParts.dataset.testid = 'mtable-foot-parts'
  foot.appendChild(footParts)

  const backdrop = document.createElement('div')
  backdrop.className = 'mtableBackdrop'
  backdrop.dataset.testid = 'mtable-backdrop'
  backdrop.hidden = true

  // --- Шторка «+ Кости» ---
  const sheet = document.createElement('div')
  sheet.className = 'mtableSheet'
  sheet.dataset.testid = 'mtable-sheet'
  sheet.hidden = true
  const sheetHead = document.createElement('div')
  sheetHead.className = 'mtableSheetHead'
  sheetHead.dataset.testid = 'mtable-sheet-head'
  const sheetTitle = document.createElement('span')
  sheetTitle.textContent = 'Выбор костей'
  const sheetClear = document.createElement('button')
  sheetClear.className = 'mtableIcon mtableSheetClear'
  sheetClear.dataset.testid = 'mtable-sheet-clear'
  sheetClear.type = 'button'
  sheetClear.innerHTML = clearAllIcon()
  sheetClear.title = 'Убрать все'
  sheetClear.setAttribute('aria-label', 'Убрать все')
  sheetClear.addEventListener('click', () => {
    activeSet = null
    setup.clear()
    renderPresets()
  })
  const sheetClose = document.createElement('button')
  sheetClose.className = 'mtableIcon'
  sheetClose.dataset.testid = 'mtable-sheet-close'
  sheetClose.type = 'button'
  sheetClose.innerHTML = closeIcon()
  sheetClose.setAttribute('aria-label', 'Закрыть выбор костей')
  sheetHead.append(sheetTitle, sheetClear, sheetClose)
  const rows = document.createElement('div')
  const rowCounts = new Map<DieId, HTMLSpanElement>()
  const rowRoots = new Map<DieId, HTMLElement>()
  for (const die of DIE_IDS) {
    const row = document.createElement('div')
    row.className = 'mtableRow'
    row.dataset.testid = 'mtable-row'
    const glyph = document.createElement('span')
    glyph.className = 'mtableGlyph'
    glyph.dataset.testid = 'mtable-glyph'
    glyph.innerHTML = dieGlyph(die)
    const nm = document.createElement('span')
    nm.className = 'mtableName'
    nm.dataset.testid = 'mtable-name'
    nm.textContent = die
    const ds = document.createElement('span')
    ds.className = 'mtableDesc'
    ds.dataset.testid = 'mtable-desc'
    ds.textContent = DIE_HINTS[die]
    const minus = document.createElement('button')
    minus.className = 'mtableStep'
    minus.dataset.testid = 'mtable-step-minus'
    minus.type = 'button'
    minus.textContent = '−'
    minus.setAttribute('aria-label', `Убрать ${die}`)
    minus.addEventListener('click', () => setup.add(die, -1))
    const count = document.createElement('span')
    count.className = 'mtableN'
    count.dataset.testid = 'mtable-step-count'
    count.textContent = '0'
    const plus = document.createElement('button')
    plus.className = 'mtableStep'
    plus.dataset.testid = 'mtable-step-plus'
    plus.type = 'button'
    plus.textContent = '+'
    plus.setAttribute('aria-label', `Добавить ${die}`)
    plus.addEventListener('click', () => setup.add(die, 1))
    row.append(glyph, nm, ds, minus, count, plus)
    rows.appendChild(row)
    rowCounts.set(die, count)
    rowRoots.set(die, row)
  }

  // --- Бургер-меню ---
  const drawer = document.createElement('div')
  drawer.className = 'mtableDrawer'
  drawer.dataset.testid = 'mtable-drawer'
  drawer.hidden = true
  const drawerHead = document.createElement('div')
  drawerHead.className = 'mtableSheetHead'
  drawerHead.dataset.testid = 'mtable-drawer-head'
  const drawerTitle = document.createElement('span')
  drawerTitle.textContent = 'Меню'
  const drawerClose = document.createElement('button')
  drawerClose.className = 'mtableIcon'
  drawerClose.dataset.testid = 'mtable-drawer-close'
  drawerClose.type = 'button'
  drawerClose.innerHTML = closeIcon()
  drawerClose.setAttribute('aria-label', 'Закрыть меню')
  drawerHead.append(drawerTitle, drawerClose)
  const drawerBody = document.createElement('div')
  drawerBody.className = 'mtableDrawerBody'
  drawerBody.dataset.testid = 'mtable-drawer-body'

  const histSection = document.createElement('div')
  histSection.className = 'mtableSection'
  histSection.dataset.testid = 'mtable-history-section'
  const histHead = document.createElement('div')
  histHead.className = 'mtableSectionHead'
  histHead.dataset.testid = 'mtable-history-head'
  const histTitle = document.createElement('span')
  histTitle.textContent = 'История'
  const histClear = document.createElement('button')
  histClear.className = 'mtableLink'
  histClear.dataset.testid = 'mtable-link'
  histClear.type = 'button'
  histClear.textContent = 'Очистить'
  // Двухтап вместо confirm: первый тап взводит, второй — чистит.
  let clearArmed = false
  let clearTimer = 0
  histClear.addEventListener('click', () => {
    if (!clearArmed) {
      clearArmed = true
      histClear.textContent = 'Точно?'
      clearTimer = window.setTimeout(() => {
        clearArmed = false
        histClear.textContent = 'Очистить'
      }, 3000)
      return
    }
    window.clearTimeout(clearTimer)
    clearArmed = false
    histClear.textContent = 'Очистить'
    history.clear()
  })
  histHead.append(histTitle, histClear)
  const histList = document.createElement('div')
  histList.className = 'mtableHist'
  histList.dataset.testid = 'mtable-hist'
  histSection.append(histHead, histList)

  // --- Пресеты в шторке: сверху быстрые наборы, ниже свои; чипы — только
  // состав костями (без подписей), тап применяет, удержание 3 с удаляет. ---
  const toast = document.createElement('div')
  toast.className = 'mtableToast'
  toast.dataset.testid = 'mtable-toast'
  toast.hidden = true
  let toastTimer = 0
  const showToast = (msg: string): void => {
    toast.textContent = msg
    toast.hidden = false
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      toast.hidden = true
    }, 2200)
  }

  const preBlock = document.createElement('div')
  preBlock.className = 'mtablePreBlock'
  preBlock.dataset.testid = 'mtable-pre-block'
  const fastCap = document.createElement('span')
  fastCap.className = 'mtablePreCap'
  fastCap.dataset.testid = 'mtable-fast-cap'
  fastCap.textContent = 'Быстрые'
  const fastList = document.createElement('div')
  fastList.className = 'mtableSets mtableFast'
  fastList.dataset.testid = 'mtable-fast'
  const mineCap = document.createElement('span')
  mineCap.className = 'mtablePreCap'
  mineCap.dataset.testid = 'mtable-mine-cap'
  mineCap.textContent = 'Мои'
  const mineList = document.createElement('div')
  mineList.className = 'mtableSets mtableMine'
  mineList.dataset.testid = 'mtable-mine'
  const preHint = document.createElement('p')
  preHint.className = 'mtablePreHint'
  preHint.dataset.testid = 'mtable-pre-hint'
  preHint.textContent = 'Тап — набор · удерживай 3 с — удалить'
  const preEmpty = document.createElement('p')
  preEmpty.className = 'mtableEmpty'
  preEmpty.dataset.testid = 'mtable-preset-empty'
  preEmpty.textContent = 'Пока нет — набери кости и жми «Сохранить сет»'
  preEmpty.hidden = true
  preBlock.append(fastCap, fastList, mineCap, mineList, preHint, preEmpty)

  // Выделенный сет: «Сохранить» перезаписывает его; без выделения — создаёт новый.
  let activeSet: string | null = null
  let chipEls: HTMLButtonElement[] = []
  const BUILT_IN_NAMES = new Set(BUILT_IN_PRESETS.map((p) => p.name))

  /** Отображаемые наборы: встроенные (с учётом своих переопределений) + свои. */
  const displaySets = (): {
    fast: Array<{ name: string; counts: TableCounts }>
    mine: Array<{ name: string; counts: TableCounts }>
  } => {
    const customs = loadCustomPresets()
    const hidden = new Set(loadHiddenBuiltIns())
    const shadow = new Map(
      customs.filter((p) => BUILT_IN_NAMES.has(p.name)).map((p) => [p.name, p.counts]),
    )
    const fast = BUILT_IN_PRESETS.filter((p) => !hidden.has(p.name)).map((p) => ({
      name: p.name,
      counts: shadow.get(p.name) ?? p.counts,
    }))
    const mine = customs
      .filter((p) => !BUILT_IN_NAMES.has(p.name))
      .map((p) => ({ name: p.name, counts: p.counts }))
    return { fast, mine }
  }

  /**
   * Чип: тап — выбор; удаление — удержание. Перед отсчётом пауза (нажатие не
   * запускает таймер), затем отсчёт 3 с — отпустил в паузе, это тап.
   */
  const HOLD_MS = 3000
  const HOLD_GRACE_MS = 1000
  let holdFired = false

  const deleteSet = (name: string): void => {
    deleteCustomPreset(name)
    if (BUILT_IN_NAMES.has(name)) hideBuiltIn(name)
    if (activeSet === name) activeSet = null
    vibrate(35)
    showToast('Набор удалён')
    renderPresets()
    refreshChrome(setup.get())
  }

  const toggleSelect = (name: string, counts: TableCounts): void => {
    if (activeSet === name) {
      activeSet = null
    } else {
      activeSet = name
      applyCounts(counts)
    }
    renderPresets()
    refreshChrome(setup.get())
  }

  const makeChip = (name: string, counts: TableCounts): HTMLButtonElement => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'mtableChip'
    btn.dataset.testid = 'mtable-chip'
    btn.dataset.set = name
    const label = shortSet(counts)
    btn.title = label
    btn.setAttribute('aria-label', `Набор: ${label}`)
    btn.classList.toggle('on', activeSet === name)
    btn.setAttribute('aria-pressed', String(activeSet === name))
    const fill = document.createElement('span')
    fill.className = 'mtableChipFill'
    fill.dataset.testid = 'mtable-chip-fill'
    const dice = document.createElement('span')
    dice.className = 'mtableChipDice'
    dice.dataset.testid = 'mtable-chip-dice'
    for (const die of DIE_IDS) {
      const n = counts[die] ?? 0
      if (n <= 0) continue
      const g = document.createElement('span')
      g.className = 'mtableChipDie'
      g.dataset.testid = 'mtable-chip-die'
      g.innerHTML = dieGlyph(die)
      if (n > 1) {
        const x = document.createElement('span')
        x.className = 'mtableChipN'
        x.dataset.testid = 'mtable-chip-n'
        x.textContent = `×${n}`
        g.appendChild(x)
      }
      dice.appendChild(g)
    }
    const count = document.createElement('span')
    count.className = 'mtableChipCount'
    count.dataset.testid = 'mtable-chip-count'
    count.setAttribute('aria-hidden', 'true')
    count.textContent = '3'
    btn.append(fill, dice, count)

    let raf = 0
    let startAt = 0
    const endHold = (): void => {
      cancelAnimationFrame(raf)
      btn.classList.remove('holding')
      fill.style.width = '0%'
    }
    btn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      startAt = performance.now()
      btn.classList.add('holding')
      count.textContent = ''
      try {
        btn.setPointerCapture(e.pointerId)
      } catch {
        // синтетические события (тесты) — живём без захвата
      }
      const tick = (): void => {
        const el = performance.now() - startAt
        if (el < HOLD_GRACE_MS) {
          raf = requestAnimationFrame(tick)
          return
        }
        const p = Math.min(1, (el - HOLD_GRACE_MS) / HOLD_MS)
        fill.style.width = `${(p * 100).toFixed(1)}%`
        count.textContent = String(Math.max(1, Math.ceil((1 - p) * (HOLD_MS / 1000))))
        if (p >= 1) {
          endHold()
          holdFired = true
          window.setTimeout(() => {
            holdFired = false
          }, 600)
          deleteSet(name)
          return
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })
    btn.addEventListener('pointerup', endHold)
    btn.addEventListener('pointercancel', endHold)
    btn.addEventListener('click', () => {
      if (holdFired) return
      toggleSelect(name, counts)
    })
    btn.addEventListener('contextmenu', (e) => e.preventDefault())
    return btn
  }

  const renderPresets = (): void => {
    const { fast, mine } = displaySets()
    fastList.innerHTML = ''
    mineList.innerHTML = ''
    chipEls = []
    for (const s of fast) {
      const c = makeChip(s.name, s.counts)
      fastList.appendChild(c)
      chipEls.push(c)
    }
    for (const s of mine) {
      const c = makeChip(s.name, s.counts)
      mineList.appendChild(c)
      chipEls.push(c)
    }
    fastCap.hidden = fast.length === 0
    mineCap.hidden = mine.length === 0
    mineList.hidden = mine.length === 0
    preEmpty.hidden = fast.length + mine.length > 0
  }

  // Одна кнопка сохранения: выделенный сет — перезапись, без выделения — новый.
  const saveRow = document.createElement('div')
  saveRow.className = 'mtableFormulaRow'
  saveRow.dataset.testid = 'mtable-formula-row'
  const saveBtn = document.createElement('button')
  saveBtn.className = 'mtableOk'
  saveBtn.dataset.testid = 'mtable-ok'
  saveBtn.type = 'button'
  saveBtn.textContent = 'Сохранить сет'
  saveRow.appendChild(saveBtn)
  saveBtn.addEventListener('click', () => {
    const counts = setup.get()
    if (rolling || totalCount(counts) === 0) return
    if (activeSet) {
      saveCustomPreset(activeSet, counts)
      showToast('Набор обновлён')
    } else {
      const { fast, mine } = displaySets()
      const dup = [...fast, ...mine].find((s) => sameCounts(s.counts, counts))
      if (dup) {
        activeSet = dup.name
        showToast('Такой набор уже есть')
      } else {
        const name = uniquePresetName(loadCustomPresets())
        saveCustomPreset(name, counts)
        activeSet = name
        showToast('Набор сохранён')
      }
    }
    vibrate(15)
    renderPresets()
    refreshChrome(setup.get())
  })

  const sheetBody = document.createElement('div')
  sheetBody.className = 'mtableRows'
  sheetBody.dataset.testid = 'mtable-rows'
  sheetBody.append(preBlock, rows, saveRow)
  sheet.append(sheetHead, sheetBody)

  const sndSection = document.createElement('div')
  sndSection.className = 'mtableSection'
  sndSection.dataset.testid = 'mtable-sound-section'
  const sndTitle = document.createElement('span')
  sndTitle.className = 'mtableSectionTitle'
  sndTitle.dataset.testid = 'mtable-sound-title'
  sndTitle.textContent = 'Звук и вибрация'
  const sndToggle = document.createElement('button')
  sndToggle.className = 'mtableWide'
  sndToggle.dataset.testid = 'mtable-sound-toggle'
  sndToggle.type = 'button'
  const syncDrawerSound = () => {
    sndToggle.innerHTML = `${soundIcon(isMuted())}<span>${
      isMuted() ? 'Включить звук' : 'Выключить звук'
    }</span>`
  }
  syncDrawerSound()
  sndToggle.addEventListener('click', () => {
    setMuted(!isMuted())
    syncSound()
    syncDrawerSound()
  })
  const hapToggle = document.createElement('button')
  hapToggle.className = 'mtableWide'
  hapToggle.dataset.testid = 'mtable-haptic-toggle'
  hapToggle.type = 'button'
  const syncHaptics = () => {
    hapToggle.innerHTML = `${vibrationIcon()}<span>${
      hapticsEnabled() ? 'Выключить вибрацию' : 'Включить вибрацию'
    }</span>`
  }
  syncHaptics()
  hapToggle.addEventListener('click', () => {
    setHaptics(!hapticsEnabled())
    syncHaptics()
  })
  // Пункт «Фоновая музыка» в меню: на ≤360 кнопка шапки уходит по fitHeadStar
  // (приоритет music→sound→star) — вход в карточку иначе недостижим. Дубль со
  // шапкой принят: тап, как и по шапке (2.23), — открыть карточку, не тоггл; она
  // сама спрячет дровер (openMusicCard). Стейт рисуем общим musicEntry.
  const musRow = document.createElement('button')
  musRow.className = 'mtableWide'
  musRow.dataset.testid = 'mtable-drawer-music'
  musRow.type = 'button'
  musRow.setAttribute('aria-haspopup', 'dialog')
  const syncDrawerMusic = (): void => {
    const { unavail, on } = musicEntry()
    musRow.innerHTML = `${musicIcon(on)}<span>Фоновая музыка</span>`
    musRow.classList.toggle('on', on)
    // Как у кнопки шапки: aria-disabled + причина в label; тап всё равно
    // открывает карточку — там объяснение и disabled-тоггл.
    if (unavail) {
      musRow.setAttribute('aria-disabled', 'true')
      musRow.setAttribute('aria-label', 'Фоновая музыка недоступна: нет доступа к YouTube')
    } else {
      musRow.removeAttribute('aria-disabled')
      musRow.setAttribute('aria-label', 'Фоновая музыка')
    }
  }
  syncDrawerMusic()
  // openMusicCard объявляется ниже (блок оверлеев) — вызов только по клику,
  // после монтирования, поэтому ссылка в замыкании безопасна (как у musicBtn).
  musRow.addEventListener('click', () => openMusicCard())
  sndSection.append(sndTitle, sndToggle, hapToggle, musRow)

  // 2.23: отдельное меню музыки — карточка-модалка (3-й оверлей по образцу
  // шита/дровера, форма по ресёрчу tasks/mvp-2/2.23). Секция переехала сюда из
  // бургера — один источник управления. Хост iframe остаётся в DOM навсегда:
  // при закрытой карточке он display:none, а iframe продолжает играть — так
  // «настоящий» плеер YouTube (реклама, consent, ручные кнопки) доступен по
  // открытию меню, а шапка остаётся чистым входом (контракт 2.22).
  const musicCard = document.createElement('div')
  musicCard.className = 'mtableMusicCard'
  musicCard.dataset.testid = 'mtable-music-card'
  musicCard.hidden = true
  musicCard.setAttribute('role', 'dialog')
  musicCard.setAttribute('aria-label', 'Фоновая музыка')
  const musicCardHead = document.createElement('div')
  musicCardHead.className = 'mtableSheetHead'
  musicCardHead.dataset.testid = 'mtable-music-card-head'
  const musicCardTitle = document.createElement('span')
  musicCardTitle.dataset.testid = 'mtable-music-card-title'
  musicCardTitle.textContent = 'Фоновая музыка'
  const musicClose = document.createElement('button')
  musicClose.className = 'mtableIcon'
  musicClose.dataset.testid = 'mtable-music-close'
  musicClose.type = 'button'
  musicClose.innerHTML = closeIcon()
  musicClose.setAttribute('aria-label', 'Закрыть фоновую музыку')
  musicCardHead.append(musicCardTitle, musicClose)
  const musicCardBody = document.createElement('div')
  musicCardBody.className = 'mtableRows'
  musicCardBody.dataset.testid = 'mtable-music-card-body'
  const musSection = document.createElement('div')
  musSection.className = 'mtableSection'
  musSection.dataset.testid = 'mtable-music-section'
  const musHint = document.createElement('p')
  musHint.className = 'mtableSectionHint'
  musHint.dataset.testid = 'mtable-music-hint'
  musHint.textContent = 'Играет с YouTube: нужна сеть, реклама возможна'
  const musToggle = document.createElement('button')
  musToggle.className = 'mtableWide'
  musToggle.dataset.testid = 'mtable-music-toggle'
  musToggle.type = 'button'
  const syncCardMusic = (): void => {
    const unavail = musicAvail() === 'unavailable'
    const s = musicState()
    const on = s === 'playing' && !unavail
    const text = unavail
      ? 'Нет доступа к YouTube'
      : s === 'loading'
        ? 'Загружаю…'
        : s === 'paused'
          ? 'Продолжить фон'
          : on
            ? 'Выключить фон'
            : 'Включить фон'
    musToggle.innerHTML = `${musicIcon(on)}<span>${text}</span>`
    musToggle.classList.toggle('on', on)
    musToggle.setAttribute('aria-pressed', String(on))
    musToggle.toggleAttribute('aria-busy', !unavail && s === 'loading')
    // aria-disabled (не нативный disabled): кнопка остаётся в порядке Tab,
    // скринридер озвучивает причину, тап и так гасится guard'ом в musicToggle.
    if (unavail) musToggle.setAttribute('aria-disabled', 'true')
    else musToggle.removeAttribute('aria-disabled')
    musHint.textContent = unavail
      ? 'Нет доступа к YouTube — фон недоступен'
      : 'Играет с YouTube: нужна сеть, реклама возможна'
  }
  syncCardMusic()
  // musicHost (ниже по секции) создаётся раньше первого клика — замыкание.
  musToggle.addEventListener('click', () => musicToggle(musicHost))
  const musVolRow = document.createElement('div')
  musVolRow.className = 'mtableMusicVolRow'
  musVolRow.dataset.testid = 'mtable-music-vol-row'
  const musVol = document.createElement('input')
  musVol.className = 'mtableMusicVol'
  musVol.dataset.testid = 'mtable-music-volume'
  musVol.type = 'range'
  musVol.min = '0'
  musVol.max = '100'
  musVol.step = '5'
  musVol.value = String(musicVolume())
  musVol.setAttribute('aria-label', 'Громкость фона')
  const musVolVal = document.createElement('span')
  musVolVal.className = 'mtableMusicVolVal'
  musVolVal.dataset.testid = 'mtable-music-vol-val'
  musVolVal.textContent = String(musicVolume())
  musVol.addEventListener('input', () => {
    setMusicVolume(Number(musVol.value))
    musVolVal.textContent = musVol.value
  })
  musVolRow.append(musVol, musVolVal)
  const musicHost = document.createElement('div')
  musicHost.className = 'mtableMusicHost'
  musicHost.dataset.testid = 'mtable-music-player'
  musSection.append(musToggle, musVolRow, musicHost, musHint)
  musicCardBody.append(musSection)
  musicCard.append(musicCardHead, musicCardBody)

  // Масштаб интерфейса (2.20): шаги 100–200%, живое применение + персист.
  const scaleSection = document.createElement('div')
  scaleSection.className = 'mtableSection'
  scaleSection.dataset.testid = 'mtable-scale-section'
  const scaleTitle = document.createElement('span')
  scaleTitle.className = 'mtableSectionTitle'
  scaleTitle.dataset.testid = 'mtable-scale-title'
  scaleTitle.textContent = 'Масштаб интерфейса'
  const scaleRow = document.createElement('div')
  scaleRow.className = 'mtableScaleRow'
  scaleRow.dataset.testid = 'mtable-scale-row'
  const scaleBtns: HTMLButtonElement[] = UI_SCALES.map((s) => {
    const pct = Math.round(s * 100)
    const b = document.createElement('button')
    b.className = 'mtableScale'
    b.dataset.testid = 'mtable-scale'
    b.type = 'button'
    b.textContent = `${pct}%`
    b.setAttribute('aria-label', `Масштаб интерфейса ${pct}%`)
    b.addEventListener('click', () => {
      setUiScale(s)
      syncScale()
      // Шапка (fitHeadStar) меряет реальные боксы — пересчёт под масштаб.
      refreshChrome(setup.get())
      showToast(`Масштаб ${pct}%`)
      vibrate(15)
    })
    scaleRow.appendChild(b)
    return b
  })
  const syncScale = (): void => {
    const cur = uiScale()
    scaleBtns.forEach((b, i) => {
      const on = UI_SCALES[i] === cur
      b.classList.toggle('on', on)
      b.setAttribute('aria-pressed', String(on))
    })
  }
  syncScale()
  scaleSection.append(scaleTitle, scaleRow)

  // Сила броска: режим меню (boost 0/0.5/1) складывается с зарядом удержания
  // и фликом релиза (cap 1.6 — см. fireThrow); тап-удержание ≥3 с и есть бросок.
  const pwSection = document.createElement('div')
  pwSection.className = 'mtableSection'
  pwSection.dataset.testid = 'mtable-power-section'
  const pwTitle = document.createElement('span')
  pwTitle.className = 'mtableSectionTitle'
  pwTitle.dataset.testid = 'mtable-power-title'
  pwTitle.textContent = 'Сила броска'
  const pwBtns: HTMLButtonElement[] = THROW_POWERS.map((p) => {
    const b = document.createElement('button')
    b.className = 'mtableWide'
    b.dataset.testid = 'mtable-wide'
    b.type = 'button'
    b.textContent = p.name
    b.addEventListener('click', () => {
      setThrowPower(p.mode)
      syncPower()
    })
    return b
  })
  const pwHint = document.createElement('p')
  pwHint.className = 'mtableSectionHint'
  pwHint.dataset.testid = 'mtable-power-hint'
  pwHint.textContent = 'Кость заряжается удержанием 3–5 с — сильнее бросок (и флик при отпускании)'
  pwSection.append(pwTitle, ...pwBtns, pwHint)
  const syncPower = (): void => {
    const cur = throwPower()
    pwBtns.forEach((b, i) => b.classList.toggle('on', THROW_POWERS[i].mode === cur))
  }
  syncPower()

  const aboutSection = document.createElement('div')
  aboutSection.className = 'mtableSection'
  aboutSection.dataset.testid = 'mtable-about-section'
  const aboutTitle = document.createElement('span')
  aboutTitle.className = 'mtableSectionTitle'
  aboutTitle.dataset.testid = 'mtable-about-title'
  aboutTitle.textContent = 'О проекте'
  const aboutText = document.createElement('p')
  aboutText.className = 'mtableAbout'
  aboutText.dataset.testid = 'mtable-about'
  aboutText.textContent =
    'Kubica — точные кости D&D: d6 16 мм, набор d4–d20, грани N+1, честная физика. FreeCAD · OpenSCAD · CadQuery → Blender → three.js.'
  aboutSection.append(aboutTitle, aboutText)

  // --- Соцсети (2.17): ссылки в шторке + лайк в шапке (см. headStar) ---
  // Постоянные ссылки (GitHub/Telegram) + лайкалка — строка-ссылка на репо.
  // Внешние: target=_blank + rel=noopener noreferrer, строка ≥44, aria-метка
  // проговаривает назначение и то, что вкладка откроется новая.
  const socialSection = document.createElement('div')
  socialSection.className = 'mtableSection'
  socialSection.dataset.testid = 'mtable-social-section'
  const socialTitle = document.createElement('span')
  socialTitle.className = 'mtableSectionTitle'
  socialTitle.dataset.testid = 'mtable-social-title'
  socialTitle.textContent = 'Соцсети'

  /** Строка-ссылка: иконка + подпись + мета справа (хэндл или счётчик). */
  const socialLink = (
    icon: string,
    name: string,
    meta: string,
    href: string,
    aria: string,
  ): HTMLAnchorElement => {
    const a = document.createElement('a')
    a.className = 'mtableSocial'
    a.dataset.testid = 'mtable-social'
    a.href = href
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.innerHTML = icon
    const label = document.createElement('span')
    label.className = 'mtableSocialName'
    label.textContent = name
    const sub = document.createElement('span')
    sub.className = 'mtableSocialMeta'
    sub.textContent = meta
    a.append(label, sub)
    a.setAttribute('aria-label', `${aria} (откроется в новой вкладке)`)
    return a
  }

  const ghLink = socialLink(
    githubIcon(),
    'GitHub',
    '@DomovikX',
    'https://github.com/DomovikX',
    'Профиль GitHub DomovikX',
  )
  const tgLink = socialLink(
    telegramIcon(),
    'Telegram',
    '@Domovikx',
    'https://t.me/Domovikx',
    'Канал Domovikx в Telegram',
  )

  // Лайкалка: ссылка на репозиторий проекта; счётчик звёзд — опциональный
  // (см. stars.ts): при отсутствии сети/лимите API и при 0 — просто скрыт,
  // не спиннер.
  const starLink = document.createElement('a')
  starLink.className = 'mtableSocial mtableStar'
  starLink.dataset.testid = 'mtable-star'
  starLink.href = 'https://github.com/Domovikx/kubica'
  starLink.target = '_blank'
  starLink.rel = 'noopener noreferrer'
  starLink.innerHTML = likeIcon()
  const starName = document.createElement('span')
  starName.className = 'mtableSocialName'
  starName.textContent = 'Оценить репозиторий'
  const starCount = document.createElement('span')
  starCount.className = 'mtableSocialMeta'
  starCount.dataset.testid = 'star-count'
  starCount.hidden = true
  starLink.append(starName, starCount)

  // Счётчик звёзд (кэш localStorage на сутки + GitHub API без токена,
  // тихая деградация) — в stars.ts, сюда только связка двух узлов.
  const stars = createStarCounter({
    headLink: headStar,
    headCount: headStarCount,
    menuLink: starLink,
    menuCount: starCount,
  })
  stars.load()

  socialSection.append(socialTitle, ghLink, tgLink, starLink)

  drawerBody.append(histSection, pwSection, sndSection, scaleSection, aboutSection, socialSection)
  drawer.append(drawerHead, drawerBody)

  // Перерисовка обоих входов музыки от стейт-машины + тосты на разовые
  // сообщения (нет сети / нужен повторный тап / ошибка эмбеда).
  const unsubMusic = onMusicChange(() => {
    syncMusic()
    syncCardMusic()
    syncDrawerMusic()
  })
  const unsubMusicNotice = onMusicNotice((n) => {
    showToast(
      n === 'offline'
        ? 'Нет сети — музыка недоступна'
        : n === 'blocked'
          ? 'Нажми ещё раз'
          : 'Не удалось запустить музыку',
    )
  })

  section.append(
    watermark.el,
    canvas,
    head,
    foot,
    hint,
    live,
    backdrop,
    sheet,
    drawer,
    musicCard,
    toast,
  )
  requestAnimationFrame(watermark.fit)
  document.fonts?.ready.then(watermark.fit).catch(() => {})

  container.appendChild(section)

  // Доступность YouTube (2.22): ранняя проба ТОГО ЖЕ ленивого скрипта API —
  // до первого тапа кнопки уже знают, есть ли смысл их нажимать; недоступно →
  // aria-disabled + объяснение (см. syncMusic). Повтор — когда сеть вернулась.
  const onNetBack = (): void => {
    if (musicAvail() !== 'ok') void probeMusic()
  }
  window.addEventListener('online', onNetBack)
  void probeMusic()

  // 2.24 (tasks/mvp-2/2.24): после изменения внутри меню крестик закрытия морфится
  // в ✓ «Готово» — чистый сигнал (всё live, откатывать нечего: NN/g/Etsy «Done»);
  // backdrop/Escape — обычный dismiss. Открытие меню сбрасывает dirty-флаг.
  const morphClose = (btn: HTMLButtonElement, restLabel: string) => {
    let dirty = false
    const set = (icon: string, label: string, on: boolean): void => {
      btn.innerHTML = icon
      btn.setAttribute('aria-label', label)
      btn.title = label
      btn.classList.toggle('mtableMorph', on)
    }
    return {
      rest: (): void => {
        dirty = false
        set(closeIcon(), restLabel, false)
      },
      mark: (): void => {
        if (dirty) return
        dirty = true
        set(checkIcon(), 'Готово', true)
      },
    }
  }
  const sheetMorph = morphClose(sheetClose, 'Закрыть выбор костей')
  const drawerMorph = morphClose(drawerClose, 'Закрыть меню')
  // Грязное = тап по контролу (кнопка/инпут, кроме самого крестика и ссылок) либо
  // input со слайдера; тап по статичному тексту/заголовку — не меняет меню.
  const wireDirty = (panel: HTMLElement, own: HTMLButtonElement, mark: () => void): void => {
    panel.addEventListener('click', (e) => {
      const t = e.target
      if (!(t instanceof Element)) return
      if (t.closest('a') || t.closest('button') === own) return
      if (t.closest('button') || t.closest('input')) mark()
    })
    panel.addEventListener('input', mark)
  }
  wireDirty(sheet, sheetClose, sheetMorph.mark)
  wireDirty(drawer, drawerClose, drawerMorph.mark)
  const musicMorph = morphClose(musicClose, 'Закрыть фоновую музыку')
  wireDirty(musicCard, musicClose, musicMorph.mark)

  const openSheet = () => {
    drawer.hidden = true
    musicCard.hidden = true
    sheet.hidden = false
    backdrop.hidden = false
    section.classList.add('sheetOpen')
    renderPresets()
    sheetMorph.rest()
    sheetClose.focus()
  }
  const openDrawer = () => {
    sheet.hidden = true
    musicCard.hidden = true
    drawer.hidden = false
    backdrop.hidden = false
    // Счётчик звёзд тянем лениво — при первом открытии меню (см. stars.ts).
    stars.load()
    drawerMorph.rest()
    drawerClose.focus()
  }
  // 2.23: вход по кнопке mtable-music — карточка музыки (aria-haspopup=dialog;
  // открывается и при недоступном YouTube — там же объяснение и disabled-тоггл).
  const openMusicCard = () => {
    sheet.hidden = true
    drawer.hidden = true
    musicCard.hidden = false
    backdrop.hidden = false
    section.classList.add('sheetOpen')
    musicMorph.rest()
    musicClose.focus()
  }
  const closeOverlays = () => {
    sheet.hidden = true
    drawer.hidden = true
    musicCard.hidden = true
    backdrop.hidden = true
    section.classList.remove('sheetOpen')
  }
  // Esc закрывает шит/меню (фокус-минимум без полного trap).
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeOverlays()
  }
  document.addEventListener('keydown', onKey)
  diceBtn.addEventListener('click', () => (sheet.hidden ? openSheet() : closeOverlays()))
  burger.addEventListener('click', () => (drawer.hidden ? openDrawer() : closeOverlays()))
  sheetClose.addEventListener('click', closeOverlays)
  drawerClose.addEventListener('click', closeOverlays)
  musicClose.addEventListener('click', closeOverlays)
  backdrop.addEventListener('click', closeOverlays)

  const renderHistory = (entries: readonly HistoryEntry[]) => {
    histList.innerHTML = ''
    if (entries.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'mtableEmpty'
      empty.dataset.testid = 'mtable-history-empty'
      empty.textContent = 'Пока пусто — кинь кости'
      histList.appendChild(empty)
      return
    }
    // Хронология в меню — короткая: последних 5 бросков хватает (дольше — реролл).
    for (const entry of entries.slice(0, 5)) {
      const row = document.createElement('button')
      row.className = 'mtableHrow'
      row.dataset.testid = 'mtable-hrow'
      row.type = 'button'
      row.title = 'Повторить этот набор'
      const v = document.createElement('span')
      v.className = 'mtableHv'
      v.dataset.testid = 'mtable-hv'
      v.textContent = entry.display
      const meta = document.createElement('span')
      meta.className = 'mtableHmeta'
      meta.dataset.testid = 'mtable-hmeta'
      meta.textContent = entry.label
        ? `${formatLabel(entry.label)} · ${fmtTime(entry.at)}`
        : fmtTime(entry.at)
      const parts = document.createElement('span')
      parts.className = 'mtableHp'
      parts.dataset.testid = 'mtable-hp'
      if (entry.parts) {
        const texts = formatParts(entry.parts)
        entry.parts.forEach((p, i) => {
          const s = document.createElement('span')
          const cls = partClass(p)
          if (cls) s.className = cls
          else if (!p.kept) s.className = 'partDrop'
          s.textContent = texts[i]
          parts.append(s, document.createTextNode(' '))
        })
      }
      const redo = document.createElement('span')
      redo.className = 'mtableHredo'
      redo.dataset.testid = 'mtable-hredo'
      redo.textContent = '↻'
      row.append(v, meta, parts, redo)
      row.addEventListener('click', () => reroll(entry))
      histList.appendChild(row)
    }
  }

  /** Реролл: счётчики из частей записи → на стол → бросок. */
  const reroll = (entry: HistoryEntry): void => {
    const counts = setup.get()
    for (const die of DIE_IDS) counts[die] = 0
    let any = false
    for (const p of entry.parts ?? []) {
      if ((DIE_IDS as readonly string[]).includes(p.die)) {
        counts[p.die as DieId]++
        any = true
      }
    }
    if (!any) return
    closeOverlays()
    applyCounts(counts)
    // Короткий взмах перед рероллом: поза уходит в кувырок — физспавн
    // (случайная ориентация) стартует от хаоса, без видимого рывка.
    windActive = true
    section.dataset.phase = 'charging'
    table.windup({ on: true })
    startRattle()
    window.setTimeout(() => {
      windActive = false
      table.windup({ on: false, restore: false })
      throwAll(throwPowerBoost())
    }, 350)
  }

  // Камера статична (орбиты нет — жест по фону ничего не делает);
  // крутится только сама кость под пальцем (spinDie).
  const table: Table = createTable(canvas)
  const viewDirOf = () => table.getViewDir()
  let instances: Instance[] = []
  let slots: Array<{ x: number; z: number }> = []
  /** Границы физики броска: «стол» = канва минус отступы (см. applyLayout). */
  let physBounds = { hx: 30, hz: 20 }
  let loadedKeys = new Set<string>()
  let rolling = false
  let disposed = false
  /** Диагностика загрузки GLB: кость не пришла — хинт честно так и говорит. */
  let loadError = ''
  /** Последний итог для кнопки (idle → rolling → result ↻). */
  let lastResult: { label: string; total: number; parts: PoolPart[] } | null = null

  /** Экстремумы грани для подсветки: 1/0 — провал, верх — золото. */
  const MAX_FACE: Record<DieId, number> = { d4: 4, d6: 6, d8: 8, d10: 9, d12: 12, d20: 20 }
  const partClass = (p: PoolPart): string => {
    if (!(DIE_IDS as readonly string[]).includes(p.die)) return ''
    const die = p.die as DieId
    if (p.value === 1 || (die === 'd10' && p.value === 0)) return 'partMin'
    if (p.value === MAX_FACE[die]) return 'partMax'
    return ''
  }
  /** Кости с состоявшимся броском (остальные — приглушены). */
  const thrownKeys = new Set<string>()
  /**
   * Зарядка броска (wind-up): удержание ≥3 с на кости — кувырок крутится.
   * Вся логика отпускания/добора — в gestures.ts; флаг живёт здесь,
   * потому что его читает панель (chrome) и трогают reroll/throwAll.
   */
  let windActive = false

  // Панель состояния (фаза/бургер/кнопка/хинт/футер/шторка) — в chrome.ts;
  // здесь только связка живого состояния замыкания с DOM.
  const chrome = createChrome({
    state: () => ({
      rolling,
      charging: windActive,
      loadError,
      loaded: loadedKeys.size,
      instances: instances.length,
      lastResult,
      activeSet,
    }),
    els: {
      section,
      burger,
      foot,
      footParts,
      diceBtn,
      hint,
      hintTitle,
      hintSub,
      hintCta,
      hintInfo,
      sheetTitle,
      sheetClear,
      rowCounts,
      rowRoots,
      getChips: () => chipEls,
      saveBtn,
      fitHeadStar,
    },
  })
  /** Состав набора — на кнопке («2d4 d12»), сумма — на бургере, разбивка — в футере. */
  const refreshChrome = (counts: TableCounts): void => {
    chrome.refresh(counts)
  }

  const addInstance = (inst: Instance, i: number) => {
    const model = DIE_IDS.map((id) => ({
      id,
      url: `${import.meta.env.BASE_URL}cad/set/${id}.glb`,
    })).find((m) => m.id === inst.die)
    if (!model) return
    const base =
      inst.die === 'd4'
        ? quatForD4VertexUp(1, viewDirOf())
        : quatForValueDown(inst.die, faceValue(inst.die, 0), viewDirOf())
    const spread = quatYaw((i * 2 * Math.PI) / Math.max(1, instances.length))
    const initialQuat = quatMul(spread, base)
    table.addDie(
      inst.key,
      model.url,
      { physSize: physMaxDim(inst.die), slot: [slots[i].x, slots[i].z], initialQuat },
      () => {
        loadedKeys.add(inst.key)
        // Неброшенные кости — приглушены (грани не читаются как результат).
        if (!thrownKeys.has(inst.key)) table.dimDie(inst.key, true)
        refreshChrome(setup.get())
      },
      () => {
        loadError = inst.die
        refreshChrome(setup.get())
      },
    )
  }

  /**
   * Канва + отступы шапки/футера → план (слоты/камера/границы) — чистая
   * математика в layout.ts, тут только DOM-измерения и применение плана.
   */
  const applyLayout = (): void => {
    const cw = Math.max(1, canvas.clientWidth)
    const ch = Math.max(1, canvas.clientHeight)
    const cRect = canvas.getBoundingClientRect()
    const top = Math.max(0, head.getBoundingClientRect().bottom - cRect.top)
    // Футер разбивки лежит поверх поля: его высоту резервируем всегда,
    // иначе после броска строка ложится на нижний ряд. hidden → меряем с
    // заглушкой (пустой спан даёт 0); роста нет — одна строка, nowrap.
    const wasHidden = foot.hidden
    const parts = footParts.textContent
    foot.hidden = false
    if (!parts) footParts.textContent = 'd20 1'
    const bottom = Math.max(0, cRect.bottom - foot.getBoundingClientRect().top)
    footParts.textContent = parts
    foot.hidden = wasHidden
    const plan = computeLayout({
      canvasW: cw,
      canvasH: ch,
      top,
      bottom,
      count: instances.length,
      biggest: instances.reduce((m, v) => Math.max(m, physMaxDim(v.die)), 0),
    })
    slots = plan.slots
    table.setFit(plan.fitW, plan.fitH)
    physBounds = plan.physBounds
  }

  /**
   * Пересборка под новый размер канвы: сетка/камера/границы + посадка
   * уже лежащих костей по новой сетке. Во время броска не трогаем позы —
   * полёт и доводка живут со слотами, снятыми на старте.
   */
  const relayout = (): void => {
    applyLayout()
    if (rolling || disposed) return
    instances.forEach((inst, i) => {
      const s = slots[i]
      const pose = table.getPose(inst.key)
      if (s && pose) table.syncBody(inst.key, [s.x, pose.pos[1], s.z], pose.quat)
    })
  }

  const syncInstances = (counts: TableCounts) => {
    if (disposed) return
    const next = expandInstances(counts)
    if (next.length === instances.length && next.every((v, i) => v.key === instances[i].key)) {
      refreshChrome(counts)
      return
    }
    for (const inst of instances) table.removeDie(inst.key)
    instances = next
    loadError = ''
    applyLayout()
    loadedKeys = new Set()
    instances.forEach((inst, i) => addInstance(inst, i))
    refreshChrome(counts)
  }

  const unsubSetup = setup.subscribe((counts) => {
    // Набор сменился — итог на кнопке протух, снова idle.
    lastResult = null
    syncInstances(counts)
  })
  const unsubHistory = history.subscribe((entries) => renderHistory(entries))
  syncInstances(setup.get())
  renderPresets()

  /**
   * Бросок пачкой. powerBoost = режим меню + заряд удержания + флик релиза
   * (кап 1.6); flick — направленный швырок XZ из флика пальцем (мировые
   * координаты, см. table.flickVec). Зарядка уходит в режим подхвата: кувырок
   * крутится до конца сливки (~0.3 с), а его ось/скорость уходят в реальное
   * ω тела (step.omega) — раскрутка продолжается в физику, без freeze-кадра,
   * телепорта спавна и «чужого» перехода вращения.
   */
  const throwAll = (powerBoost = 0, flick?: { x: number; z: number }): void => {
    if (rolling || disposed) return
    windActive = false
    table.windup({ on: false, restore: false })
    const thrown = [...instances]
    if (thrown.length === 0) return
    const thrownSlots = slots.map((s) => ({ ...s }))
    const slotOf = (key: string): { x: number; z: number } =>
      thrownSlots[thrown.findIndex((v) => v.key === key)] ?? { x: 0, z: 0 }
    rolling = true
    lastResult = null
    refreshChrome(setup.get())
    stopRattle()
    const baseUp = thrown.length <= 2 ? 28 : thrown.length <= 4 ? 24 : 21
    const launchUp = baseUp + powerBoost * 10
    const screenUp = screenUpWorld(viewDirOf())
    let lastHit = 0
    const byKey = new Map(thrown.map((v) => [v.key, v.die]))
    const cbs = {
      screenUp,
      onStep: (key: string, _die: DieId, step: Parameters<StepCallback>[0]) => {
        void _die
        table.syncBody(key, step.pos, step.quat, step.omega)
      },
      onCollide: (die: DieId, i: number) => {
        lastHit = performance.now()
        playThock(die, i)
      },
    }
    const final = new Map<string, TableDieResult>()
    const runRound = (keys: string[], round: number): void => {
      const n = keys.length
      const reqs = keys.flatMap((key, idx) => {
        const die = byKey.get(key)
        const pose = die ? table.getPose(key) : null
        if (!die || !pose) return []
        const s = slotOf(key)
        const spawnPos: [number, number, number] = round === 0 ? pose.pos : [s.x, pose.pos[1], s.z]
        const ang = (idx / Math.max(1, n)) * Math.PI * 2 + round * 0.7
        const spread = 4 + (idx % 3)
        const power = 0.7 + powerBoost * 0.6 + (idx % 3) * 0.08
        return [
          {
            key,
            die,
            spawnPos,
            // Ориентацию позы НЕ отдаём (античит: drag-поворот кости не
            // пробрасывается) — спавн идёт со случайной ориентацией.
            power,
            // Пол |ω|: слабая раскрутка невозможна (античит подгадывания).
            minAngular: 6 * power,
            launchUp,
            damping: 0.3,
            sleepLimit: 1.0,
            fling: {
              x: Math.cos(ang) * spread + (flick?.x ?? 0),
              z: Math.sin(ang) * spread + (flick?.z ?? 0),
            },
          } as const,
        ]
      })
      if (reqs.length === 0) {
        finishPack()
        return
      }
      void rollTable(reqs, cbs, physBounds)
        .then((results) => {
          if (disposed) return
          for (const r of results) final.set(r.key, r)
          const bad = results.filter((r) => !r.settled).map((r) => r.key)
          if (bad.length > 0 && round < 2) {
            console.log(`[table] retry round ${round + 1}`)
            runRound(bad, round + 1)
            return
          }
          finishPack()
        })
        .catch((err: unknown) => {
          // Отказ физмира/rollTable: раньше молчал (юзер видел «ничего не
          // происходит») — репортим причину и возвращаем кнопку в idle.
          console.error('[table] Бросок пачкой упал', err)
          if (disposed) return
          const nothing = final.size === 0
          finishPack()
          if (nothing) {
            showToast('Бросок сорвался — кинь ещё раз')
            live.textContent = 'Бросок не удался'
          }
        })
    }
    const finishPack = (): void => {
      if (disposed) return
      stopRattle()
      const ordered = thrown.flatMap((v) => {
        const r = final.get(v.key)
        return r ? [r] : []
      })
      if (ordered.length === 0) {
        lastResult = null
        rolling = false
        refreshChrome(setup.get())
        return
      }
      if (performance.now() - lastHit > 150) playThock(ordered[0].die)
      const labelled = labelTableResult(ordered)
      // Визуально итога нигде (граней + история в меню): озвучиваем SR.
      commitTableResult(ordered, labelled, { pop: false })
      live.textContent = `${formatLabel(labelled.label)}: ${labelled.total} · ${formatParts(labelled.parts).join(' ')}`
      // Брошенные «загораются», неброшенные остаются приглушены.
      for (const r of ordered) {
        thrownKeys.add(r.key)
        table.dimDie(r.key, false)
      }
      // Итог живёт в кнопке/футере (idle → rolling → результат ↻).
      lastResult = { label: labelled.label, total: labelled.total, parts: labelled.parts }
      for (const r of ordered) buzz(r.die, r.value)
      const presents = ordered.map(
        (r) =>
          new Promise<void>((done) => {
            const target =
              r.die === 'd4'
                ? resolveD4Below(r.quat, screenUp).target
                : quatForValueDown(r.die, r.value, viewDirOf())
            table.presentTo(r.key, target, () => done(), 650)
          }),
      )
      void Promise.all(presents).then(() => {
        if (disposed) return
        // Разъезд по очереди (120мс apart): одновременные глайды ехали
        // друг сквозь друга при пересекающихся траекториях.
        const glides = ordered.map(
          (r, i) =>
            new Promise<void>((done) => {
              window.setTimeout(() => {
                if (disposed) {
                  done()
                  return
                }
                const s = slotOf(r.key)
                table.glideTo(r.key, s.x, s.z, () => done())
              }, i * 120)
            }),
        )
        void Promise.all(glides).then(() => {
          rolling = false
          refreshChrome(setup.get())
          // Аудит посадки: тела в телах после разъезда быть не должно.
          const poses = new Map<string, DicePose>()
          for (const r of ordered) {
            const pose = table.getPose(r.key)
            if (pose) poses.set(r.key, { die: r.die, pos: pose.pos, quat: pose.quat })
          }
          const keys = [...poses.keys()]
          for (let a = 0; a < keys.length; a++) {
            for (let b = a + 1; b < keys.length; b++) {
              const pa = poses.get(keys[a])
              const pb = poses.get(keys[b])
              if (pa && pb && diceOverlap(pa, pb)) {
                console.warn(`[table] overlap after settle: ${keys[a]} × ${keys[b]}`)
              }
            }
          }
          // Стол ровно: юзер крутил/зумил — камера плавно домой.
          table.resetView()
        })
      })
    }
    runRound(
      thrown.map((v) => v.key),
      0,
    )
  }

  // Жест на поле (зарядка/осмотр/добор/релиз) — в gestures.ts.
  const gestures = createGestures({
    canvas,
    section,
    table,
    isRolling: () => rolling,
    isDisposed: () => disposed,
    wind: {
      isCharging: () => windActive,
      setCharging: (on: boolean) => {
        windActive = on
      },
    },
    throwAll,
    refresh: () => refreshChrome(setup.get()),
  })

  requestAnimationFrame(() => {
    table.resize()
    relayout()
  })

  // Тесты/чекерам нужны координаты кости (удержание ≥3 с — единственный
  // триггер броска): DEV-хук собирается только dev-сборкой, в прод не попадает.
  if (import.meta.env.DEV) {
    ;(window as WindowWithMTable).__mtable = { diePoint: () => table.findDiePoint() }
  }

  return {
    update() {
      tickTableWorld()
      table.update()
    },
    resize() {
      table.resize()
      relayout()
      fitHeadStar()
      watermark.fit()
    },
    dispose() {
      disposed = true
      gestures.cancelPending()
      stopRattle()
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(toastTimer)
      window.clearTimeout(clearTimer)
      unsubSetup()
      unsubHistory()
      unsubMusic()
      unsubMusicNotice()
      window.removeEventListener('online', onNetBack)
      disposeMusic()
      table.dispose()
      container.innerHTML = ''
      if (typeof window !== 'undefined') delete (window as WindowWithMTable).__mtable
    },
  }
}
