import { describe, expect, it } from 'vitest'
import { formatLabel } from './format'

describe('formatLabel: лейбл для показа', () => {
  it('плюс-разделитель костей → пробел', () => {
    expect(formatLabel('d4+d6')).toBe('d4 d6')
    expect(formatLabel('d20+d6')).toBe('d20 d6')
    expect(formatLabel('4d6+2d4')).toBe('4d6 2d4')
  })

  it('модификаторы и минус остаются частью нотации', () => {
    expect(formatLabel('2d20kh1+5')).toBe('2d20kh1+5')
    expect(formatLabel('4d6-L')).toBe('4d6-L')
    expect(formatLabel('8d6')).toBe('8d6')
  })
})
