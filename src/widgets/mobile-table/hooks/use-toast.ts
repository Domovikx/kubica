import { useCallback, useEffect, useRef, useState } from 'react'

export const useToast = (): {
  toast: string | null
  showToast: (msg: string) => void
  cancelToast: () => void
} => {
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef(0)

  const cancelToast = useCallback(() => {
    window.clearTimeout(timer.current)
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setToast(null)
    }, 2200)
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return { toast, showToast, cancelToast }
}
