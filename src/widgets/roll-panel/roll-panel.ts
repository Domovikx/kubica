import { createPoolStore, type PoolState, type StepperSides } from '@/features/dice-pool/pool-store'
import { rollPool } from '@/features/dice-pool/pool'
import './roll-panel.css'

const STEPPERS: StepperSides[] = [4, 6, 8, 10, 12, 20]

const PRESETS = [
  { name: 'Advantage', formula: '2d20kh1' },
  { name: 'Stats', formula: '4d6-L' },
  { name: 'Fireball', formula: '8d6' },
]

const breakdownText = (s: PoolState): string => {
  if (!s.result) return ''
  return s.result.parts.map((p) => (p.kept ? p.display : `(${p.display})`)).join(' ')
}

export const mountRollPanel = (container: HTMLElement): (() => void) => {
  const store = createPoolStore((expr) => rollPool(expr))

  const root = document.createElement('section')
  root.className = 'rollPanel'
  root.dataset.testid = 'roll-panel'

  const title = document.createElement('p')
  title.className = 'sidebarTitle'
  title.dataset.testid = 'roll-title'
  title.textContent = 'Пул костей'
  root.appendChild(title)

  const stepBox = document.createElement('div')
  stepBox.className = 'rollSteppers'
  stepBox.dataset.testid = 'roll-steppers'
  const countSpans = new Map<number, HTMLSpanElement>()
  for (const sides of STEPPERS) {
    const row = document.createElement('div')
    row.className = 'rollStepper'
    row.dataset.testid = 'roll-stepper'
    const code = document.createElement('span')
    code.className = 'rollStepperCode'
    code.dataset.testid = 'roll-stepper-code'
    code.textContent = `d${sides}`
    const minus = document.createElement('button')
    minus.className = 'switchBtn rollStepperBtn'
    minus.dataset.testid = 'roll-stepper-minus'
    minus.type = 'button'
    minus.textContent = '−'
    minus.title = `Убрать d${sides}`
    minus.addEventListener('click', () => store.adjustDie(sides, -1))
    const count = document.createElement('span')
    count.className = 'rollStepperCount'
    count.dataset.testid = 'roll-stepper-count'
    count.textContent = '0'
    const plus = document.createElement('button')
    plus.className = 'switchBtn rollStepperBtn'
    plus.dataset.testid = 'roll-stepper-plus'
    plus.type = 'button'
    plus.textContent = '+'
    plus.title = `Добавить d${sides}`
    plus.addEventListener('click', () => store.adjustDie(sides, 1))
    row.append(code, minus, count, plus)
    stepBox.appendChild(row)
    countSpans.set(sides, count)
  }
  root.appendChild(stepBox)

  const formula = document.createElement('input')
  formula.className = 'rollFormula'
  formula.dataset.testid = 'roll-formula'
  formula.type = 'text'
  formula.placeholder = '2d20kh1+5'
  formula.setAttribute('aria-label', 'Формула пула')
  formula.addEventListener('input', () => store.setFormula(formula.value))
  root.appendChild(formula)

  const err = document.createElement('p')
  err.className = 'rollError'
  err.dataset.testid = 'roll-error'
  err.hidden = true
  root.appendChild(err)

  const presetBox = document.createElement('div')
  presetBox.className = 'rollPresets'
  presetBox.dataset.testid = 'roll-presets'
  for (const preset of PRESETS) {
    const btn = document.createElement('button')
    btn.className = 'switchBtn'
    btn.dataset.testid = 'roll-preset'
    btn.type = 'button'
    btn.textContent = preset.name
    btn.title = preset.formula
    btn.addEventListener('click', () => store.applyPreset(preset.formula))
    presetBox.appendChild(btn)
  }
  root.appendChild(presetBox)

  const rollBtn = document.createElement('button')
  rollBtn.className = 'switchBtn rollGo'
  rollBtn.dataset.testid = 'roll-go'
  rollBtn.type = 'button'
  rollBtn.textContent = 'Бросить пул'
  rollBtn.addEventListener('click', () => {
    void store.roll().catch(() => undefined)
  })
  root.appendChild(rollBtn)

  const total = document.createElement('p')
  total.className = 'rollTotal'
  total.dataset.testid = 'roll-total'
  total.hidden = true
  const parts = document.createElement('p')
  parts.className = 'rollParts'
  parts.dataset.testid = 'roll-parts'
  parts.hidden = true
  root.append(total, parts)

  const sync = (s: PoolState): void => {
    // Пока пользователь печатает — значение поля не трогаем (не теряем фокус)
    if (document.activeElement !== formula) formula.value = s.formula
    err.textContent = s.error ?? ''
    err.hidden = s.error === null
    rollBtn.disabled = s.error !== null || s.expr === null || s.phase === 'rolling'
    rollBtn.textContent = s.phase === 'rolling' ? 'Бросаем…' : 'Бросить пул'
    const counts = new Map<number, number>()
    for (const t of s.expr?.terms ?? []) {
      if (t.term.kind === 'dice')
        counts.set(t.term.sides, (counts.get(t.term.sides) ?? 0) + t.term.count)
    }
    for (const sides of STEPPERS) {
      const span = countSpans.get(sides)
      if (span) span.textContent = String(counts.get(sides) ?? 0)
    }
    if (s.result) {
      total.textContent = `= ${s.result.total}`
      total.hidden = false
      parts.textContent = breakdownText(s)
      parts.hidden = false
    } else {
      total.hidden = true
      parts.hidden = true
    }
  }
  const unsubscribe = store.subscribe(sync)
  sync(store.getState())
  container.appendChild(root)

  return () => {
    unsubscribe()
    container.innerHTML = ''
  }
}
