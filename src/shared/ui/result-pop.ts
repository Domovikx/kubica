// Синглтон попа результата (.result-стили уже зарезервированы в app/styles.css).
// Показывается на каждый бросок, закрывается тапом или следующим броском.
let el: HTMLDivElement | null = null
let hideTimer = 0

const ensure = (): HTMLDivElement => {
  if (!el) {
    el = document.createElement('div')
    el.className = 'result'
    el.hidden = true
    el.addEventListener('click', hideResult)
    document.body.appendChild(el)
  }
  return el
}

export const showResult = (label: string, value: string, sub?: string): void => {
  const node = ensure()
  node.innerHTML = ''
  const labelEl = document.createElement('span')
  labelEl.className = 'resultLabel'
  labelEl.textContent = label
  const valueEl = document.createElement('span')
  valueEl.className = 'resultValue'
  valueEl.textContent = value
  node.append(labelEl, valueEl)
  if (sub) {
    const subEl = document.createElement('div')
    subEl.className = 'resultSum'
    subEl.textContent = sub
    node.appendChild(subEl)
  }
  // Перезапуск pop-анимации
  node.hidden = false
  node.style.animation = 'none'
  void node.offsetWidth
  node.style.animation = ''
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(hideResult, 6000)
}

export const hideResult = (): void => {
  if (el) el.hidden = true
  window.clearTimeout(hideTimer)
}
