import {
  formatLabel,
  formatParts,
  getHistoryStore,
  type HistoryEntry,
} from '@/entities/roll-history/history'
import { parseNotation } from '@/entities/dice-notation/notation'
import { quickRoll } from '@/features/roll-dice/quick-roll'
import { rollPool } from '@/features/dice-pool/pool'
import { isMuted, setMuted } from '@/features/roll-dice/sound'
import type { DieId } from '@/entities/dice-geometry/geometry'
import './roll-history.css'

const fmtTime = (at: number): string => {
  const d = new Date(at)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export const mountRollHistory = (container: HTMLElement): (() => void) => {
  const title = document.createElement('p')
  title.className = 'sidebarTitle'
  title.dataset.testid = 'history-title'
  title.textContent = 'История бросков'

  const actions = document.createElement('div')
  actions.className = 'sidebarActions'
  actions.dataset.testid = 'history-actions'
  const muteBtn = document.createElement('button')
  muteBtn.className = 'switchBtn'
  muteBtn.dataset.testid = 'history-mute'
  muteBtn.type = 'button'
  const syncMute = () => {
    muteBtn.textContent = isMuted() ? 'Звук: выкл' : 'Звук: вкл'
  }
  syncMute()
  const clearBtn = document.createElement('button')
  clearBtn.className = 'switchBtn'
  clearBtn.dataset.testid = 'history-clear'
  clearBtn.type = 'button'
  clearBtn.textContent = 'Очистить'
  actions.append(muteBtn, clearBtn)

  const list = document.createElement('div')
  list.className = 'historyList'
  list.dataset.testid = 'history-list'

  container.append(title, actions, list)

  const store = getHistoryStore()
  const pending = new Set<string>()

  const render = (entries: readonly HistoryEntry[]) => {
    list.innerHTML = ''
    if (entries.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'historyEmpty'
      empty.dataset.testid = 'history-empty'
      empty.textContent = 'Пока пусто — тапните по кости'
      list.appendChild(empty)
      return
    }
    entries.forEach((entry, i) => {
      const row = document.createElement('div')
      row.className = 'historyRow'
      row.dataset.testid = 'history-row'
      const main = document.createElement('button')
      main.className = 'historyMain'
      main.dataset.testid = 'history-main'
      main.type = 'button'
      main.title = 'Бросить ещё раз'
      const value = document.createElement('span')
      value.className = 'historyValue'
      value.dataset.testid = 'history-value'
      value.textContent = entry.display
      const meta = document.createElement('span')
      meta.className = 'historyMeta'
      meta.dataset.testid = 'history-meta'
      meta.textContent = entry.label
        ? `${formatLabel(entry.label)} · ${fmtTime(entry.at)}`
        : `${entry.die} · ${fmtTime(entry.at)}`
      main.append(value, meta)
      // Разбивка пула 2.3: части текстом (скобки = сброшена) + классы kept/drop.
      // Реролл — тем же выражением пула (label), одиночка — одиночкой (ниже).
      if (entry.parts && entry.parts.length > 0) {
        const parts = document.createElement('span')
        parts.className = 'historyParts'
        parts.dataset.testid = 'history-parts'
        const texts = formatParts(entry.parts)
        entry.parts.forEach((p, i) => {
          const s = document.createElement('span')
          s.className = p.kept ? 'partKept' : 'partDrop'
          s.textContent = texts[i]
          parts.appendChild(s)
        })
        main.appendChild(parts)
      }
      main.disabled = pending.has(`${entry.at}:${i}`)
      main.addEventListener('click', () => {
        const key = `${entry.at}:${i}`
        if (pending.has(key)) return
        pending.add(key)
        main.disabled = true
        const done = () => {
          pending.delete(key)
        }
        // Пул перебрасывается пулом, одиночка — одиночкой
        if (entry.label) {
          try {
            void rollPool(parseNotation(entry.label)).finally(done)
          } catch {
            done()
          }
        } else {
          void quickRoll(entry.die as DieId).finally(done)
        }
      })
      list.appendChild(row)
      row.appendChild(main)
    })
  }

  const onMute = () => {
    setMuted(!isMuted())
    syncMute()
  }
  const onClear = () => store.clear()
  muteBtn.addEventListener('click', onMute)
  clearBtn.addEventListener('click', onClear)
  const unsubscribe = store.subscribe(render)

  return () => {
    unsubscribe()
    muteBtn.removeEventListener('click', onMute)
    clearBtn.removeEventListener('click', onClear)
    container.innerHTML = ''
  }
}
