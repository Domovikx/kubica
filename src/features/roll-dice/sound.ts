// Минимальный синтезированный звук броска (AUDIO.md): грохот + «ток» остановки.
// Ноль аудиофайлов — всё через Web Audio API. AudioContext создаётся лениво
// на первом жесте пользователя (требование автоплей-политик браузеров).
const MUTE_KEY = 'dice-muted'

let ctx: AudioContext | null = null
let rattleNodes: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null =
  null

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
  const len = ac.sampleRate
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return buf
}

/** Старт грохота костей (вызывать на начале броска, только после жеста). */
export const startRattle = (): void => {
  if (isMuted()) return
  const ac = ensureCtx()
  if (!ac || rattleNodes) return
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer(ac)
  src.loop = true
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2500
  filter.Q.value = 0.8
  const gain = ac.createGain()
  gain.gain.value = 0.12
  src.connect(filter).connect(gain).connect(ac.destination)
  src.start()
  rattleNodes = { src, filter, gain }
}

/** Стоп грохота (вызывать на остановке). */
export const stopRattle = (): void => {
  if (!rattleNodes || !ctx) return
  try {
    rattleNodes.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03)
    const nodes = rattleNodes
    setTimeout(() => {
      try {
        nodes.src.stop()
      } catch {
        // уже остановлен
      }
      nodes.src.disconnect()
      nodes.filter.disconnect()
      nodes.gain.disconnect()
    }, 150)
  } catch {
    // ignore
  }
  rattleNodes = null
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
