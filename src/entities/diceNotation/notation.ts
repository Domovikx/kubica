// Парсер дайс-нотации → типизированный AST + normalize.
// Грамматика (см. tasks/mvp-2/2.1-notation-parser.md):
//   expr  := term (('+' | '-') term)*
//   term  := dice | number
//   dice  := [count] 'd' sides [suffix]
//   count := 1..100 (пусто = 1)
//   sides := 4 | 6 | 8 | 10 | 12 | 20 | 100
//   suffix:= ('kh' | 'kl' | 'dh' | 'dl') n | '-L' | '-H'
//   number:= целое [-999..999]
// Пробелы игнорируются везде, регистр — insensitive.

export type DiceSides = 4 | 6 | 8 | 10 | 12 | 20 | 100
export type KeepOp = 'kh' | 'kl' | 'dh' | 'dl'

export interface DiceTerm {
  kind: 'dice'
  count: number
  sides: DiceSides
  op: KeepOp | null
  opN: number
}

export interface ConstTerm {
  kind: 'const'
  value: number
}

export interface SignedTerm {
  sign: 1 | -1
  term: DiceTerm | ConstTerm
}

export interface RollExpr {
  terms: SignedTerm[]
}

export class NotationError extends Error {
  pos: number
  expected: string
  constructor(pos: number, expected: string) {
    super(`Notation error at pos ${pos}: expected ${expected}`)
    this.name = 'NotationError'
    this.pos = pos
    this.expected = expected
  }
}

const ALLOWED_SIDES: readonly number[] = [4, 6, 8, 10, 12, 20, 100]
const MAX_COUNT = 100
const MAX_CONST = 999

const isDigit = (ch: string): boolean => ch >= '0' && ch <= '9'
const isSpace = (ch: string): boolean =>
  ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v'

const isSides = (n: number): n is DiceSides => (ALLOWED_SIDES as readonly number[]).includes(n)

/**
 * Разобрать строку нотации в AST.
 * Бросает NotationError с pos (индекс в исходной строке) и expected.
 */
export function parseNotation(input: string): RollExpr {
  const s = input
  let i = 0

  const skipSpaces = (): void => {
    while (i < s.length && isSpace(s[i])) i++
  }

  const fail = (expected: string, at?: number): never => {
    throw new NotationError(at ?? i, expected)
  }

  const parseDice = (count: number, countPos: number): DiceTerm => {
    if (count < 1 || count > MAX_COUNT) {
      fail(`count 1..${MAX_COUNT}`, countPos)
    }
    // Ожидаем 'd' / 'D' (пробелы между count и 'd' уже допустимы: пропускаем их здесь).
    skipSpaces()
    if (i >= s.length || (s[i] !== 'd' && s[i] !== 'D')) {
      fail(`'d'`, i)
    }
    i++
    skipSpaces()
    const sidesPos = i
    if (i >= s.length || !isDigit(s[i])) {
      fail(`sides (${ALLOWED_SIDES.join(', ')})`, i)
    }
    let j = i
    while (j < s.length && isDigit(s[j])) j++
    const sidesNum = Number.parseInt(s.slice(i, j), 10)
    if (!isSides(sidesNum)) {
      throw new NotationError(sidesPos, `sides (${ALLOWED_SIDES.join(', ')})`)
    }
    const sides: DiceSides = sidesNum
    i = j

    // Суффикс (пробелы перед ним игнорируются).
    skipSpaces()
    let op: KeepOp | null = null
    let opN = 0
    if (i + 1 < s.length || (i + 1 === s.length && i < s.length)) {
      const two = s.slice(i, i + 2).toLowerCase()
      if (two === 'kh' || two === 'kl' || two === 'dh' || two === 'dl') {
        op = two as KeepOp
        i += 2
        skipSpaces()
        if (i >= s.length || !isDigit(s[i])) {
          fail(`number after '${two}'`, i)
        }
        const nPos = i
        let k = i
        while (k < s.length && isDigit(s[k])) k++
        const n = Number.parseInt(s.slice(i, k), 10)
        i = k
        if (!(n > 0 && n < count)) {
          fail(`N in 1..${count - 1} after '${two}'`, nPos)
        }
        opN = n
      } else if (s[i] === '-') {
        // Сахар '-L' / '-H' (между '-' и буквой пробелы тоже игнорируются).
        let k = i + 1
        while (k < s.length && isSpace(s[k])) k++
        if (k < s.length && (s[k] === 'L' || s[k] === 'l' || s[k] === 'H' || s[k] === 'h')) {
          const isL = s[k] === 'L' || s[k] === 'l'
          op = isL ? 'dl' : 'dh'
          opN = 1
          if (!(1 < count)) {
            fail(`N in 1..${count - 1} after '${op}'`, i)
          }
          i = k + 1
        }
      }
    }
    return { kind: 'dice', count, sides, op, opN }
  }

  const parseUnsignedTerm = (): DiceTerm | ConstTerm => {
    skipSpaces()
    if (i >= s.length) fail('dice or number')
    const termPos = i
    const ch0 = s[i]
    if (ch0 === 'd' || ch0 === 'D') {
      return parseDice(1, termPos)
    }
    if (isDigit(ch0)) {
      let j = i
      while (j < s.length && isDigit(s[j])) j++
      const numStr = s.slice(i, j)
      // Заглядываем через пробелы: дальше 'd' — значит кости со счётчиком.
      let k = j
      while (k < s.length && isSpace(s[k])) k++
      if (k < s.length && (s[k] === 'd' || s[k] === 'D')) {
        const count = Number.parseInt(numStr, 10)
        i = j
        return parseDice(count, termPos)
      }
      i = j
      const value = Number.parseInt(numStr, 10)
      if (value > MAX_CONST) {
        fail(`number -${MAX_CONST}..${MAX_CONST}`, termPos)
      }
      return { kind: 'const', value }
    }
    throw new NotationError(termPos, 'dice or number')
  }

  skipSpaces()
  if (i >= s.length) {
    fail(`expression (e.g. 'd20', '2d6+3')`, i)
  }

  // Унарный знак первого терма разрешён.
  let sign: 1 | -1 = 1
  if (s[i] === '+' || s[i] === '-') {
    sign = s[i] === '-' ? -1 : 1
    i++
    skipSpaces()
    if (i >= s.length) fail('dice or number', i)
  }

  const terms: SignedTerm[] = []
  terms.push({ sign, term: parseUnsignedTerm() })

  for (;;) {
    skipSpaces()
    if (i >= s.length) break
    const ch = s[i]
    if (ch !== '+' && ch !== '-') {
      fail(`'+', '-' or end`, i)
    }
    const opSign: 1 | -1 = ch === '-' ? -1 : 1
    i++
    skipSpaces()
    if (i >= s.length) {
      fail('dice or number', i)
    }
    if (s[i] === '+' || s[i] === '-') {
      fail('dice or number', i)
    }
    const term = parseUnsignedTerm()
    terms.push({ sign: opSign, term })
  }

  return { terms }
}

/** Каноническая строка: '2d20kh1+5'. Сахар -L/-H всегда как dl1/dh1, count 1 опускается. */
export function normalize(expr: RollExpr): string {
  return expr.terms
    .map((st, idx) => {
      const prefix = idx === 0 ? (st.sign === -1 ? '-' : '') : st.sign === -1 ? '-' : '+'
      if (st.term.kind === 'const') {
        return `${prefix}${st.term.value}`
      }
      const countPart = st.term.count === 1 ? '' : String(st.term.count)
      const opPart = st.term.op === null ? '' : `${st.term.op}${st.term.opN}`
      return `${prefix}${countPart}d${st.term.sides}${opPart}`
    })
    .join('')
}
