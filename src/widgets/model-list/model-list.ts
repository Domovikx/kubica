import { MODELS } from '@/entities/model/models'
import {
  clearSelection,
  isSelected,
  subscribeSelection,
  toggleModel,
} from '@/features/select-model/select-model'
import './model-list.css'

export const mountModelList = (container: HTMLElement): (() => void) => {
  const title = document.createElement('p')
  title.className = 'sidebarTitle'
  title.textContent = 'Модели'

  const actions = document.createElement('div')
  actions.className = 'sidebarActions'
  const selectAllBtn = document.createElement('button')
  selectAllBtn.className = 'switchBtn'
  selectAllBtn.id = 'selectAll'
  selectAllBtn.type = 'button'
  selectAllBtn.textContent = 'Все'
  const clearBtn = document.createElement('button')
  clearBtn.className = 'switchBtn'
  clearBtn.id = 'clearAll'
  clearBtn.type = 'button'
  clearBtn.textContent = 'Ничего'
  actions.append(selectAllBtn, clearBtn)

  const list = document.createElement('div')
  list.className = 'modelList'
  list.id = 'modelList'

  container.append(title, actions, list)

  // Референсные образцы CAD-стеков скрыты из основного UI
  const visible = MODELS.filter((m) => !m.reference)
  const inputs: HTMLInputElement[] = []
  for (const model of visible) {
    const label = document.createElement('label')
    label.className = 'modelItem'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.value = model.id
    input.checked = isSelected(model.id)
    const code = document.createElement('span')
    code.className = 'modelItemCode'
    code.textContent = model.id
    const text = document.createElement('span')
    text.className = 'modelItemLabel'
    text.textContent = model.label
    label.append(input, code, text)
    input.addEventListener('change', () => {
      toggleModel(model.id, input.checked)
    })
    list.appendChild(label)
    inputs.push(input)
  }

  const onSelectAll = () => {
    // Только видимые: референсы остаются скрытыми
    for (const model of visible) toggleModel(model.id, true)
  }
  const onClear = () => clearSelection()
  selectAllBtn.addEventListener('click', onSelectAll)
  clearBtn.addEventListener('click', onClear)

  // Синхронизация чекбоксов при внешних изменениях (кнопки Все/Ничего)
  const unsubscribe = subscribeSelection(() => {
    for (const input of inputs) input.checked = isSelected(input.value)
  })

  return () => {
    unsubscribe()
    selectAllBtn.removeEventListener('click', onSelectAll)
    clearBtn.removeEventListener('click', onClear)
    container.innerHTML = ''
  }
}
