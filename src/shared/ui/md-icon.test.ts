import { describe, expect, it } from 'vitest'
import { clearAllIcon, closeIcon, menuIcon, presetsIcon, soundIcon, vibrationIcon } from './md-icon'

describe('md-icon', () => {
  it('звук вкл/выкл — разные path, currentColor', () => {
    const on = soundIcon(false)
    const off = soundIcon(true)
    expect(on).toContain('fill="currentColor"')
    expect(off).toContain('fill="currentColor"')
    expect(on).not.toBe(off)
  })

  it('вибрация — валидный svg', () => {
    expect(vibrationIcon()).toContain('<svg')
  })

  it('меню и крестик — валидные svg, разные path', () => {
    const menu = menuIcon()
    const close = closeIcon()
    expect(menu).toContain('<svg')
    expect(close).toContain('<svg')
    expect(menu).toContain('fill="currentColor"')
    expect(menu).not.toBe(close)
  })

  it('пресеты — валидный svg', () => {
    expect(presetsIcon()).toContain('<svg')
    expect(presetsIcon()).not.toBe(menuIcon())
  })

  it('убрать всё — валидный svg, не крестик', () => {
    expect(clearAllIcon()).toContain('<svg')
    expect(clearAllIcon()).not.toBe(closeIcon())
  })
})
