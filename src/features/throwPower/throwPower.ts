// Сила броска стола: три режима в меню-бургере. Режим — база, сверху
// складываются заряд удержания (≥3 с, см. mobile-table.fireThrow) и флик
// релиза: cap 1.6. boost по тем же формулам, что старая зарядка charge∈[0..1]:
// множитель силы = 1 + boost×0.6 → 1.0× / 1.3× / 1.6×.

export type ThrowPowerMode = 'normal' | 'strong' | 'mighty'

const POWER_KEY = 'dice-power'

export const THROW_POWERS: ReadonlyArray<{
  mode: ThrowPowerMode
  name: string
  boost: number
}> = [
  { mode: 'normal', name: 'Обычный 1.0×', boost: 0 },
  { mode: 'strong', name: 'Сильный 1.3×', boost: 0.5 },
  { mode: 'mighty', name: 'Мощный 1.6×', boost: 1 },
]

const isMode = (v: string | null): v is ThrowPowerMode =>
  v === 'normal' || v === 'strong' || v === 'mighty'

/** Выбранный режим (битое/пустое значение — «Обычный»). */
export const throwPower = (): ThrowPowerMode => {
  try {
    const v = localStorage.getItem(POWER_KEY)
    return isMode(v) ? v : 'normal'
  } catch {
    return 'normal'
  }
}

export const setThrowPower = (mode: ThrowPowerMode): void => {
  try {
    localStorage.setItem(POWER_KEY, mode)
  } catch {
    // ignore
  }
}

/** Boost для throwAll(powerBoost): 0 / 0.5 / 1. */
export const throwPowerBoost = (mode: ThrowPowerMode = throwPower()): number =>
  THROW_POWERS.find((p) => p.mode === mode)?.boost ?? 0
