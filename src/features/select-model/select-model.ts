import { DEFAULT_SELECTED, MODELS } from '@/entities/model/models'

export type Selection = ReadonlySet<string>
export type SelectionListener = (selected: Selection) => void

let selected = new Set<string>(DEFAULT_SELECTED)
const listeners = new Set<SelectionListener>()

const emit = () => {
  const snapshot = new Set(selected)
  for (const listener of listeners) listener(snapshot)
}

export const subscribeSelection = (listener: SelectionListener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const isSelected = (id: string): boolean => selected.has(id)

export const toggleModel = (id: string, on: boolean): void => {
  if (on) selected.add(id)
  else selected.delete(id)
  emit()
}

export const selectAllModels = (): void => {
  selected = new Set(MODELS.map((m) => m.id))
  emit()
}

export const clearSelection = (): void => {
  selected = new Set()
  emit()
}
