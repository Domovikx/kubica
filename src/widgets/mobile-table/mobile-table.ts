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
  stopRattle,
} from '@/features/roll-dice/sound'
import {
  THROW_POWERS,
  setThrowPower,
  throwPower,
  throwPowerBoost,
} from '@/features/roll-dice/power'
import {
  commitTableResult,
  labelTableResult,
  layoutSlots,
  rollTable,
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
import { clearAllIcon, closeIcon, menuIcon, soundIcon, vibrationIcon } from '@/shared/ui/md-icon'
import { DIE_HINTS, dieGlyph } from '@/shared/ui/die-glyph'
import { hideResult } from '@/shared/ui/result-pop'
import { glassHalves, TABLE_HALF_X, TABLE_HALF_Z } from '@/shared/arena/arena'
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
  container.innerHTML = ''
  const section = document.createElement('section')
  section.className = 'mtable'
  section.dataset.testid = 'mtable'

  const canvas = document.createElement('canvas')
  canvas.className = 'mtableCanvas'
  canvas.dataset.testid = 'mtable-canvas'
  // Декорация для SR: итог озвучивает кнопка (aria-live ниже).
  canvas.setAttribute('aria-hidden', 'true')

  const head = document.createElement('div')
  head.className = 'mtableHead'
  head.dataset.testid = 'mtable-head'
  const burger = document.createElement('button')
  burger.className = 'mtableIcon mtableBurger'
  burger.dataset.testid = 'mtable-burger'
  burger.type = 'button'
  burger.innerHTML = menuIcon()
  burger.setAttribute('aria-label', 'Меню')
  // «+ Кости» — набор («2d4 d12»), пусто — «+ Кости»; сумма броска — на бургере.
  const diceBtn = document.createElement('button')
  diceBtn.className = 'mtableIcon mtableAdd'
  diceBtn.dataset.testid = 'mtable-add'
  diceBtn.type = 'button'
  diceBtn.textContent = '+ Кости'
  diceBtn.setAttribute('aria-label', 'Выбор костей')
  const title = document.createElement('span')
  title.className = 'mtableTitle'
  title.dataset.testid = 'mtable-title'
  title.textContent = 'Kubica'
  const soundBtn = document.createElement('button')
  soundBtn.className = 'mtableIcon'
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
  // Шапка: управление (набор, бургер) по центру экрана, справа Kubica и звук.
  const headCtl = document.createElement('div')
  headCtl.className = 'mtableHeadCtl'
  headCtl.dataset.testid = 'mtable-head-ctl'
  headCtl.append(diceBtn, burger)
  const headSide = document.createElement('div')
  headSide.className = 'mtableHeadSide'
  headSide.dataset.testid = 'mtable-head-side'
  headSide.append(title, soundBtn)
  head.append(headCtl, headSide)

  const applyCounts = (counts: TableCounts) => {
    setup.clear()
    for (const die of DIE_IDS) {
      const n = counts[die] ?? 0
      if (n > 0) setup.setCount(die, n)
    }
  }
  const sameCounts = (a: TableCounts, b: TableCounts): boolean =>
    DIE_IDS.every((die) => (a[die] ?? 0) === (b[die] ?? 0))

  // Хинт-статус по центру: пусто (кнопка → шит) / грузится / ошибка загрузки.
  const hint = document.createElement('button')
  hint.className = 'mtableHint'
  hint.dataset.testid = 'mtable-hint'
  hint.type = 'button'
  hint.textContent = 'Жми «+ Кости» — пресеты и выбор костей внутри'
  hint.hidden = true
  hint.addEventListener('click', () => openSheet())

  // Итог броска визуально нигде (суммы — по граням, история — в меню):
  // для скринридера — невидимый живой регион (бывший aria-live на кнопке).
  const live = document.createElement('div')
  live.className = 'mtableLive'
  live.dataset.testid = 'mtable-live'
  live.setAttribute('role', 'status')

  // Футер расшифровки: только чтение (тапы летят сквозь него на поле),
  // скринридеру итог уже озвучивает живой регион выше.
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

  // Сила броска — вместо старой зарядки удержанием (кость = кнопка, сила = меню).
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
  pwSection.append(pwTitle, ...pwBtns)
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

  drawerBody.append(histSection, pwSection, sndSection, aboutSection)
  drawer.append(drawerHead, drawerBody)

  section.append(canvas, head, foot, hint, live, backdrop, sheet, drawer, toast)
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
    throwAll(throwPowerBoost())
  }

  // Камера статична (орбиты нет — жест по фону ничего не делает);
  // крутится только сама кость под пальцем (spinDie).
  const table: Table = createTable(canvas)
  const viewDirOf = () => table.getViewDir()
  let instances: Instance[] = []
  let slots: Array<{ x: number; z: number }> = []
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
   * Защита от случайного переброса: тап по свежему итогу (до чтения)
   * игнорируем. Окно — 1.2 с с момента показа.
   */
  let resultAt = 0
  const RESULT_GRACE_MS = 1200

  /** Фаза стола для тестов/чекеров: empty | loading | ready | rolling. */
  const syncPhase = (total: number): string => {
    const phase =
      total === 0
        ? 'empty'
        : rolling
          ? 'rolling'
          : loadedKeys.size < instances.length
            ? 'loading'
            : 'ready'
    section.dataset.phase = phase
    return phase
  }

  /** Состав набора — на кнопке («2d4 d12»), цифра суммы — на бургере, расшифровка — в футере. */
  const refreshChrome = (counts: TableCounts) => {
    const total = totalCount(counts)
    const phase = syncPhase(total)
    // На кнопке-бургере — только цифра суммы; расшифровка — в футере внизу.
    // Пока кости летят — лоадер (не кнопка).
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
    // Сумма — акцентным цветом, иконка меню и лоадер — обычным.
    burger.classList.toggle('hasSum', !rolling && lastResult !== null)
    // Футер: расшифровка пробелами («4 4 4 2 7 8 3 4 6 1»).
    if (lastResult && !rolling) {
      const breakdown = formatParts(lastResult.parts).join(' ')
      footParts.textContent = breakdown
      foot.hidden = false
      foot.title = breakdown
    } else {
      foot.hidden = true
    }
    const short = shortSet(counts)
    diceBtn.textContent = total > 0 ? short : '+ Кости'
    diceBtn.setAttribute('aria-label', total > 0 ? `Выбор костей: ${short}` : 'Выбор костей')
    diceBtn.title = summarize(counts)
    // Хинт-статус: пусто (кнопка → шит) / грузится (disabled) / ошибка загрузки.
    if (loadError) {
      hint.textContent = `Не загрузилась: ${loadError}`
      hint.hidden = false
      hint.disabled = false
    } else if (total === 0) {
      hint.textContent = 'Жми «+ Кости» — пресеты и выбор костей внутри'
      hint.hidden = false
      hint.disabled = false
    } else if (phase === 'loading') {
      hint.textContent = `Гружу… ${loadedKeys.size}/${instances.length}`
      hint.hidden = false
      hint.disabled = true
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
    const biggest = instances.reduce((m, v) => Math.max(m, physMaxDim(v.die)), 0)
    const gap = Math.max(24, biggest * 1.55)
    // Без верхних чипов и нижней панели поле пустое: кости — в реальном центре кадра.
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight)
    slots = layoutSlots(instances.length, gap, { aspect }).map((s) => ({ x: s.x, z: s.z }))
    const maxX = slots.reduce((m, s) => Math.max(m, Math.abs(s.x)), 0)
    const maxZ = slots.reduce((m, s) => Math.max(m, Math.abs(s.z)), 0)
    const fit = glassHalves(maxX, maxZ)
    table.setFit(fit.hx, fit.hz)
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

  // flick умер вместе с зарядкой (drag на кнопке): сила — из меню, разлёт — угловой.
  const throwAll = (powerBoost = 0): void => {
    if (rolling || disposed) return
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
        return [
          {
            key,
            die,
            spawnPos,
            spawnQuat: pose.quat,
            power: 0.7 + powerBoost * 0.6 + (idx % 3) * 0.08,
            launchUp,
            damping: 0.3,
            sleepLimit: 1.0,
            fling: {
              x: Math.cos(ang) * spread,
              z: Math.sin(ang) * spread,
            },
          } as const,
        ]
      })
      if (reqs.length === 0) {
        finishPack()
        return
      }
      void rollTable(reqs, cbs, { hx: TABLE_HALF_X, hz: TABLE_HALF_Z })
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
      // Для тапа-переброса — grace-окно (раньше защищало текст на кнопке).
      lastResult = { label: labelled.label, total: labelled.total, parts: labelled.parts }
      resultAt = Date.now()
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

  // Жест на поле: тап по кости — бросок; драг по кости — вращение кости
  // (чисто визуальный осмотр); драг по фону — ничего (камера не двигается).
  canvas.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || rolling) return
    const x = e.clientX
    const y = e.clientY
    const t = performance.now()
    const dieId = table.pickDieId(x, y)
    let lastX = x
    let lastY = y
    let spun = false
    const onMove = (mv: PointerEvent) => {
      if (!mv.isPrimary) return
      const dx = mv.clientX - lastX
      const dy = mv.clientY - lastY
      lastX = mv.clientX
      lastY = mv.clientY
      if (!dieId) return
      if (!spun && Math.hypot(mv.clientX - x, mv.clientY - y) <= 8) return
      spun = true
      table.spinDie(dieId, dx, dy)
    }
    const cleanup = () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
    }
    const onUp = (up: PointerEvent) => {
      cleanup()
      if (!up.isPrimary) return
      const moved = Math.hypot(up.clientX - x, up.clientY - y)
      if (!spun && moved < 8 && performance.now() - t < 500 && dieId) {
        // Свежий итог сначала читаем: тап в окно grace — не переброс.
        if (lastResult && Date.now() - resultAt < RESULT_GRACE_MS) return
        throwAll(throwPowerBoost())
      }
    }
    const onCancel = () => cleanup()
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)
  })

  requestAnimationFrame(() => {
    table.resize()
  })

  // Тесты/чекерам нужны координаты кости (тап — единственный триггер броска):
  // DEV-хук собирается только dev-сборкой, в прод не попадает.
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
    },
    dispose() {
      disposed = true
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
