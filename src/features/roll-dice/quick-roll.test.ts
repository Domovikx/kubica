import { describe, expect, it } from 'vitest'
import { releasePower } from './quick-roll'

describe('releasePower: сила релиза зарядки', () => {
  it('floor 1.0: любой отпуск — полный бросок (gentle-drop закрыт)', () => {
    expect(releasePower(0, 0)).toBe(1)
    expect(releasePower(-1, -5)).toBe(1)
  })

  it('заряд +0..0.5, флик +0..0.4, кап 1.6', () => {
    expect(releasePower(1, 0)).toBe(1.5)
    expect(releasePower(0, 4)).toBe(1.4)
    expect(releasePower(1, 10)).toBe(1.6)
    expect(releasePower(0.5, 2)).toBeCloseTo(1.45, 10)
  })
})
