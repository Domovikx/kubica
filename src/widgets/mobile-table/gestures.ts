// Жест на поле: удержание ≥3 с на кости — зарядка; движение при зажатой
// кнопке зарядку НЕ прерывает (кувырок идёт, кость ещё крутится трекболом
// под курсором). Отпускание: ≥3 с — бросок (заряд + флик); раньше — добор
// до 3 с (мёртвых тапов нет), но если курсор сдвинулся >8 px — это осмотр:
// зарядка гаснет (эта кость остаётся в крутке, остальные — в базу), броска
// нет. Драг по фону — ничего (камера статична). Сила — заряд + флик + меню.
// Защита от случайного переброса — сама зарядка: 3 с удержания — не «щелчок».
// Состояние зарядки (windActive) — в замыкании mount (читает панель), тут —
// висящий доброс тапа (pendingFire) и вся логика отпускания.
import { buzz as vibrate, startRattle, stopRattle } from '@/shared/dice/sound'
import type { Table } from '@/shared/three/table'
import { throwPowerBoost } from '@/features/roll-dice/power'

/** Минимум удержания до броска и время полного заряда (3 с → 5 с). */
const MIN_HOLD_MS = 3000
const CHARGE_FULL_MS = 5000

export interface Gestures {
  /** Отменить висящий доброс короткого тапа (dispose). */
  cancelPending: () => void
}

export const createGestures = (deps: {
  canvas: HTMLCanvasElement
  section: HTMLElement
  table: Table
  isRolling: () => boolean
  isDisposed: () => boolean
  /** Зарядка (windActive) живёт в mount — тут только чтение/запись. */
  wind: { isCharging: () => boolean; setCharging: (on: boolean) => void }
  throwAll: (powerBoost?: number, flick?: { x: number; z: number }) => void
  refresh: () => void
}): Gestures => {
  const { canvas, section, table, wind } = deps
  let pendingFire: number | null = null
  const cancelPending = (): void => {
    if (pendingFire !== null) {
      window.clearTimeout(pendingFire)
      pendingFire = null
    }
  }

  /**
   * Снять зарядку: restore=true — позы всех костей в базу (отмена);
   * 'spin' — в базу, но крутка кости keepId остаётся (осмотр при
   * отпускании <3 с сдвинувшимся курсором). Без броска — плавный
   * winddown ~0.4 с (фидбек «резкая остановка раскрутки»).
   */
  const endWind = (restore: boolean | 'spin', keepId?: string): void => {
    wind.setCharging(false)
    table.windup({ on: false, restore, keepId })
    stopRattle()
    deps.refresh()
  }
  /**
   * Релиз зарядки: сила = меню + удержание (3 с → 0, 5 с → +0.5) + флик
   * пальцем (+0.4); кувырок не откатываем — он продолжается в подхвате,
   * уходя в реальное ω тела (оси/скорость броска).
   */
  const fireThrow = (heldMs: number, vxPx: number, vyPx: number): void => {
    wind.setCharging(false)
    if (deps.isRolling() || deps.isDisposed()) {
      // Пока добирали 3 с — стол ушёл в другой бросок: зарядку гасим молча.
      table.windup({ on: false })
      stopRattle()
      return
    }
    const charge = Math.max(0, Math.min(1, (heldMs - MIN_HOLD_MS) / (CHARGE_FULL_MS - MIN_HOLD_MS)))
    const flick01 = Math.min(1, Math.hypot(vxPx, vyPx) / 1.5)
    const boost = Math.min(1.6, throwPowerBoost() + 0.5 * charge + 0.4 * flick01)
    table.windup({ on: false, restore: false })
    deps.throwAll(boost, table.flickVec(vxPx, vyPx))
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || deps.isRolling()) return
    const x = e.clientX
    const y = e.clientY
    const t = performance.now()
    const dieId = table.pickDieId(x, y)
    if (!dieId) return
    // Захват указателя: отпускание за краем канвы/над шапкой не теряется.
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      /* указатель уже свободен */
    }
    // Новое нажатие перекрывает висящий доброс от короткого тапа.
    cancelPending()
    if (!wind.isCharging()) {
      wind.setCharging(true)
      section.dataset.phase = 'charging'
      table.windup({ on: true })
      startRattle()
      vibrate(10)
    }
    let lastX = x
    let lastY = y
    let moved = false
    // Последний сэмпл движения — скорость флика в момент релиза (px/мс).
    let sample = { t, x, y }
    const onMove = (mv: PointerEvent) => {
      if (!mv.isPrimary) return
      const dx = mv.clientX - lastX
      const dy = mv.clientY - lastY
      lastX = mv.clientX
      lastY = mv.clientY
      const now = performance.now()
      if (now - sample.t >= 16) sample = { t: now, x: mv.clientX, y: mv.clientY }
      if (!moved && Math.hypot(mv.clientX - x, mv.clientY - y) > 8) moved = true
      if (moved) table.spinDie(dieId, dx, dy)
    }
    const cleanup = () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onCancel)
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    }
    const onUp = (up: PointerEvent) => {
      cleanup()
      if (!up.isPrimary) return
      const held = performance.now() - t
      const dt = Math.max(1, performance.now() - sample.t)
      const vx = (up.clientX - sample.x) / dt
      const vy = (up.clientY - sample.y) / dt
      if (held >= MIN_HOLD_MS) {
        // Зарядка пережила движение — время решает: ≥3 с бросаем.
        fireThrow(held, vx, vy)
      } else if (moved) {
        // Осмотр: крутка этой кости остаётся, остальные — в базу.
        endWind('spin', dieId)
      } else {
        // Добор зарядки до 3 с: тап не «мёртвый», просто бросает на отметке.
        pendingFire = window.setTimeout(() => {
          pendingFire = null
          fireThrow(MIN_HOLD_MS, vx, vy)
        }, MIN_HOLD_MS - held)
      }
    }
    const onCancel = () => {
      cleanup()
      cancelPending()
      endWind(true)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onCancel)
  })

  return { cancelPending }
}
