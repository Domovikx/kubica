import { describe, expect, it } from 'vitest'
import type { DieId } from '@/shared/dice/die-id'
import { DIE_HINTS, dieGlyph } from './die-glyph'

describe('die-glyph', () => {
  it('все 6 костей дают валидный svg с currentColor, формы разные', () => {
    const seen = new Set<string>()
    for (const die of Object.keys(DIE_HINTS) as DieId[]) {
      const svg = dieGlyph(die)
      expect(svg).toContain('<svg')
      expect(svg).toContain('stroke="currentColor"')
      seen.add(svg)
    }
    expect(seen.size).toBe(Object.keys(DIE_HINTS).length)
  })

  it('подписи-хинты покрывают все 6 костей', () => {
    expect([...Object.keys(DIE_HINTS)].sort()).toEqual(['d10', 'd12', 'd20', 'd4', 'd6', 'd8'])
  })
})
