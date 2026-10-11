// Живой регион итога (только SR): текст пишет движок императивно через ref
// (finishPack/catch) — React-детей нет, конфликта с рендером нет.
import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  root: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  },
})

export interface LiveProps {
  liveRef: React.RefObject<HTMLDivElement | null>
}

export const Live = ({ liveRef }: LiveProps): React.JSX.Element => {
  const sx = stylex.props(styles.root)
  return (
    <div
      ref={liveRef}
      {...sx}
      className={`mtableLive ${sx.className ?? ''}`}
      data-testid="mtable-live"
      role="status"
    />
  )
}
