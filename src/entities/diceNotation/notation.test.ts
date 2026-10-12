import { describe, expect, it } from 'vitest'
import { NotationError, normalize, parseNotation } from './notation'

describe('dice-notation: валидное → AST/normalize', () => {
  // Каноника: n=1 опускается (стандарт dice notation: «if n=1, then the notation
  // is usually simplified to ds», Wikipedia Dice notation).
  // Поэтому `1d4` → `d4`, а строка из задачи `2d6-1d4+3` → `2d6-d4+3`
  // (в исходной таблице expected `2d6-1d4+3` — опечатка, противоречит `d20` → `d20`).
  const cases: Array<[string, string]> = [
    ['d20', 'd20'],
    ['4d6-L', '4d6dl1'],
    ['4d6-H', '4d6dh1'],
    ['2d20kh1+5', '2d20kh1+5'],
    ['8d6', '8d6'],
    ['d100', 'd100'],
    ['2d6-1d4+3', '2d6-d4+3'],
    ['2d6-d4+3', '2d6-d4+3'],
    ['2D20 KH1 + 5', '2d20kh1+5'],
    ['10d10kl2-4', '10d10kl2-4'],
  ]

  for (const [input, expected] of cases) {
    it(`${input} → ${expected}`, () => {
      expect(normalize(parseNotation(input))).toBe(expected)
    })
  }

  it('d20: count по умолчанию 1', () => {
    const expr = parseNotation('d20')
    expect(expr.terms).toHaveLength(1)
    const term = expr.terms[0].term
    expect(term.kind).toBe('dice')
    if (term.kind === 'dice') {
      expect(term.count).toBe(1)
      expect(term.sides).toBe(20)
      expect(term.op).toBeNull()
    }
  })

  it('4d6-L — сахар над dl1', () => {
    const expr = parseNotation('4d6-L')
    const term = expr.terms[0].term
    expect(term.kind).toBe('dice')
    if (term.kind === 'dice') {
      expect(term.count).toBe(4)
      expect(term.sides).toBe(6)
      expect(term.op).toBe('dl')
      expect(term.opN).toBe(1)
    }
  })

  it('4d6-H — сахар над dh1', () => {
    const expr = parseNotation('4d6-H')
    const term = expr.terms[0].term
    if (term.kind === 'dice') {
      expect(term.op).toBe('dh')
      expect(term.opN).toBe(1)
    }
  })

  it('регистр и пробелы: 4D6-L = 4d6-l', () => {
    expect(normalize(parseNotation('4D6-L'))).toBe(normalize(parseNotation('4d6-l')))
  })

  it('2d20 kh1 + 5 с пробелами везде', () => {
    expect(normalize(parseNotation('2d20 kh1 + 5'))).toBe('2d20kh1+5')
  })

  it('границы: 1/100 и ±999', () => {
    expect(normalize(parseNotation('1d6'))).toBe('d6')
    expect(normalize(parseNotation('1d20'))).toBe('d20')
    expect(normalize(parseNotation('1d4'))).toBe('d4')
    expect(normalize(parseNotation('100d6'))).toBe('100d6')
    expect(normalize(parseNotation('100d100'))).toBe('100d100')
    expect(normalize(parseNotation('d20+999'))).toBe('d20+999')
    expect(normalize(parseNotation('d20-999'))).toBe('d20-999')
    expect(normalize(parseNotation('-999'))).toBe('-999')
    expect(normalize(parseNotation('+5'))).toBe('5')
    expect(normalize(parseNotation('-d20'))).toBe('-d20')
    expect(normalize(parseNotation('2d6kh1'))).toBe('2d6kh1')
    expect(normalize(parseNotation('100d6kh99'))).toBe('100d6kh99')
  })
})

describe('dice-notation: невалидное → NotationError', () => {
  const cases: Array<[string, string]> = [
    ['', 'пусто'],
    ['d', 'нет граней'],
    ['0d6', 'count < 1'],
    ['101d6', 'count > 100'],
    ['d7', 'нет таких граней'],
    ['2d6kh2', 'N == count'],
    ['2d6kh3', 'N > count'],
    ['4d6-', 'висячий оператор'],
    ['+', 'нет термов'],
    ['2dd6', 'мусор после d'],
    ['kh1', 'суффикс без костей'],
  ]

  for (const [input] of cases) {
    it(`'${input}' бросает NotationError`, () => {
      expect(() => parseNotation(input)).toThrowError(NotationError)
    })
  }

  it('ошибка несёт pos и expected', () => {
    try {
      parseNotation('d7')
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(NotationError)
      const err = e as NotationError
      expect(typeof err.pos).toBe('number')
      expect(typeof err.expected).toBe('string')
      expect(err.expected.length).toBeGreaterThan(0)
    }
  })

  it('границы за пределами: 1000, 0d6, 101d6', () => {
    expect(() => parseNotation('1000')).toThrowError(NotationError)
    expect(() => parseNotation('d20+1000')).toThrowError(NotationError)
    expect(() => parseNotation('d20-1000')).toThrowError(NotationError)
    expect(() => parseNotation('0d6')).toThrowError(NotationError)
    expect(() => parseNotation('101d6')).toThrowError(NotationError)
    expect(() => parseNotation('1d6dl1')).toThrowError(NotationError)
    expect(() => parseNotation('2d6kh9')).toThrowError(NotationError)
  })
})

describe('dice-notation: идемпотентность normalize', () => {
  const samples = ['d20', '4d6-L', '2d20kh1+5', '2d6-1d4+3', '10d10kl2-4', '2D20 KH1 + 5', 'd100']

  for (const sample of samples) {
    it(`'${sample}' стабилен`, () => {
      const once = normalize(parseNotation(sample))
      const twice = normalize(parseNotation(once))
      expect(twice).toBe(once)
    })
  }
})
