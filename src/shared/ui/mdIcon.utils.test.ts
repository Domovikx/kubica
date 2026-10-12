import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
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
} from './mdIcon.utils'

// Иконки — React-узлы (волна Whtml); ассерты — по статической разметке.
const markup = (el: React.JSX.Element): string => renderToStaticMarkup(el)

describe('mdIcon.utils', () => {
  it('звук вкл/выкл — разные path, currentColor', () => {
    const on = markup(soundIcon(false))
    const off = markup(soundIcon(true))
    expect(on).toContain('fill="currentColor"')
    expect(off).toContain('fill="currentColor"')
    expect(on).not.toBe(off)
  })

  it('вибрация — валидный svg', () => {
    expect(markup(vibrationIcon())).toContain('<svg')
  })

  it('меню и крестик — валидные svg, разные path', () => {
    const menu = markup(menuIcon())
    const close = markup(closeIcon())
    expect(menu).toContain('<svg')
    expect(close).toContain('<svg')
    expect(menu).toContain('fill="currentColor"')
    expect(menu).not.toBe(close)
  })

  it('добавить — валидный svg, своя path у кнопки набора', () => {
    const add = markup(addIcon())
    expect(add).toContain('<svg')
    expect(add).toContain('fill="currentColor"')
    expect(add).not.toBe(markup(menuIcon()))
    expect(add).not.toBe(markup(closeIcon()))
  })

  it('все экспортируемые иконки — svg с aria-hidden и без дублей path', () => {
    const all = [
      markup(soundIcon(false)),
      markup(soundIcon(true)),
      markup(vibrationIcon()),
      markup(musicIcon(true)),
      markup(musicIcon(false)),
      markup(menuIcon()),
      markup(addIcon()),
      markup(closeIcon()),
      markup(checkIcon()),
      markup(clearAllIcon()),
      markup(githubIcon()),
      markup(telegramIcon()),
      markup(likeIcon()),
    ]
    for (const svg of all) {
      expect(svg).toContain('<svg')
      expect(svg).toContain('aria-hidden="true"')
    }
    expect(new Set(all).size).toBe(all.length)
  })

  it('убрать всё — валидный svg, не крестик', () => {
    expect(markup(clearAllIcon())).toContain('<svg')
    expect(markup(clearAllIcon())).not.toBe(markup(closeIcon()))
  })

  // 2.24: ✓ «Готово» — морф-состояние крестика закрытия после изменения в меню.
  it('галочка — валидный svg, currentColor, не совпадает с крестиком', () => {
    const check = markup(checkIcon())
    expect(check).toContain('<svg')
    expect(check).toContain('fill="currentColor"')
    expect(check).toContain('aria-hidden="true"')
    expect(check).not.toBe(markup(closeIcon()))
  })

  // 2.17: бренды (simple-icons) — 24×24; лайк — octicon-star GitHub (сетка 16,
  // как и счётчик Stars на самом GitHub).
  it('соцсети — github/telegram в viewBox 0 0 24 24, лайк в 0 0 16 16', () => {
    expect(markup(githubIcon())).toContain('viewBox="0 0 24 24"')
    expect(markup(telegramIcon())).toContain('viewBox="0 0 24 24"')
    expect(markup(likeIcon())).toContain('viewBox="0 0 16 16"')
    expect(markup(githubIcon())).not.toBe(markup(telegramIcon()))
    for (const svg of [markup(githubIcon()), markup(telegramIcon()), markup(likeIcon())]) {
      expect(svg).toContain('fill="currentColor"')
      expect(svg).toContain('aria-hidden="true"')
    }
  })

  it('лайк — свой path, не совпадает ни с одной шапочной иконкой', () => {
    expect(markup(likeIcon())).toContain('<svg')
    for (const svg of [
      markup(menuIcon()),
      markup(addIcon()),
      markup(soundIcon(false)),
      markup(closeIcon()),
    ]) {
      expect(markup(likeIcon())).not.toBe(svg)
    }
  })

  // 2.22: фоновая музыка — нота вкл/выкл, разные path, своя от звука.
  it('музыка playing/off — разные path, currentColor, не совпадает со звуком', () => {
    const on = markup(musicIcon(true))
    const off = markup(musicIcon(false))
    expect(on).toContain('fill="currentColor"')
    expect(off).toContain('fill="currentColor"')
    expect(on).not.toBe(off)
    expect(on).not.toBe(markup(soundIcon(false)))
    expect(off).not.toBe(markup(soundIcon(true)))
  })
})
