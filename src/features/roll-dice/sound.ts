// Минимальный синтезированный звук броска (AUDIO.md): стук костей + «ток» остановки.
// Ноль аудиофайлов — всё через Web Audio API. AudioContext создаётся лениво
// на первом жесте пользователя (требование автоплей-политик браузеров).
const MUTE_KEY = 'dice-muted'

let ctx: AudioContext | null = null
let rattleTimer: number | null = null
let sharedNoise: AudioBuffer | null = null

const ensureCtx = (): AudioContext | null => {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export const isMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export const setMuted = (muted: boolean): void => {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // ignore
  }
  if (muted) stopRattle()
}

const noiseBuffer = (ac: AudioContext): AudioBuffer => {
  if (sharedNoise) return sharedNoise
  const len = ac.sampleRate
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  sharedNoise = buf
  return buf
}

/** Один короткий стук кости: щелчок + корпус. */
const playClack = (): void => {
  if (!ctx || isMuted()) return
  try {
    const ac = ctx
    const t = ac.currentTime
    const dur = 0.05 + Math.random() * 0.04

    const src = ac.createBufferSource()
    src.buffer = noiseBuffer(ac)
    src.playbackRate.value = 0.8 + Math.random() * 0.7
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1400 + Math.random() * 2200
    bp.Q.value = 1 + Math.random() * 0.8
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.22 + Math.random() * 0.14, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(bp)
    bp.connect(g)
    g.connect(ac.destination)
    src.start(t, Math.random() * 0.5, dur + 0.05)
    src.stop(t + dur + 0.05)
    src.onended = () => {
      src.disconnect()
      bp.disconnect()
      g.disconnect()
    }

    const osc = ac.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 280 + Math.random() * 420
    const og = ac.createGain()
    og.gain.setValueAtTime(0.1 + Math.random() * 0.08, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
    osc.connect(og)
    og.connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.09)
    osc.onended = () => {
      osc.disconnect()
      og.disconnect()
    }
  } catch {
    // ignore
  }
}

/** Старт стука костей (вызывать на начале броска, только после жеста). */
export const startRattle = (): void => {
  if (isMuted()) return
  const ac = ensureCtx()
  if (!ac || rattleTimer !== null) return
  playClack()
  const loop = (): void => {
    if (rattleTimer === null) return
    playClack()
    rattleTimer = window.setTimeout(loop, 70 + Math.random() * 110)
  }
  rattleTimer = window.setTimeout(loop, 90)
}

/** Стоп стука (вызывать на остановке). */
export const stopRattle = (): void => {
  if (rattleTimer !== null) {
    clearTimeout(rattleTimer)
    rattleTimer = null
  }
}

/** Глухой «ток» остановки кости. pitch зависит от размера (d20 ниже d6). */
export const playThock = (die: string): void => {
  if (isMuted()) return
  const ac = ensureCtx()
  if (!ac) return
  const base = die === 'd20' || die === 'd12' ? 180 : 240
  const osc = ac.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = base
  const gain = ac.createGain()
  gain.gain.setValueAtTime(0.35, ac.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18)
  osc.connect(gain).connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + 0.2)
}
