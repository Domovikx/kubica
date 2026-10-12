// Тумблеры persist+стор «звука и вибрации» (write-through: движок пишет
// localStorage, слайс зеркалит в Redux). Владелец-хук вместо копий в Head
// и DrawerSoundSection (волна 2 ревью).
import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { hapticsEnabled, isMuted, setHaptics, setMuted } from '@/shared'
import { soundActions } from './soundSlice'

export const useMuteToggle = (): (() => void) => {
  const dispatch = useDispatch()
  return useCallback(() => {
    const next = !isMuted()
    setMuted(next)
    dispatch(soundActions.setMuted(next))
  }, [dispatch])
}

export const useHapticsToggle = (): (() => void) => {
  const dispatch = useDispatch()
  return useCallback(() => {
    const next = !hapticsEnabled()
    setHaptics(next)
    dispatch(soundActions.setHaptics(next))
  }, [dispatch])
}
