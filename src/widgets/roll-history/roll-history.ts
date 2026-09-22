import { getHistoryStore, type HistoryEntry } from '@/entities/roll-history/history'
import { quickRoll } from '@/features/roll-dice/quick-roll'
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
  title.textContent = 'История бросков'

  const actions = document.createElement('div')
  actions.className = 'sidebarActions'
  const muteBtn = document.createElement('button')
  muteBtn.className = 'switchBtn'
  muteBtn.type = 'button'
  const syncMute = () => {
    muteBtn.textContent = isMuted() ? 'Звук: выкл' : 'Звук: вкл'
  }
  syncMute()
  const clearBtn = document.createElement('button')
  clearBtn.className = 'switchBtn'
  clearBtn.type = 'button'
  clearBtn.textContent = 'Очистить'
  actions.append(muteBtn, clearBtn)

  const list = document.createElement('div')
  list.className = 'historyList'

  container.append(title, actions, list)

  const store = getHistoryStore()
  const pending = new Set<string>()

  const render = (entries: readonly HistoryEntry[]) => {
    list.innerHTML = ''
    if (entries.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'historyEmpty'
      empty.textContent = 'Пока пусто — тапните по кости'
      list.appendChild(empty)
      return
    }
    entries.forEach((entry, i) => {
      const row = document.createElement('div')
      row.className = 'historyRow'
      const main = document.createElement('button')
      main.className = 'historyMain'
      main.type = 'button'
      main.title = 'Бросить ещё раз'
      const value = document.createElement('span')
      value.className = 'historyValue'
      value.textContent = entry.display
      const meta = document.createElement('span')
      meta.className = 'historyMeta'
      meta.textContent = `${entry.die} · ${fmtTime(entry.at)}`
      main.append(value, meta)
      main.disabled = pending.has(`${entry.at}:${i}`)
      main.addEventListener('click', () => {
        const key = `${entry.at}:${i}`
        if (pending.has(key)) return
        pending.add(key)
        main.disabled = true
        void quickRoll(entry.die as DieId).finally(() => {
          pending.delete(key)
        })
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
