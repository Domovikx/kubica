// Мобайл-фёрст стол (?m=1, макет F): дока нет, шторка «+ Кости» с SVG-рядами,
// бургер-меню (история/сеты/звук/инфо), поле — главное. Физика/стор — те же.
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
  loadCustomPresets,
  saveCustomPreset,
} from '@/features/table-setup/presets'
import { createTable, type Table } from '@/shared/three/table'
import { closeIcon, menuIcon, presetsIcon, soundIcon, vibrationIcon } from '@/shared/ui/md-icon'
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

  const canvas = document.createElement('canvas')
  canvas.className = 'mtableCanvas'
  // Декорация для SR: итог озвучивает кнопка (aria-live ниже).
  canvas.setAttribute('aria-hidden', 'true')

  const head = document.createElement('div')
  head.className = 'mtableHead'
  const burger = document.createElement('button')
  burger.className = 'mtableIcon mtableBurger'
  burger.type = 'button'
  burger.innerHTML = menuIcon()
  burger.setAttribute('aria-label', 'Меню')
  // «+ Кости» — набор («2d4 d12»), пусто — «+ Кости»; сумма броска — на бургере;
  // пресеты — отдельная кнопка (панель быстрого выбора).
  const diceBtn = document.createElement('button')
  diceBtn.className = 'mtableIcon mtableAdd'
  diceBtn.type = 'button'
  diceBtn.textContent = '+ Кости'
  diceBtn.setAttribute('aria-label', 'Выбор костей')
  const presetsBtn = document.createElement('button')
  presetsBtn.className = 'mtableIcon'
  presetsBtn.type = 'button'
  presetsBtn.innerHTML = presetsIcon()
  presetsBtn.setAttribute('aria-label', 'Пресеты')
  const title = document.createElement('span')
  title.className = 'mtableTitle'
  title.textContent = 'Kubica'
  const soundBtn = document.createElement('button')
  soundBtn.className = 'mtableIcon'
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
  // Порядок в шапке: набор, пресеты, бургер (сумма), заголовок, звук.
  head.append(diceBtn, presetsBtn, burger, title, soundBtn)

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
  hint.type = 'button'
  hint.textContent = 'Жми «+ Кости» или пресет — кости лягут на стол'
  hint.hidden = true
  hint.addEventListener('click', () => openSheet())

  // Итог броска визуально нигде (суммы — по граням, история — в меню):
  // для скринридера — невидимый живой регион (бывший aria-live на кнопке).
  const live = document.createElement('div')
  live.className = 'mtableLive'
  live.setAttribute('role', 'status')

  const backdrop = document.createElement('div')
  backdrop.className = 'mtableBackdrop'
  backdrop.hidden = true

  // --- Шторка «+ Кости» ---
  const sheet = document.createElement('div')
  sheet.className = 'mtableSheet'
  sheet.hidden = true
  const sheetHead = document.createElement('div')
  sheetHead.className = 'mtableSheetHead'
  const sheetTitle = document.createElement('span')
  sheetTitle.textContent = 'Выбор костей'
  const sheetClear = document.createElement('button')
  sheetClear.className = 'mtableLink'
  sheetClear.type = 'button'
  sheetClear.textContent = 'Убрать все'
  sheetClear.addEventListener('click', () => setup.clear())
  const sheetClose = document.createElement('button')
  sheetClose.className = 'mtableIcon'
  sheetClose.type = 'button'
  sheetClose.innerHTML = closeIcon()
  sheetClose.setAttribute('aria-label', 'Закрыть выбор костей')
  sheetHead.append(sheetTitle, sheetClear, sheetClose)
  const rows = document.createElement('div')
  rows.className = 'mtableRows'
  const rowCounts = new Map<DieId, HTMLSpanElement>()
  const rowRoots = new Map<DieId, HTMLElement>()
  for (const die of DIE_IDS) {
    const row = document.createElement('div')
    row.className = 'mtableRow'
    const glyph = document.createElement('span')
    glyph.className = 'mtableGlyph'
    glyph.innerHTML = dieGlyph(die)
    const nm = document.createElement('span')
    nm.className = 'mtableName'
    nm.textContent = die
    const ds = document.createElement('span')
    ds.className = 'mtableDesc'
    ds.textContent = DIE_HINTS[die]
    const minus = document.createElement('button')
    minus.className = 'mtableStep'
    minus.type = 'button'
    minus.textContent = '−'
    minus.setAttribute('aria-label', `Убрать ${die}`)
    minus.addEventListener('click', () => setup.add(die, -1))
    const count = document.createElement('span')
    count.className = 'mtableN'
    count.textContent = '0'
    const plus = document.createElement('button')
    plus.className = 'mtableStep'
    plus.type = 'button'
    plus.textContent = '+'
    plus.setAttribute('aria-label', `Добавить ${die}`)
    plus.addEventListener('click', () => setup.add(die, 1))
    row.append(glyph, nm, ds, minus, count, plus)
    rows.appendChild(row)
    rowCounts.set(die, count)
    rowRoots.set(die, row)
  }
  sheet.append(sheetHead, rows)

  // --- Бургер-меню ---
  const drawer = document.createElement('div')
  drawer.className = 'mtableDrawer'
  drawer.hidden = true
  const drawerHead = document.createElement('div')
  drawerHead.className = 'mtableSheetHead'
  const drawerTitle = document.createElement('span')
  drawerTitle.textContent = 'Меню'
  const drawerClose = document.createElement('button')
  drawerClose.className = 'mtableIcon'
  drawerClose.type = 'button'
  drawerClose.innerHTML = closeIcon()
  drawerClose.setAttribute('aria-label', 'Закрыть меню')
  drawerHead.append(drawerTitle, drawerClose)
  const drawerBody = document.createElement('div')
  drawerBody.className = 'mtableDrawerBody'

  const histSection = document.createElement('div')
  histSection.className = 'mtableSection'
  const histHead = document.createElement('div')
  histHead.className = 'mtableSectionHead'
  const histTitle = document.createElement('span')
  histTitle.textContent = 'История'
  const histClear = document.createElement('button')
  histClear.className = 'mtableLink'
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
  histSection.append(histHead, histList)

  // Пресеты (бывшая лента чипов над полем) — в меню: обёртка-пилюли,
  // тап применяет набор и закрывает меню (кости сразу видно).
  const preSection = document.createElement('div')
  preSection.className = 'mtableSection'
  const preTitle = document.createElement('span')
  preTitle.className = 'mtableSectionTitle'
  preTitle.textContent = 'Пресеты'
  const preList = document.createElement('div')
  preList.className = 'mtableSets'
  const presetChips: Array<{ btn: HTMLButtonElement; counts: TableCounts }> = []
  for (const p of BUILT_IN_PRESETS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'mtableChip'
    btn.textContent = p.name
    btn.title = p.formula
    btn.addEventListener('click', () => {
      applyCounts(p.counts)
      closeOverlays()
    })
    preList.appendChild(btn)
    presetChips.push({ btn, counts: p.counts })
  }
  preSection.append(preTitle, preList)

  const setSection = document.createElement('div')
  setSection.className = 'mtableSection'
  const setTitle = document.createElement('span')
  setTitle.className = 'mtableSectionTitle'
  setTitle.textContent = 'Мои сеты'
  const saveRow = document.createElement('div')
  saveRow.className = 'mtableFormulaRow'
  const saveName = document.createElement('input')
  saveName.className = 'mtableFormula'
  saveName.type = 'text'
  saveName.placeholder = 'Имя сета…'
  saveName.maxLength = 24
  saveName.setAttribute('aria-label', 'Имя своего набора')
  const saveBtn = document.createElement('button')
  saveBtn.className = 'mtableOk'
  saveBtn.type = 'button'
  saveBtn.textContent = '+ Сет'
  const setList = document.createElement('div')
  setList.className = 'mtableSets'
  const toast = document.createElement('div')
  toast.className = 'mtableToast'
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

  const renderSets = () => {
    setList.innerHTML = ''
    const customs = loadCustomPresets()
    if (customs.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'mtableEmpty'
      empty.textContent = 'Пока нет — набери стол и сохрани выше'
      setList.appendChild(empty)
      return
    }
    for (const p of customs) {
      const chip = document.createElement('span')
      chip.className = 'mtableSetChip'
      const label = document.createElement('button')
      label.type = 'button'
      label.className = 'mtableSetLabel'
      label.textContent = p.name
      label.addEventListener('click', () => {
        applyCounts(p.counts)
        closeOverlays()
      })
      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'mtableSetX'
      del.textContent = '×'
      del.setAttribute('aria-label', `Удалить ${p.name}`)
      del.addEventListener('click', () => {
        deleteCustomPreset(p.name)
        renderSets()
      })
      chip.append(label, del)
      setList.appendChild(chip)
    }
  }
  saveBtn.addEventListener('click', () => {
    const name = saveName.value.trim() || `Сет ${loadCustomPresets().length + 1}`
    saveCustomPreset(name, setup.get())
    saveName.value = ''
    renderSets()
    showToast(`Сет «${name}» сохранён`)
  })
  saveRow.append(saveName, saveBtn)
  setSection.append(setTitle, saveRow, setList)

  // --- Панель пресетов: отдельная кнопка в шапке (быстрые наборы + свои сеты) ---
  const presetsPanel = document.createElement('div')
  presetsPanel.className = 'mtablePresets'
  presetsPanel.hidden = true
  const presetsHead = document.createElement('div')
  presetsHead.className = 'mtableSheetHead'
  const presetsTitle = document.createElement('span')
  presetsTitle.textContent = 'Пресеты'
  const presetsClose = document.createElement('button')
  presetsClose.className = 'mtableIcon'
  presetsClose.type = 'button'
  presetsClose.innerHTML = closeIcon()
  presetsClose.setAttribute('aria-label', 'Закрыть пресеты')
  presetsHead.append(presetsTitle, presetsClose)
  const presetsBody = document.createElement('div')
  presetsBody.className = 'mtableDrawerBody'
  presetsBody.append(preSection, setSection)
  presetsPanel.append(presetsHead, presetsBody)

  const sndSection = document.createElement('div')
  sndSection.className = 'mtableSection'
  const sndTitle = document.createElement('span')
  sndTitle.className = 'mtableSectionTitle'
  sndTitle.textContent = 'Звук и вибрация'
  const sndToggle = document.createElement('button')
  sndToggle.className = 'mtableWide'
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
  const pwTitle = document.createElement('span')
  pwTitle.className = 'mtableSectionTitle'
  pwTitle.textContent = 'Сила броска'
  const pwBtns: HTMLButtonElement[] = THROW_POWERS.map((p) => {
    const b = document.createElement('button')
    b.className = 'mtableWide'
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
  const aboutTitle = document.createElement('span')
  aboutTitle.className = 'mtableSectionTitle'
  aboutTitle.textContent = 'О проекте'
  const aboutText = document.createElement('p')
  aboutText.className = 'mtableAbout'
  aboutText.textContent =
    'Kubica — точные кости D&D: d6 16 мм, набор d4–d20, грани N+1, честная физика. FreeCAD · OpenSCAD · CadQuery → Blender → three.js.'
  aboutSection.append(aboutTitle, aboutText)

  drawerBody.append(histSection, pwSection, sndSection, aboutSection)
  drawer.append(drawerHead, drawerBody)

  section.append(canvas, head, hint, live, backdrop, sheet, drawer, presetsPanel, toast)
  container.appendChild(section)

  const openSheet = () => {
    drawer.hidden = true
    presetsPanel.hidden = true
    sheet.hidden = false
    backdrop.hidden = false
    section.classList.add('sheetOpen')
    sheetClose.focus()
  }
  const openDrawer = () => {
    sheet.hidden = true
    presetsPanel.hidden = true
    drawer.hidden = false
    backdrop.hidden = false
    drawerClose.focus()
  }
  const openPresets = () => {
    sheet.hidden = true
    drawer.hidden = true
    presetsPanel.hidden = false
    backdrop.hidden = false
    renderSets()
    presetsClose.focus()
  }
  const closeOverlays = () => {
    sheet.hidden = true
    drawer.hidden = true
    presetsPanel.hidden = true
    backdrop.hidden = true
    section.classList.remove('sheetOpen')
  }
  // Esc закрывает шит/меню (фокус-минимум без полного trap).
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeOverlays()
  }
  document.addEventListener('keydown', onKey)
  diceBtn.addEventListener('click', () => (sheet.hidden ? openSheet() : closeOverlays()))
  presetsBtn.addEventListener('click', () =>
    presetsPanel.hidden ? openPresets() : closeOverlays(),
  )
  burger.addEventListener('click', () => (drawer.hidden ? openDrawer() : closeOverlays()))
  sheetClose.addEventListener('click', closeOverlays)
  drawerClose.addEventListener('click', closeOverlays)
  presetsClose.addEventListener('click', closeOverlays)
  backdrop.addEventListener('click', closeOverlays)

  const renderHistory = (entries: readonly HistoryEntry[]) => {
    histList.innerHTML = ''
    if (entries.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'mtableEmpty'
      empty.textContent = 'Пока пусто — кинь кости'
      histList.appendChild(empty)
      return
    }
    // Хронология в меню — короткая: последних 5 бросков хватает (дольше — реролл).
    for (const entry of entries.slice(0, 5)) {
      const row = document.createElement('button')
      row.className = 'mtableHrow'
      row.type = 'button'
      row.title = 'Повторить этот набор'
      const v = document.createElement('span')
      v.className = 'mtableHv'
      v.textContent = entry.display
      const meta = document.createElement('span')
      meta.className = 'mtableHmeta'
      meta.textContent = entry.label
        ? `${formatLabel(entry.label)} · ${fmtTime(entry.at)}`
        : fmtTime(entry.at)
      const parts = document.createElement('span')
      parts.className = 'mtableHp'
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

  /** Состав набора: кнопка в шапке («2d4 d12»), счётчик — по центру бургера. */
  const refreshChrome = (counts: TableCounts) => {
    const total = totalCount(counts)
    const phase = syncPhase(total)
    // На бургере — сумма последнего броска; пока кости летят — лоадер (не кнопка).
    if (rolling) {
      burger.innerHTML = '<span class="mtableSpin"></span>'
      burger.disabled = true
      burger.setAttribute('aria-busy', 'true')
    } else {
      burger.disabled = false
      burger.removeAttribute('aria-busy')
      if (lastResult) burger.textContent = String(lastResult.total)
      else burger.innerHTML = menuIcon()
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
      hint.textContent = 'Жми «+ Кости» или пресет — кости лягут на стол'
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
    for (const { btn, counts: preset } of presetChips) {
      btn.classList.toggle('on', total > 0 && sameCounts(counts, preset))
    }
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
    const gap = Math.max(22, biggest * 1.35)
    // Без верхних чипов и нижней панели поле пустое: кости — в реальном центре кадра.
    slots = layoutSlots(instances.length, gap).map((s) => ({ x: s.x, z: s.z }))
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
  renderSets()

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
