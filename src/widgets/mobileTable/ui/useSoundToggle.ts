// Тумблеры persist+стор «звука и вибрации» (write-through: движок пишет
// localStorage, слайс зеркалит в Redux). Владелец-хук вместо копий в Head
// и DrawerSoundSection (волна 2 ревью).
import { useCallback } from 'react'
import { useAppDispatch } from '@/app/hooks'
import { hapticsEnabled, isMuted, setHaptics, setMuted } from '@/shared/dice/sound'
import { soundActions } from '@/features/sound/model/soundSlice'

export const useMuteToggle = (): (() => void) => {
  const dispatch = useAppDispatch()
  return useCallback(() => {
    const next = !isMuted()
    setMuted(next)
    dispatch(soundActions.setMuted(next))
  }, [dispatch])
}

export const useHapticsToggle = (): (() => void) => {
  const dispatch = useAppDispatch()
  return useCallback(() => {
    const next = !hapticsEnabled()
    setHaptics(next)
    dispatch(soundActions.setHaptics(next))
  }, [dispatch])
}
