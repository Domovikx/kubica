import { describe, expect, it } from 'vitest'
import { DIE_IDS } from '@/entities/dice-geometry/geometry'
import { DEFAULT_SELECTED, MODELS } from './models'

describe('models registry', () => {
  it('id уникальны', () => {
    const ids = MODELS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('у каждой модели есть url и подпись; url лежит в cad/ под BASE', () => {
    for (const m of MODELS) {
      expect(m.url.length).toBeGreaterThan(0)
      expect(m.label.length).toBeGreaterThan(0)
      expect(m.url).toContain('cad/')
    }
  })

  it('DEFAULT_SELECTED ссылается на существующие id', () => {
    const ids = new Set(MODELS.map((m) => m.id))
    for (const id of DEFAULT_SELECTED) expect(ids.has(id)).toBe(true)
  })

  it('reference-модели — только образцы сравнения CAD-стеков', () => {
    const reference = MODELS.filter((m) => m.reference)
    expect(reference.length).toBeGreaterThan(0)
    for (const m of reference) expect(m.id).toMatch(/^d6-(freecad|openscad|cadquery)$/)
    for (const m of MODELS.filter((m) => !m.reference)) expect(m.id).not.toMatch(/-/)
  })

  it('игровой набор покрывает все кости стола', () => {
    const ids = new Set(MODELS.filter((m) => !m.reference).map((m) => m.id))
    for (const die of DIE_IDS) expect(ids.has(die)).toBe(true)
  })
})
