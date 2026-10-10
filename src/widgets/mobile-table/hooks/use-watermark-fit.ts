import { useLayoutEffect } from 'react'

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export const useWatermarkFit = (
  elRef: React.RefObject<HTMLElement | null>,
  textRef: React.RefObject<HTMLElement | null>,
): void => {
  useLayoutEffect(() => {
    const fit = (): void => {
      const el = elRef.current
      const text = textRef.current
      if (!el || !text) return
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return
      const aspect = r.width / Math.max(r.height, 1)
      const angle =
        aspect >= 1
          ? 45 * clamp01((1.5 - aspect) / 0.5)
          : 45 + 45 * clamp01((1 - aspect) / (1 - 2 / 3))
      const rad = (angle * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const pad = Math.min(48, Math.max(16, Math.round(Math.min(r.width, r.height) * 0.06)))
      const availW = r.width - 2 * pad
      const availH = r.height - 2 * pad
      text.style.transform = 'none'
      text.style.fontSize = '100px'
      const box = text.getBoundingClientRect()
      const w100 = box.width
      const h100 = box.height
      if (w100 < 1) return
      const ratio = h100 / w100
      const fs = (Math.min(availW / (cos + ratio * sin), availH / (sin + ratio * cos)) / w100) * 100
      text.style.fontSize = `${Math.floor(fs * 10) / 10}px`
      text.style.transform = angle > 0.05 ? `rotate(${angle}deg)` : 'none'
    }
    const raf = requestAnimationFrame(fit)
    document.fonts?.ready.then(fit).catch(() => {})
    window.addEventListener('resize', fit)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', fit)
    }
  }, [elRef, textRef])
}
