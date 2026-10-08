// Панель состояния стола: фаза (data-phase на секции — для тестов/чекеров),
// бургер (сумма/лоадер), кнопка набора, хинт-empty-state, футер-разбивка,
// заголовок/очистка шторки, степперы и чипы пресетов. Чистое отображение:
// живое состояние читается через state() на каждый refresh, мутабльное
// (rolling/charging/сет/чипы) остаётся в замыкании mountMobileTable.
import { DIE_IDS, type DieId } from '@/entities/dice-geometry/geometry'
import { formatParts, type PoolPart } from '@/entities/roll-history/history'
import {
  MAX_PER_DIE,
  MAX_TOTAL,
  totalCount,
  type TableCounts,
} from '@/features/table-setup/table-setup'
import { addIcon, menuIcon } from '@/shared/ui/md-icon'
import { hideResult } from '@/shared/ui/result-pop'
import { shortSet, summarize } from './format'

export interface ChromeState {
  rolling: boolean
  /** Зарядка (wind-up) — фаза charging. */
  charging: boolean
  loadError: string
  /** Загруженные GLB: сколько/сколько (фаза loading). */
  loaded: number
  instances: number
  lastResult: { total: number; parts: PoolPart[] } | null
  activeSet: string | null
}

export const createChrome = (deps: {
  state: () => ChromeState
  els: {
    section: HTMLElement
    burger: HTMLButtonElement
    foot: HTMLElement
    footParts: HTMLElement
    diceBtn: HTMLButtonElement
    hint: HTMLButtonElement
    hintTitle: HTMLElement
    hintSub: HTMLElement
    hintCta: HTMLElement
    hintInfo: HTMLElement
    sheetTitle: HTMLElement
    sheetClear: HTMLButtonElement
    rowCounts: Map<DieId, HTMLSpanElement>
    rowRoots: Map<DieId, HTMLElement>
    /** Чипы пресетов пересобираются — читаем живой массив. */
    getChips: () => HTMLButtonElement[]
    saveBtn: HTMLButtonElement
    fitHeadStar: () => void
  }
}): { refresh: (counts: TableCounts) => void } => {
  const { els } = deps

  /** Статус вместо композиции (грузится / ошибка): одна строка, без CTA. */
  const hintStatus = (text: string, disabled: boolean): void => {
    els.hintTitle.textContent = text
    els.hintSub.hidden = true
    els.hintCta.hidden = true
    els.hintInfo.hidden = true
    els.hint.hidden = false
    els.hint.disabled = disabled
  }

  const refresh = (counts: TableCounts): void => {
    const st = deps.state()
    const total = totalCount(counts)
    // Фаза стола для тестов/чекеров: empty | loading | ready | charging | rolling.
    const phase =
      total === 0
        ? 'empty'
        : st.rolling
          ? 'rolling'
          : st.charging
            ? 'charging'
            : st.loaded < st.instances
              ? 'loading'
              : 'ready'
    els.section.dataset.phase = phase
    // На бургере — крупная сумма последнего броска (иконка меню — до броска),
    // лоадер — пока кости летят. Разбивка — в футере.
    if (st.rolling) {
      els.burger.innerHTML = '<span class="mtableSpin" data-testid="mtable-spin"></span>'
      els.burger.disabled = true
      els.burger.setAttribute('aria-busy', 'true')
    } else {
      els.burger.disabled = false
      els.burger.removeAttribute('aria-busy')
      if (st.lastResult) els.burger.textContent = String(st.lastResult.total)
      else els.burger.innerHTML = menuIcon()
    }
    els.burger.classList.toggle('hasSum', !st.rolling && st.lastResult !== null)
    // Футер: разбивка пробелами («4 3 1 6 4 8 8 1 10 5»).
    if (st.lastResult && !st.rolling) {
      const breakdown = formatParts(st.lastResult.parts).join(' ')
      els.footParts.textContent = breakdown
      els.foot.hidden = false
      els.foot.title = breakdown
    } else {
      els.foot.hidden = true
    }
    const short = shortSet(counts)
    // Пусто — значок «+» (пара бургер-иконке), состав — текстом: он информативен,
    // без него кнопка становится «слепой». aria-label/title — в обоих состояниях.
    const label = total > 0 ? `Выбор костей: ${short}` : 'Выбор костей'
    els.diceBtn.setAttribute('aria-label', label)
    els.diceBtn.title = total > 0 ? summarize(counts) : label
    if (total > 0) els.diceBtn.textContent = short
    // Значок ставим один раз на пустое состояние (firstElementChild — svg, текста нет).
    else if (els.diceBtn.firstElementChild === null) els.diceBtn.innerHTML = addIcon()
    // Хинт-empty-state: пусто (композиция → шит) / грузится (disabled) /
    // ошибка загрузки; кости есть — hidden.
    if (st.loadError) {
      hintStatus(`Не загрузилась: ${st.loadError}`, false)
    } else if (total === 0) {
      els.hintTitle.textContent = 'Добавь кости на стол'
      els.hintSub.textContent = 'Пресеты и любой состав — внутри'
      els.hintSub.hidden = false
      els.hintCta.hidden = false
      els.hintInfo.hidden = false
      els.hint.hidden = false
      els.hint.disabled = false
    } else if (phase === 'loading') {
      hintStatus(`Гружу… ${st.loaded}/${st.instances}`, true)
    } else {
      els.hint.hidden = true
    }
    if (total === 0) hideResult()
    // Заголовок шторки: пусто — функция панели, иначе — набор значений.
    els.sheetTitle.textContent = short || 'Выбор костей'
    els.sheetClear.disabled = total === 0
    for (const die of DIE_IDS) {
      const n = counts[die] ?? 0
      const span = els.rowCounts.get(die)
      if (span) span.textContent = String(n)
      const root = els.rowRoots.get(die)
      root?.classList.toggle('on', n > 0)
      const [minus, plus] = root?.querySelectorAll('button') ?? []
      if (minus instanceof HTMLButtonElement) minus.disabled = st.rolling || n <= 0
      if (plus instanceof HTMLButtonElement)
        plus.disabled = st.rolling || n >= MAX_PER_DIE || total >= MAX_TOTAL
    }
    for (const btn of els.getChips()) {
      const on = btn.dataset.set === st.activeSet
      btn.classList.toggle('on', on)
      btn.setAttribute('aria-pressed', String(on))
    }
    els.saveBtn.textContent = st.activeSet ? 'Обновить набор' : 'Сохранить сет'
    els.saveBtn.disabled = st.rolling || total === 0
    // Состав мог изменить ширину шапки — пересаживаем лайк (см. fitHeadStar).
    els.fitHeadStar()
  }

  return { refresh }
}
