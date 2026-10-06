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
import {
  quatForD4VertexUp,
  quatForValueDown,
  quatMul,
  quatYaw,
} from '@/features/roll-dice/face-orient'
import { diceOverlap, type DicePose, type StepCallback } from '@/features/roll-dice/physics'
import { resolveD4Below, screenUpWorld } from '@/features/roll-dice/readout'
import {
  buzz as vibrate,
  hapticsEnabled,
  isMuted,
  playThock,
  setHaptics,
  setMuted,
  startRattle,
  stopRattle,
} from '@/features/roll-dice/sound'
import {
  THROW_POWERS,
  setThrowPower,
  throwPower,
  throwPowerBoost,
} from '@/features/roll-dice/power'
import { UI_SCALES, applyUiScale, setUiScale, uiScale } from '@/features/ui-scale/ui-scale'
import {
  commitTableResult,
  labelTableResult,
  layoutSlots,
  rollTable,
  slotsToWorld,
  tickTableWorld,
  type TableDieResult,
} from '@/features/table-roll/table-roll'
import {
  expandInstances,
  getSetupStore,
  MAX_PER_DIE,
  MAX_TOTAL,
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
  clearAllIcon,
  closeIcon,
  githubIcon,
  menuIcon,
  soundIcon,
  likeIcon,
  telegramIcon,
  vibrationIcon,
} from '@/shared/ui/md-icon'
import { DIE_HINTS, dieGlyph } from '@/shared/ui/die-glyph'
import { hideResult } from '@/shared/ui/result-pop'
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

const fmtTime = (at: number): string => {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Краткая сводка набора для кнопки («d4×1+d6×2», пусто — «пусто»). */
const summarize = (counts: TableCounts): string => {
  const parts: string[] = []
  for (const die of DIE_IDS) {
    const n = counts[die] ?? 0
    if (n > 0) parts.push(`${die}×${n}`)
  }
  return parts.length > 0 ? parts.join('+') : 'пусто'
}

/** Короткая запись набора для шапки/заголовка шторки («2d4 d12»). */
const shortSet = (counts: TableCounts): string => {
  const parts: string[] = []
  for (const die of DIE_IDS) {
    const n = counts[die] ?? 0
    if (n > 0) parts.push(n > 1 ? `${n}${die}` : die)
  }
  return parts.join(' ')
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

  // Водяной знак (фидбэк: «если нельзя сделать маленьким — надо сделать
  // большим»): гигантское «Kubica» почти во всю ширину `.mtable`, ПОД канвой
  // (канва прозрачная, см. table.ts alpha) и под шапкой — фоновая подложка,
  // как крупный логотип-призрак по центру сцены. Декор — только для глаз.
  const watermark = document.createElement('div')
  watermark.className = 'mtableWatermark'
  watermark.dataset.testid = 'mtable-watermark'
  watermark.setAttribute('aria-hidden', 'true')
  const wmText = document.createElement('span')
  wmText.className = 'mtableWatermarkText'
  wmText.textContent = 'Kubica'
  watermark.append(wmText)
  // Адаптивка под экран (фидбэк): широкий → по горизонтали, узкий → по
  // вертикали, квадратный → под 45°. Угол считаем от пропорций ВЬЮПОРТА
  // (контейнер на десктопе зажат max-width 720 — по нему «широта» не видна),
  // длину — по контейнеру: растягиваем почти во всю доступную длину с
  // эстетическим отступом от краёв, масштаб шрифта меряем на лету.
  const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
  const fitWatermark = (): void => {
    const r = watermark.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return
    const vw = window.innerWidth || r.width
    const vh = window.innerHeight || r.height
    const aspect = vw / Math.max(vh, 1)
    // ≥1.5 — широко → 0°; ровно 1 (квадрат) → 45°; ≤2/3 — узко → 90°.
    const angle =
      aspect >= 1
        ? 45 * clamp01((1.5 - aspect) / 0.5)
        : 45 + 45 * clamp01((1 - aspect) / (1 - 2 / 3))
    const rad = (angle * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const pad = Math.min(48, Math.max(16, Math.round(Math.min(r.width, r.height) * 0.06)))
    const availW = r.width - 2 * pad
    const availH = r.height - 2 * pad
    // Длина отрезка той же ориентации, что влезает в бокс (по диагонали —
    // min сторон / cos45).
    const along = Math.min(
      cos > 0.001 ? availW / cos : Number.POSITIVE_INFINITY,
      sin > 0.001 ? availH / sin : Number.POSITIVE_INFINITY,
    )
    // Меряем ширину строки при 100px (без поворота) → масштаб под `along`.
    wmText.style.transform = 'none'
    wmText.style.fontSize = '100px'
    const w100 = wmText.getBoundingClientRect().width
    if (w100 < 1) return
    const fs = (along / w100) * 100
    wmText.style.fontSize = `${Math.round(fs * 10) / 10}px`
    wmText.style.transform = angle > 0.05 ? `rotate(${angle}deg)` : 'none'
  }

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
  const syncHeadStarAria = (): void => {
    headStar.setAttribute(
      'aria-label',
      headStarCount.hidden
        ? 'Оценить репозиторий на GitHub (откроется в новой вкладке)'
        : `Оценить репозиторий Kubica на GitHub, звёзд: ${headStarCount.textContent} (откроется в новой вкладке)`,
    )
  }
  syncHeadStarAria()
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
  // Шапка: слева звук, по центру пара «+»/бургер (2.15), справа ряд Star.
  const headCtl = document.createElement('div')
  headCtl.className = 'mtableHeadCtl'
  headCtl.dataset.testid = 'mtable-head-ctl'
  headCtl.append(diceBtn, burger)
  const headLeft = document.createElement('div')
  headLeft.className = 'mtableHeadLeft'
  headLeft.dataset.testid = 'mtable-head-left'
  headLeft.append(soundBtn)
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
    // Звук слева: пока пара «+»/бургер упирается в правый контент-бокс —
    // звук виноват в сдвиге (на 320 с полным составом левая колонка выталкивает
    // центр за экран) → прячем (звук дублируется пунктом в бургере).
    let m = measure()
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

  /** Статус вместо композиции (грузится / ошибка): одна строка, без CTA. */
  const hintStatus = (text: string, disabled: boolean) => {
    hintTitle.textContent = text
    hintSub.hidden = true
    hintCta.hidden = true
    hintInfo.hidden = true
    hint.hidden = false
    hint.disabled = disabled
  }

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
  sndSection.append(sndTitle, sndToggle, hapToggle)

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
  // и фликом релиза (cap 1.6 — см. fireThrow); тап-удержание ≥2 с и есть бросок.
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
  pwHint.textContent = 'Кость заряжается удержанием 2–4 с — сильнее бросок (и флик при отпускании)'
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
  // (см. loadStars): при отсутствии сети/лимите API и при 0 — просто скрыт,
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
  const syncStarAria = (): void => {
    starLink.setAttribute(
      'aria-label',
      starCount.hidden
        ? 'Оценить репозиторий Kubica звездой на GitHub (откроется в новой вкладке)'
        : `Оценить репозиторий Kubica на GitHub, звёзд: ${starCount.textContent} (откроется в новой вкладке)`,
    )
  }
  syncStarAria()

  // Счётчик звёзд: кэш в localStorage на сутки + GitHub API без токена
  // (rate limit 60/ч на IP — кэш держит расход в ≤1 запроса/сутки на
  // посетителя). Деградация тихая: offline/403/429/любая ошибка → счётчик
  // остаётся скрытым (или в прежнем значении из кэша), без ретраев.
  const STAR_KEY = 'kubica-stars'
  const STAR_TTL_MS = 24 * 60 * 60 * 1000
  let starsAsked = false
  const showStars = (n: number): void => {
    // Шторка: 0 звёзд — не социальное доказательство, мету-счётчик прячем
    // (сама строка-ссылка живёт всегда), показываем от 1.
    starCount.hidden = n < 1
    starCount.textContent = starCount.hidden ? '' : String(n)
    // Шапка — ряд как на GitHub: цифра видна всегда, когда она известна
    // (GitHub показывает и 0); без данных/офлайн пилюля скрыта.
    headStarCount.textContent = String(n)
    headStarCount.hidden = false
    syncStarAria()
    syncHeadStarAria()
  }
  const loadStars = (): void => {
    if (starsAsked) return
    starsAsked = true
    let cached: { at: number; n: number } | null = null
    try {
      const raw = localStorage.getItem(STAR_KEY)
      const parsed: unknown = raw === null ? null : JSON.parse(raw)
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof (parsed as { at?: unknown }).at === 'number' &&
        typeof (parsed as { n?: unknown }).n === 'number'
      ) {
        cached = parsed as { at: number; n: number }
      }
    } catch {
      cached = null
    }
    if (cached) {
      showStars(cached.n)
      if (Date.now() - cached.at < STAR_TTL_MS) return
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    void fetch('https://api.github.com/repos/Domovikx/kubica', {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((res): Promise<unknown> =>
        res.ok ? res.json() : Promise.reject(new Error(String(res.status))),
      )
      .then((data: unknown) => {
        const n =
          typeof data === 'object' && data !== null
            ? (data as { stargazers_count?: unknown }).stargazers_count
            : undefined
        if (typeof n !== 'number') return
        showStars(n)
        try {
          localStorage.setItem(STAR_KEY, JSON.stringify({ at: Date.now(), n }))
        } catch {
          // без хранилища живём — просто будем ходить в API реже
        }
      })
      .catch(() => {
        // тихо: остаёмся на кэше или без счётчика
      })
  }
  loadStars()

  socialSection.append(socialTitle, ghLink, tgLink, starLink)

  drawerBody.append(histSection, pwSection, sndSection, scaleSection, aboutSection, socialSection)
  drawer.append(drawerHead, drawerBody)

  section.append(watermark, canvas, head, foot, hint, live, backdrop, sheet, drawer, toast)
  requestAnimationFrame(fitWatermark)
  document.fonts?.ready.then(fitWatermark).catch(() => {})

  container.appendChild(section)

  const openSheet = () => {
    drawer.hidden = true
    sheet.hidden = false
    backdrop.hidden = false
    section.classList.add('sheetOpen')
    renderPresets()
    sheetClose.focus()
  }
  const openDrawer = () => {
    sheet.hidden = true
    drawer.hidden = false
    backdrop.hidden = false
    // Счётчик звёзд тянем лениво — при первом открытии меню (см. loadStars).
    loadStars()
    drawerClose.focus()
  }
  const closeOverlays = () => {
    sheet.hidden = true
    drawer.hidden = true
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
    table.windup(true)
    startRattle()
    window.setTimeout(() => {
      windActive = false
      table.windup(false, false)
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
   * Зарядка броска (wind-up): удержание ≥2 с на кости. windActive — кувырок
   * крутится; pendingFire — короткий тап дожигает до 2-й секунды (мёртвых
   * тапов нет). Защита от случайного переброса теперь сама зарядка:
   * 2 с удержания — не «щелчок».
   */
  let windActive = false
  let pendingFire: number | null = null
  /** Минимум удержания до броска и время полного заряда (2 с → 4 с). */
  const MIN_HOLD_MS = 2000
  const CHARGE_FULL_MS = 4000

  /** Фаза стола для тестов/чекеров: empty | loading | ready | charging | rolling. */
  const syncPhase = (total: number): string => {
    const phase =
      total === 0
        ? 'empty'
        : rolling
          ? 'rolling'
          : windActive
            ? 'charging'
            : loadedKeys.size < instances.length
              ? 'loading'
              : 'ready'
    section.dataset.phase = phase
    return phase
  }

  /** Состав набора — на кнопке («2d4 d12»), сумма — на бургере, разбивка — в футере. */
  const refreshChrome = (counts: TableCounts) => {
    const total = totalCount(counts)
    const phase = syncPhase(total)
    // На бургере — крупная сумма последнего броска (иконка меню — до броска),
    // лоадер — пока кости летят. Разбивка — в футере.
    if (rolling) {
      burger.innerHTML = '<span class="mtableSpin" data-testid="mtable-spin"></span>'
      burger.disabled = true
      burger.setAttribute('aria-busy', 'true')
    } else {
      burger.disabled = false
      burger.removeAttribute('aria-busy')
      if (lastResult) burger.textContent = String(lastResult.total)
      else burger.innerHTML = menuIcon()
    }
    burger.classList.toggle('hasSum', !rolling && lastResult !== null)
    // Футер: разбивка пробелами («4 3 1 6 4 8 8 1 10 5»).
    if (lastResult && !rolling) {
      const breakdown = formatParts(lastResult.parts).join(' ')
      footParts.textContent = breakdown
      foot.hidden = false
      foot.title = breakdown
    } else {
      foot.hidden = true
    }
    const short = shortSet(counts)
    // Пусто — значок «+» (пара бургер-иконке), состав — текстом: он информативен,
    // без него кнопка становится «слепой». aria-label/title — в обоих состояниях.
    const label = total > 0 ? `Выбор костей: ${short}` : 'Выбор костей'
    diceBtn.setAttribute('aria-label', label)
    diceBtn.title = total > 0 ? summarize(counts) : label
    if (total > 0) diceBtn.textContent = short
    // Значок ставим один раз на пустое состояние (firstElementChild — svg, текста нет).
    else if (diceBtn.firstElementChild === null) diceBtn.innerHTML = addIcon()
    // Хинт-empty-state: пусто (композиция → шит) / грузится (disabled) /
    // ошибка загрузки; кости есть — hidden.
    if (loadError) {
      hintStatus(`Не загрузилась: ${loadError}`, false)
    } else if (total === 0) {
      hintTitle.textContent = 'Добавь кости на стол'
      hintSub.textContent = 'Пресеты и любой состав — внутри'
      hintSub.hidden = false
      hintCta.hidden = false
      hintInfo.hidden = false
      hint.hidden = false
      hint.disabled = false
    } else if (phase === 'loading') {
      hintStatus(`Гружу… ${loadedKeys.size}/${instances.length}`, true)
    } else {
      hint.hidden = true
    }
    if (total === 0) hideResult()
    // Заголовок шторки: пусто — функция панели, иначе — набор значений.
    sheetTitle.textContent = short || 'Выбор костей'
    sheetClear.disabled = total === 0
    for (const die of DIE_IDS) {
      const n = counts[die] ?? 0
      const span = rowCounts.get(die)
      if (span) span.textContent = String(n)
      const root = rowRoots.get(die)
      root?.classList.toggle('on', n > 0)
      const [minus, plus] = root?.querySelectorAll('button') ?? []
      if (minus instanceof HTMLButtonElement) minus.disabled = rolling || n <= 0
      if (plus instanceof HTMLButtonElement)
        plus.disabled = rolling || n >= MAX_PER_DIE || total >= MAX_TOTAL
    }
    for (const btn of chipEls) {
      const on = btn.dataset.set === activeSet
      btn.classList.toggle('on', on)
      btn.setAttribute('aria-pressed', String(on))
    }
    saveBtn.textContent = activeSet ? 'Обновить набор' : 'Сохранить сет'
    saveBtn.disabled = rolling || total === 0
    // Состав мог изменить ширину шапки — пересаживаем лайк (см. fitHeadStar).
    fitHeadStar()
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
   * Канва (известные ширина/высота + отступы шапки и футера) → inner-
   * прямоугольник → рациональное деление на N костей. Масштаб m (ед./px)
   * = шаг ячейки в мире / шаг в px: сетка, камера и границы физики живут
   * в одном масштабе — кость занимает свою ячейку одинаково на любом
   * экране, а одиночная кость не растекается (потолок ячейки).
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
    const rect = { w: cw, h: Math.max(1, ch - top - bottom) }
    const biggest = instances.reduce((m, v) => Math.max(m, physMaxDim(v.die)), 0)
    const gap = Math.max(24, biggest * 1.55)
    const plan = layoutSlots(instances.length, rect)
    const m = gap / plan.cell
    slots = slotsToWorld(plan, m, { x: 0, y: top + rect.h / 2 - ch / 2 })
    // setFit под канву: при fit = размер·m/2.5 frameCamera даёт ровно
    // 1 px ↔ m ед. (видимая высота = need·1.25) — сетка садится в канву.
    table.setFit((cw * m) / 2.5, (ch * m) / 2.5)
    // «Стол» при броске = та же канва минус верх/низ; врезка под кромку,
    // но не больше ячейки (иначе борт упрётся в лежащую у кости кость).
    const inset = Math.min(8, plan.cell * 0.15)
    // Борт обязан отстоять от крайнего слота не меньше чем на полупоперечник
    // кости (иначе спавн/каток у стены клинит — «покой в воздухе» и слабая
    // раскрутка от выдавливания солвером). pad — по самой крупной кости пачки.
    const pad = biggest + 3
    const maxSlotX = slots.reduce((a, s) => Math.max(a, Math.abs(s.x)), 0)
    const maxSlotZ = slots.reduce((a, s) => Math.max(a, Math.abs(s.z)), 0)
    physBounds = {
      hx: Math.max(1, (rect.w / 2 - inset) * m, maxSlotX + pad),
      hz: Math.max(1, (rect.h / 2 - inset) * m, maxSlotZ + pad),
    }
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
   * координаты, см. table.flickVec). Зарядка отдается физике: позу кувырка
   * не откатываем — спавн подхватывает без визуального рывка.
   */
  const throwAll = (powerBoost = 0, flick?: { x: number; z: number }): void => {
    if (rolling || disposed) return
    windActive = false
    table.windup(false, false)
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
        table.syncBody(key, step.pos, step.quat)
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
        .catch(() => {
          if (!disposed) finishPack()
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

  /**
   * Снять зарядку: restore=true — позы всех костей в базу (отмена);
   * 'spin' — в базу, но крутка кости keepId остаётся (осмотр при
   * отпускании <2 с сдвинувшимся курсором).
   */
  const endWind = (restore: boolean | 'spin', keepId?: string): void => {
    windActive = false
    table.windup(false, restore, keepId)
    stopRattle()
    refreshChrome(setup.get())
  }
  /**
   * Релиз зарядки: сила = меню + удержание (2 с → 0, 4 с → +0.5) + флик
   * пальцем (+0.4); кувырок не откатываем — физспавн подхватывает позу.
   */
  const fireThrow = (heldMs: number, vxPx: number, vyPx: number): void => {
    windActive = false
    if (rolling || disposed) {
      // Пока добирали 2 с — стол ушёл в другой бросок: зарядку гасим молча.
      table.windup(false)
      stopRattle()
      return
    }
    const charge = Math.max(0, Math.min(1, (heldMs - MIN_HOLD_MS) / (CHARGE_FULL_MS - MIN_HOLD_MS)))
    const flick01 = Math.min(1, Math.hypot(vxPx, vyPx) / 1.5)
    const boost = Math.min(1.6, throwPowerBoost() + 0.5 * charge + 0.4 * flick01)
    table.windup(false, false)
    throwAll(boost, table.flickVec(vxPx, vyPx))
  }

  // Жест на поле: удержание на кости ≥2 с — зарядка; движение при зажатой
  // кнопке зарядку НЕ прерывает (кувырок идёт, кость ещё крутится трекболом
  // под курсором). Отпускание: ≥2 с — бросок (заряд + флик); раньше — добор
  // до 2 с (мёртвых тапов нет), но если курсор сдвинулся >8 px — это осмотр:
  // зарядка гаснет (эта кость остаётся в крутке, остальные — в базу), броска
  // нет. Драг по фону — ничего (камера статична). Сила — заряд + флик + меню.
  canvas.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || rolling) return
    const x = e.clientX
    const y = e.clientY
    const t = performance.now()
    const dieId = table.pickDieId(x, y)
    if (!dieId) return
    // Захват указателя: отпускание за краем канвы/над шапкой не теряется.
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      /* указатель уже свободен */
    }
    // Новое нажатие перекрывает висящий доброс от короткого тапа.
    if (pendingFire !== null) {
      window.clearTimeout(pendingFire)
      pendingFire = null
    }
    if (!windActive) {
      windActive = true
      section.dataset.phase = 'charging'
      table.windup(true)
      startRattle()
      vibrate(10)
    }
    let lastX = x
    let lastY = y
    let moved = false
    // Последний сэмпл движения — скорость флика в момент релиза (px/мс).
    let sample = { t, x, y }
    const onMove = (mv: PointerEvent) => {
      if (!mv.isPrimary) return
      const dx = mv.clientX - lastX
      const dy = mv.clientY - lastY
      lastX = mv.clientX
      lastY = mv.clientY
      const now = performance.now()
      if (now - sample.t >= 16) sample = { t: now, x: mv.clientX, y: mv.clientY }
      if (!moved && Math.hypot(mv.clientX - x, mv.clientY - y) > 8) moved = true
      if (moved) table.spinDie(dieId, dx, dy)
    }
    const cleanup = () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    }
    const onUp = (up: PointerEvent) => {
      cleanup()
      if (!up.isPrimary) return
      const held = performance.now() - t
      const dt = Math.max(1, performance.now() - sample.t)
      const vx = (up.clientX - sample.x) / dt
      const vy = (up.clientY - sample.y) / dt
      if (held >= MIN_HOLD_MS) {
        // Зарядка пережила движение — время решает: ≥2 с бросаем.
        fireThrow(held, vx, vy)
      } else if (moved) {
        // Осмотр: крутка этой кости остаётся, остальные — в базу.
        endWind('spin', dieId)
      } else {
        // Добор зарядки до 2 с: тап не «мёртвый», просто бросает на отметке.
        pendingFire = window.setTimeout(() => {
          pendingFire = null
          fireThrow(MIN_HOLD_MS, vx, vy)
        }, MIN_HOLD_MS - held)
      }
    }
    const onCancel = () => {
      cleanup()
      if (pendingFire !== null) {
        window.clearTimeout(pendingFire)
        pendingFire = null
      }
      endWind(true)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)
  })

  requestAnimationFrame(() => {
    table.resize()
    relayout()
  })

  // Тесты/чекерам нужны координаты кости (удержание ≥2 с — единственный
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
      fitWatermark()
    },
    dispose() {
      disposed = true
      if (pendingFire !== null) {
        window.clearTimeout(pendingFire)
        pendingFire = null
      }
      stopRattle()
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(toastTimer)
      window.clearTimeout(clearTimer)
      unsubSetup()
      unsubHistory()
      table.dispose()
      container.innerHTML = ''
      if (typeof window !== 'undefined') delete (window as WindowWithMTable).__mtable
    },
  }
}
