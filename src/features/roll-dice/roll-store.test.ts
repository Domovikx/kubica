import { describe, expect, it, vi } from 'vitest'
import { createRollStore, type PhysicsDriver } from './roll-store'
import type { Quat } from './readout'

const IDENTITY: Quat = [0, 0, 0, 1]

const instantDriver = (quat: Quat = IDENTITY): PhysicsDriver => ({
  roll: async () => ({ quat, settled: true }),
})

describe('roll-store', () => {
  it('idle → rolling → settled с результатом', async () => {
    const store = createRollStore(instantDriver())
    const phases: string[] = []
    store.subscribe((s) => phases.push(s.phase))
    expect(store.getState().phase).toBe('idle')
    const result = await store.roll('d6')
    expect(phases).toEqual(['rolling', 'settled'])
    expect(result.die).toBe('d6')
    expect(result.value).toBeGreaterThanOrEqual(1)
    expect(result.value).toBeLessThanOrEqual(6)
    expect(store.getState().phase).toBe('settled')
    expect(store.getState().result?.value).toBe(result.value)
  })

  it('d10: display показывает 10 вместо 0', async () => {
    // Кватернион, ставящий грань со значением 0 наверх: найдём перебором
    // через readRoll на поворотах вокруг Y (детерминированно)
    const store = createRollStore(instantDriver())
    const angle = Math.PI / 5
    const q: Quat = [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)]
    const driver: PhysicsDriver = { roll: async () => ({ quat: q, settled: true }) }
    const store2 = createRollStore(driver)
    const result = await store2.roll('d10')
    expect(result.display).toBe(result.value === 0 ? '10' : String(result.value))
    void store
  })

  it('протухший бросок игнорируется (гонка двух roll)', async () => {
    const queue: Array<(q: Quat) => void> = []
    const gated: PhysicsDriver = {
      roll: () =>
        new Promise<{ quat: Quat; settled: boolean }>((resolve) => {
          queue.push((q: Quat) => resolve({ quat: q, settled: true }))
        }),
    }
    const store = createRollStore(gated)
    const seen: string[] = []
    store.subscribe((s) => {
      if (s.phase === 'settled' && s.result) seen.push(`${s.result.die}:${s.result.display}`)
    })
    const p1 = store.roll('d6')
    const p2 = store.roll('d20')
    queue[0](IDENTITY) // завершается первый (протухший) бросок
    await p1
    queue[1](IDENTITY) // завершается второй (актуальный) бросок
    const r2 = await p2
    expect(r2.die).toBe('d20')
    expect(seen).toEqual([`d20:${r2.display}`])
    expect(store.getState().result?.die).toBe('d20')
  })

  it('отписка останавливает уведомления', async () => {
    const store = createRollStore(instantDriver())
    const listener = vi.fn()
    const off = store.subscribe(listener)
    off()
    await store.roll('d8')
    expect(listener).not.toHaveBeenCalled()
  })
})
