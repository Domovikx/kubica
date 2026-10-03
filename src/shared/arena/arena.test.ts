import { describe, expect, it } from 'vitest'
import { GLASS_HALF_X, GLASS_HALF_Z, glassHalves } from './arena'

describe('glassHalves: стол растёт с пачкой', () => {
  it('1–2 кости — дефолтные экстенты', () => {
    expect(glassHalves(0, 0)).toEqual({ hx: 24, hz: 16 })
    expect(glassHalves(11, 0).hx).toBeLessThanOrEqual(GLASS_HALF_X + 1)
    expect(glassHalves(11, 0).hz).toBeLessThanOrEqual(GLASS_HALF_Z)
  })

  it('монотонно и с запасом под слоты', () => {
    const small = glassHalves(11, 9)
    const big = glassHalves(22, 9)
    expect(big.hx).toBeGreaterThan(small.hx)
    expect(big.hx).toBeGreaterThanOrEqual(22 + 20)
    expect(big.hz).toBeGreaterThanOrEqual(9 + 16)
  })
})
