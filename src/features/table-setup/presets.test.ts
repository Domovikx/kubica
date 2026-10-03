import { describe, expect, it } from 'vitest'
import {
  BUILT_IN_PRESETS,
  deleteCustomPreset,
  formulaToCounts,
  hideBuiltIn,
  loadCustomPresets,
  loadHiddenBuiltIns,
  saveCustomPreset,
  uniquePresetName,
} from './presets'
import { emptyCounts, totalCount } from './table-setup'

const memStorage = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v)
    },
    removeItem: (k: string) => {
      data.delete(k)
    },
  }
}

describe('table presets', () => {
  it('встроенные влезают в капы', () => {
    for (const p of BUILT_IN_PRESETS) {
      expect(totalCount(p.counts)).toBeLessThanOrEqual(10)
    }
  })

  it('формула → счётчики (d100 = пара d10)', () => {
    expect(formulaToCounts('8d6')).toMatchObject({ d6: 8 })
    expect(formulaToCounts('d20+d6')).toMatchObject({ d20: 1, d6: 1 })
    expect(formulaToCounts('2d20kh1')).toMatchObject({ d20: 2 })
    expect(formulaToCounts('d100')).toMatchObject({ d10: 2 })
    expect(formulaToCounts('???')).toBeNull()
    expect(formulaToCounts('+5')).toBeNull()
  })

  it('свои наборы: save/load/delete', () => {
    const s = memStorage()
    expect(loadCustomPresets(s)).toEqual([])
    saveCustomPreset('Моя пачка', { ...emptyCounts(), d6: 3 }, s)
    expect(loadCustomPresets(s).map((p) => p.name)).toEqual(['Моя пачка'])
    saveCustomPreset('Вторая', { ...emptyCounts(), d20: 1 }, s)
    expect(loadCustomPresets(s).length).toBe(2)
    deleteCustomPreset('Моя пачка', s)
    expect(loadCustomPresets(s).map((p) => p.name)).toEqual(['Вторая'])
  })

  it('скрытые встроенные: hide/load, без дублей', () => {
    const s = memStorage()
    expect(loadHiddenBuiltIns(s)).toEqual([])
    hideBuiltIn('d100', s)
    hideBuiltIn('d100', s)
    hideBuiltIn('Атака d20 d6', s)
    expect(loadHiddenBuiltIns(s)).toEqual(['d100', 'Атака d20 d6'])
  })

  it('uniquePresetName: первое свободное «Сет N»', () => {
    expect(uniquePresetName([])).toBe('Сет 1')
    expect(uniquePresetName([{ name: 'Сет 1' }])).toBe('Сет 2')
    expect(uniquePresetName([{ name: 'Сет 1' }, { name: 'Сет 3' }])).toBe('Сет 2')
  })
})
