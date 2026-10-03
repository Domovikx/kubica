import { DIE_IDS, type DieId } from '@/entities/dice-geometry/geometry'
import { tickRolls } from '@/features/roll-dice/quick-roll'
import { getSetupStore } from '@/features/table-setup/table-setup'
import { tickPoolWorld } from '@/features/dice-pool/pool'
import { mountGlassTable } from '@/widgets/glass-table/glass-table'
import { mountMobileTable } from '@/widgets/mobile-table/mobile-table'
import { mountModelList } from '@/widgets/model-list/model-list'
import { mountRollHistory } from '@/widgets/roll-history/roll-history'
import { mountRollPanel } from '@/widgets/roll-panel/roll-panel'
import { mountViewerGrid } from '@/widgets/viewer-grid/viewer-grid'

/**
 * Мультистол: `?table` — набор из стора (персист); `?glass=д4,д6` — тот же
 * стол с предустановленным набором. Иначе — старая сетка панелей (эталоны),
 * включая одиночный `?glass=д6`.
 */
const tableMode = (): boolean => {
  const params = new URLSearchParams(window.location.search)
  if (params.has('table')) return true
  const raw = params.get('glass')
  if (raw === null || !raw.includes(',')) return false
  const want = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => (DIE_IDS as readonly string[]).includes(s)) as DieId[]
  if (want.length < 2) return false
  // Явный список становится набором стола (единый путь, без форков).
  const setup = getSetupStore()
  setup.clear()
  for (const die of want) setup.add(die, 1)
  return true
}

export const mountHomePage = (): (() => void) => {
  const sidebar = document.getElementById('sidebar') as HTMLElement
  const viewers = document.getElementById('viewers') as HTMLElement

  // Прототип мобайл-стола (?m=1, макет F): всё своё, сайдбар не монтируем.
  const params = new URLSearchParams(window.location.search)
  if (params.has('m')) {
    document.body.dataset.mode = 'mtable'
    const grid = mountMobileTable(viewers)
    const onResize = () => grid.resize()
    window.addEventListener('resize', onResize)
    grid.resize()
    let raf = 0
    const animate = () => {
      if (!document.hidden) {
        tickRolls()
        tickPoolWorld()
        grid.update()
      }
      raf = requestAnimationFrame(animate)
    }
    animate()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      grid.dispose()
    }
  }

  // Стол или сетка — один интерфейс {update, resize, dispose}.
  const isTable = tableMode()
  // Маркер режима для CSS (мобайл-раскладка стола и т.п.).
  document.body.dataset.mode = isTable ? 'table' : 'grid'
  // В режиме стола сайдбар — только история: костями управляет степпер-бар
  // на столе (чекбоксы и пул-панель headless-пула там только мешают).
  const disposeList = isTable ? () => {} : mountModelList(sidebar)
  const disposePool = (() => {
    if (isTable) return () => {}
    const poolSection = document.createElement('div')
    poolSection.className = 'sidebarSection'
    sidebar.appendChild(poolSection)
    return mountRollPanel(poolSection)
  })()
  const historySection = document.createElement('div')
  historySection.className = 'sidebarSection'
  sidebar.appendChild(historySection)
  const disposeHistory = mountRollHistory(historySection)
  const grid = isTable ? mountGlassTable(viewers) : mountViewerGrid(viewers)
  if (isTable) {
    // Хинт шапки под новый UI стола (в index.html — старый текст про список).
    const hint = document.querySelector('.topbar .hint')
    if (hint) hint.textContent = 'Добавляй кости в доке внизу · тап по кости или кнопка — бросок'
  }

  const onResize = () => grid.resize()
  window.addEventListener('resize', onResize)
  grid.resize()

  let raf = 0
  const animate = () => {
    // Скрытая вкладка: кадры не рендерим (батарея), rAF и так троттлится.
    // Физика тоже качается отсюда же: в фоне setTimeout заморожены,
    // поэтому бросок просто ждёт возвращения вкладки, а не виснет.
    if (!document.hidden) {
      tickRolls()
      tickPoolWorld()
      grid.update()
    }
    raf = requestAnimationFrame(animate)
  }
  animate()

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    disposeList()
    disposePool()
    disposeHistory()
    grid.dispose()
  }
}
