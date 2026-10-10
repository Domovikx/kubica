// Водяной знак: гигантское «Kubica» под канвой. Fit (угол/размер под экран)
// — use-watermark-fit (rAF + fonts.ready + resize).
import { useRef } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useWatermarkFit } from '../hooks/use-watermark-fit'

const styles = stylex.create({
  root: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(240,242,245,0.045)',
    WebkitTextStroke: '1px rgba(240,242,245,0.035)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    pointerEvents: 'none',
  },
  text: {
    display: 'inline-block',
    whiteSpace: 'nowrap',
    fontSize: 'min(24vw,150px)',
    fontWeight: 800,
    letterSpacing: '0.04em',
    transformOrigin: 'center',
    willChange: 'transform',
  },
})

export const Watermark = (): React.JSX.Element => {
  const elRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  useWatermarkFit(elRef, textRef)

  const sxRoot = stylex.props(styles.root)
  const sxText = stylex.props(styles.text)

  return (
    <div
      ref={elRef}
      {...sxRoot}
      className={`mtableWatermark ${sxRoot.className ?? ''}`}
      data-testid="mtable-watermark"
      aria-hidden="true"
    >
      <span ref={textRef} {...sxText} className={`mtableWatermarkText ${sxText.className ?? ''}`}>
        Kubica
      </span>
    </div>
  )
}
