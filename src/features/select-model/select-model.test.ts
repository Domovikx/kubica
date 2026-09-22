import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SELECTED, MODELS } from '@/entities/model/models'
import {
  clearSelection,
  isSelected,
  selectAllModels,
  subscribeSelection,
  toggleModel,
} from './select-model'

describe('select-model store', () => {
  it('стартует с DEFAULT_SELECTED', () => {
    for (const id of DEFAULT_SELECTED) expect(isSelected(id)).toBe(true)
  })

  it('toggleModel включает и выключает', () => {
    toggleModel('d20', false)
    expect(isSelected('d20')).toBe(false)
    toggleModel('d20', true)
    expect(isSelected('d20')).toBe(true)
  })

  it('selectAllModels / clearSelection покрывают весь реестр', () => {
    selectAllModels()
    for (const m of MODELS) expect(isSelected(m.id)).toBe(true)
    clearSelection()
    for (const m of MODELS) expect(isSelected(m.id)).toBe(false)
    // Возвращаем дефолт, чтобы не влиять на другие тесты
    for (const id of DEFAULT_SELECTED) toggleModel(id, true)
  })

  it('подписчики получают снапшот и отписываются', () => {
    const seen: string[][] = []
    const off = subscribeSelection((sel) => seen.push([...sel]))
    toggleModel('d12', true)
    toggleModel('d12', false)
    off()
    toggleModel('d12', true)
    expect(seen).toHaveLength(2)
    expect(seen[0]).toContain('d12')
    expect(seen[1]).not.toContain('d12')
    toggleModel('d12', false)
  })

  it('snapshot изолирован от внутренних мутаций', () => {
    const listener = vi.fn()
    const off = subscribeSelection(listener)
    toggleModel('d8', true)
    const snapshot: Set<string> = listener.mock.calls[0][0] as Set<string>
    snapshot.add('хак')
    expect(isSelected('хак')).toBe(false)
    off()
    toggleModel('d8', false)
  })
})

describe('models registry', () => {
  it('id уникальны', () => {
    const ids = MODELS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('у каждой модели есть url и подпись', () => {
    for (const m of MODELS) {
      expect(m.url.length).toBeGreaterThan(0)
      expect(m.label.length).toBeGreaterThan(0)
    }
  })

  it('DEFAULT_SELECTED ссылается на существующие id', () => {
    const ids = new Set(MODELS.map((m) => m.id))
    for (const id of DEFAULT_SELECTED) expect(ids.has(id)).toBe(true)
  })
})
