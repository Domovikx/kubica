import { describe, expect, it } from 'vitest'
import { quatForValueUp } from '@/features/roll-dice/face-orient'
import { faceValue } from '@/entities/dice-geometry/geometry'
describe('exp', () => {
  it('prints expected initialQuat d20', () => {
    const vd: [number, number, number] = [0, 0.47, 0.88]
    const l = Math.hypot(vd[0], vd[1], vd[2])
    const q = quatForValueUp('d20', faceValue('d20', 0), [vd[0] / l, vd[1] / l, vd[2] / l])
    console.log('EXPECTED', JSON.stringify(q.map((n) => +n.toFixed(4))))
    expect(true).toBe(true)
  })
})
