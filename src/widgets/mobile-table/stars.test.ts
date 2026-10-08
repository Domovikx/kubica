// Кэш звёзд — граница чтения localStorage: битое значение не должно
// навсегда убить счётчик (молча → без кэша, запрос всё равно уйдёт).
import { describe, expect, it } from 'vitest'
import { parseStarsCache, STAR_KEY, STAR_TTL_MS } from './stars'

describe('stars: кэш в localStorage', () => {
  it('валидная запись читается как есть', () => {
    expect(parseStarsCache(JSON.stringify({ at: 1728000000000, n: 45 }))).toEqual({
      at: 1728000000000,
      n: 45,
    })
  })

  it('null и битый JSON → null без throw', () => {
    expect(parseStarsCache(null)).toBeNull()
    expect(parseStarsCache('{oops')).toBeNull()
    expect(parseStarsCache('')).toBeNull()
  })

  it('чужая форма (строки, массивы, отсутствующие поля) → null', () => {
    expect(parseStarsCache('["kubica-stars"]')).toBeNull()
    expect(parseStarsCache('{"at":"now","n":1}')).toBeNull()
    expect(parseStarsCache('{"n":1}')).toBeNull()
    expect(parseStarsCache('{"at":1}')).toBeNull()
    expect(parseStarsCache('null')).toBeNull()
  })

  it('контракт ключа и TTL несут сутки', () => {
    expect(STAR_KEY).toBe('kubica-stars')
    expect(STAR_TTL_MS).toBe(24 * 60 * 60 * 1000)
  })
})
