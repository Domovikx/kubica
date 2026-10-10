import { describe, expect, it } from 'vitest'
import { formatLabel, formatParts, type PoolPart } from './history'

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

describe('formatParts: текстовая разбивка пула', () => {
  const part = (over: Partial<PoolPart>): PoolPart => ({
    die: 'd20',
    value: 1,
    display: '1',
    kept: true,
    ...over,
  })

  it('advantage 2d20kh1 [7, 19]: сброшенная в скобках', () => {
    expect(
      formatParts([
        part({ value: 7, display: '7', kept: false }),
        part({ value: 19, display: '19', kept: true }),
      ]),
    ).toEqual(['(7)', '19'])
  })

  it('все удержаны — как есть, пустой пул — пусто', () => {
    expect(
      formatParts([
        part({ die: 'd6', value: 3, display: '3' }),
        part({ die: 'd6', value: 5, display: '5' }),
      ]),
    ).toEqual(['3', '5'])
    expect(formatParts([])).toEqual([])
  })

  it('display не пересчитывается (d10: «10» проходит как есть)', () => {
    expect(formatParts([part({ die: 'd10', value: 0, display: '10', kept: false })])).toEqual([
      '(10)',
    ])
  })
})
