import { describe, expect, it } from 'vitest'
import { emptyCounts, expandInstances } from './table-setup'

describe('table-setup: чистые функции', () => {
  it('expandInstances: стабильные ключи, порядок DIE_IDS', () => {
    const counts = { ...emptyCounts(), d6: 2, d4: 1 }
    expect(expandInstances(counts)).toEqual([
      { die: 'd4', key: 'd4#0' },
      { die: 'd6', key: 'd6#0' },
      { die: 'd6', key: 'd6#1' },
    ])
  })
})
