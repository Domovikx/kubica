// Синглтон попа результата (.result-стили уже зарезервированы в app/styles.css).
// Показывается на каждый бросок, закрывается тапом или следующим броском.
// Разбивка пула — структурой (kept/dropped классами), скринридеру — текстом
// через aria-label (role=status = живой регион).
let el: HTMLDivElement | null = null
let hideTimer = 0

const ensure = (): HTMLDivElement => {
  if (!el) {
    el = document.createElement('div')
    el.className = 'result'
    el.hidden = true
    el.setAttribute('role', 'status')
    el.addEventListener('click', hideResult)
    document.body.appendChild(el)
  }
  return el
}

/** Одна часть разбивки (утиная типизация под PoolPart — shared не импортирует entities). */
export interface ResultPart {
  display: string
  kept: boolean
}

export const showResult = (
  label: string,
  value: string,
  sub?: string,
  parts?: readonly ResultPart[],
): void => {
  const node = ensure()
  node.innerHTML = ''
  const labelEl = document.createElement('span')
  labelEl.className = 'resultLabel'
  labelEl.textContent = label
  const valueEl = document.createElement('span')
  valueEl.className = 'resultValue'
  valueEl.textContent = value
  node.append(labelEl, valueEl)
  if (parts && parts.length > 0) {
    const partsEl = document.createElement('div')
    partsEl.className = 'resultParts'
    partsEl.setAttribute('aria-hidden', 'true')
    for (const p of parts) {
      const s = document.createElement('span')
      s.className = p.kept ? 'partKept' : 'partDrop'
      s.textContent = p.display
      partsEl.appendChild(s)
    }
    node.appendChild(partsEl)
    // Скринридер: сумма + части словами (визуальные классы он не видит)
    const spoken = parts.map((p) => (p.kept ? p.display : `${p.display}, сброшена`)).join(', ')
    node.setAttribute('aria-label', `${label}: ${value}. Части: ${spoken}`)
  } else {
    if (sub) {
      const subEl = document.createElement('div')
      subEl.className = 'resultSum'
      subEl.textContent = sub
      node.appendChild(subEl)
    }
    node.setAttribute('aria-label', sub ? `${label}: ${value}, ${sub}` : `${label}: ${value}`)
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
