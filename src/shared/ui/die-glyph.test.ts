import { describe, expect, it } from 'vitest'
import { DIE_IDS } from '@/entities/dice-geometry/geometry'
import { DIE_HINTS, dieGlyph } from './die-glyph'

describe('die-glyph', () => {
  it('все 6 костей дают валидный svg с currentColor, формы разные', () => {
    const seen = new Set<string>()
    for (const die of DIE_IDS) {
      const svg = dieGlyph(die)
      expect(svg).toContain('<svg')
      expect(svg).toContain('stroke="currentColor"')
      seen.add(svg)
    }
    expect(seen.size).toBe(DIE_IDS.length)
  })

  it('подписи-хинты покрывают все кости', () => {
    expect(Object.keys(DIE_HINTS).sort()).toEqual([...DIE_IDS].sort())
  })
})
