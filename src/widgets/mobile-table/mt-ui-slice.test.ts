import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/app/store'
import { mtUiActions } from './mt-ui-slice'

const store = () => createAppStore(null)

describe('mt-ui-slice: оверлеи и транзиент виджета', () => {
  it('оверлеи: открытие/закрытие, открыт ровно один, closeOverlays гасит все', () => {
    const s = store()
    s.dispatch(mtUiActions.openOverlay('sheet'))
    expect(s.getState().mtUi.sheetOpen).toBe(true)
    s.dispatch(mtUiActions.openOverlay('drawer'))
    expect(s.getState().mtUi.drawerOpen).toBe(true)
    expect(s.getState().mtUi.sheetOpen).toBe(false)
    s.dispatch(mtUiActions.openOverlay('music'))
    expect(s.getState().mtUi.musicCardOpen).toBe(true)
    expect(s.getState().mtUi.drawerOpen).toBe(false)
    s.dispatch(mtUiActions.closeOverlays())
    const st = s.getState().mtUi
    expect(st.sheetOpen).toBe(false)
    expect(st.drawerOpen).toBe(false)
    expect(st.musicCardOpen).toBe(false)
  })

  it('dirty-флаги морфа: по панелям, сбрасываются closeOverlays', () => {
    const s = store()
    s.dispatch(mtUiActions.setDirty({ kind: 'sheet', dirty: true }))
    s.dispatch(mtUiActions.setDirty({ kind: 'music', dirty: true }))
    expect(s.getState().mtUi.dirtySheet).toBe(true)
    expect(s.getState().mtUi.dirtyMusic).toBe(true)
    expect(s.getState().mtUi.dirtyDrawer).toBe(false)
    s.dispatch(mtUiActions.closeOverlays())
    expect(s.getState().mtUi.dirtySheet).toBe(false)
    expect(s.getState().mtUi.dirtyMusic).toBe(false)
  })

  it('фаза броска: rolling/windActive/lastResult', () => {
    const s = store()
    s.dispatch(mtUiActions.setRolling(true))
    s.dispatch(mtUiActions.setWindActive(true))
    s.dispatch(mtUiActions.setLastResult({ label: '2d6', total: 12, parts: [] }))
    expect(s.getState().mtUi.rolling).toBe(true)
    expect(s.getState().mtUi.windActive).toBe(true)
    expect(s.getState().mtUi.lastResult?.total).toBe(12)
    s.dispatch(mtUiActions.setLastResult(null))
    expect(s.getState().mtUi.lastResult).toBeNull()
  })

  it('activeSet и двухтап «Очистить»', () => {
    const s = store()
    s.dispatch(mtUiActions.setActiveSet('set-1'))
    s.dispatch(mtUiActions.setClearArmed(true))
    expect(s.getState().mtUi.activeSet).toBe('set-1')
    expect(s.getState().mtUi.clearArmed).toBe(true)
    s.dispatch(mtUiActions.setActiveSet(null))
    s.dispatch(mtUiActions.setClearArmed(false))
    expect(s.getState().mtUi.activeSet).toBeNull()
    expect(s.getState().mtUi.clearArmed).toBe(false)
  })

  it('загрузка GLB: прогресс и ошибка', () => {
    const s = store()
    s.dispatch(mtUiActions.setLoadProgress({ loaded: 3, instances: 5 }))
    s.dispatch(mtUiActions.setLoadError('d20.glb'))
    expect(s.getState().mtUi.loaded).toBe(3)
    expect(s.getState().mtUi.instances).toBe(5)
    expect(s.getState().mtUi.loadError).toBe('d20.glb')
  })
})
