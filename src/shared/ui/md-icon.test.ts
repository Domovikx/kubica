import { describe, expect, it } from 'vitest'
import {
  addIcon,
  checkIcon,
  clearAllIcon,
  closeIcon,
  githubIcon,
  menuIcon,
  musicIcon,
  soundIcon,
  likeIcon,
  telegramIcon,
  vibrationIcon,
} from './md-icon'

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

  it('добавить — валидный svg, своя path у кнопки набора', () => {
    const add = addIcon()
    expect(add).toContain('<svg')
    expect(add).toContain('fill="currentColor"')
    expect(add).not.toBe(menuIcon())
    expect(add).not.toBe(closeIcon())
  })

  it('все экспортируемые иконки — svg с aria-hidden и без дублей path', () => {
    const all = [
      soundIcon(false),
      soundIcon(true),
      vibrationIcon(),
      musicIcon(true),
      musicIcon(false),
      menuIcon(),
      addIcon(),
      closeIcon(),
      checkIcon(),
      clearAllIcon(),
      githubIcon(),
      telegramIcon(),
      likeIcon(),
    ]
    for (const svg of all) {
      expect(svg).toContain('<svg')
      expect(svg).toContain('aria-hidden="true"')
    }
    expect(new Set(all).size).toBe(all.length)
  })

  it('убрать всё — валидный svg, не крестик', () => {
    expect(clearAllIcon()).toContain('<svg')
    expect(clearAllIcon()).not.toBe(closeIcon())
  })

  // 2.24: ✓ «Готово» — морф-состояние крестика закрытия после изменения в меню.
  it('галочка — валидный svg, currentColor, не совпадает с крестиком', () => {
    const check = checkIcon()
    expect(check).toContain('<svg')
    expect(check).toContain('fill="currentColor"')
    expect(check).toContain('aria-hidden="true"')
    expect(check).not.toBe(closeIcon())
  })

  // 2.17: бренды (simple-icons) — 24×24; лайк — octicon-star GitHub (сетка 16,
  // как и счётчик Stars на самом GitHub).
  it('соцсети — github/telegram в viewBox 0 0 24 24, лайк в 0 0 16 16', () => {
    expect(githubIcon()).toContain('viewBox="0 0 24 24"')
    expect(telegramIcon()).toContain('viewBox="0 0 24 24"')
    expect(likeIcon()).toContain('viewBox="0 0 16 16"')
    expect(githubIcon()).not.toBe(telegramIcon())
    for (const svg of [githubIcon(), telegramIcon(), likeIcon()]) {
      expect(svg).toContain('fill="currentColor"')
      expect(svg).toContain('aria-hidden="true"')
    }
  })

  it('лайк — свой path, не совпадает ни с одной шапочной иконкой', () => {
    expect(likeIcon()).toContain('<svg')
    for (const svg of [menuIcon(), addIcon(), soundIcon(false), closeIcon()]) {
      expect(likeIcon()).not.toBe(svg)
    }
  })

  // 2.22: фоновая музыка — нота вкл/выкл, разные path, своя от звука.
  it('музыка playing/off — разные path, currentColor, не совпадает со звуком', () => {
    const on = musicIcon(true)
    const off = musicIcon(false)
    expect(on).toContain('fill="currentColor"')
    expect(off).toContain('fill="currentColor"')
    expect(on).not.toBe(off)
    expect(on).not.toBe(soundIcon(false))
    expect(off).not.toBe(soundIcon(true))
  })
})
