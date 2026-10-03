// Реалистичный звук костей (ресёрч docs/JUICE.md §звук): модальный удар +
// генерируемый IR-реверб. Ноль аудиофайлов — всё через Web Audio API.
// AudioContext создаётся лениво на первом жесте (требование автоплей-политик).
//
// Физика звука: удар = шумовой щелчок 3–15 мс + 3–4 негармонические моды
// 1.8–5 кГц (decay 30–90 мс) + тело стола 150–220 Гц + фетр (lowpass).
// «Тряска в руке» и «приземление» — разные текстуры (см. startRattle/playThock).

const MUTE_KEY = 'dice-muted'
const HAPTICS_KEY = 'dice-haptics'

let ctx: AudioContext | null = null
let rattleTimer: number | null = null
let sharedNoise: AudioBuffer | null = null
let convolver: ConvolverNode | null = null
let wetGain: GainNode | null = null

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

/** Вибрация отдельно от звука (дефолт вкл, персист). */
export const hapticsEnabled = (): boolean => {
  try {
    return localStorage.getItem(HAPTICS_KEY) !== '0'
  } catch {
    return true
  }
}

export const setHaptics = (on: boolean): void => {
  try {
    localStorage.setItem(HAPTICS_KEY, on ? '1' : '0')
  } catch {
    // ignore
  }
}

/** Тактильный отклик с учётом мьюта и тумблера (десктопы — тихо мимо). */
export const buzz = (pattern: number | number[]): void => {
  try {
    if (isMuted() || !hapticsEnabled()) return
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
    navigator.vibrate(pattern)
  } catch {
    // Десктопы без вибромотора — тихо игнорируем
  }
}

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

const noiseBuffer = (ac: AudioContext): AudioBuffer => {
  if (sharedNoise) return sharedNoise
  const len = ac.sampleRate
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  sharedNoise = buf
  return buf
}

/** Генерируемый IR маленькой комнаты/фетрового лотка (0.25 с, темнее к хвосту). */
const ensureReverb = (ac: AudioContext): void => {
  if (convolver) return
  try {
    const dur = 0.25
    const rate = ac.sampleRate
    const len = Math.floor(rate * dur)
    const ir = ac.createBuffer(2, len, rate)
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch)
      let lp = 0
      for (let i = 0; i < len; i++) {
        const t = i / len
        const white = Math.random() * 2 - 1
        // Однополюсный lowpass + экспоненциальное затухание (фетр глушит верх)
        lp += 0.35 * (white - lp)
        data[i] = lp * Math.exp(-t * 4.5) * 0.6
      }
    }
    convolver = ac.createConvolver()
    convolver.buffer = ir
    wetGain = ac.createGain()
    wetGain.gain.value = 0.14 // −17 дБ: комната красит, не мылит атаки
    convolver.connect(wetGain)
    wetGain.connect(ac.destination)
  } catch {
    convolver = null
    wetGain = null
  }
}

type DieClass = 'small' | 'mid' | 'big'

const dieClass = (die: string): DieClass => {
  if (die === 'd20') return 'big'
  if (die === 'd10' || die === 'd12') return 'mid'
  return 'small'
}

/** Базовые моды пластика по размеру (негармонический ряд маленького тела). */
const MODE_BASE: Record<DieClass, [number, number, number]> = {
  small: [2300, 3400, 4900],
  mid: [2000, 3100, 4500],
  big: [1800, 2900, 4200],
}

/** Базовая частота тела стола (большая кость — ниже). */
const BODY_BASE: Record<DieClass, number> = { small: 220, mid: 190, big: 160 }

export interface HitParams {
  /** Щелчок атаки: bandpass-частота, Q, длительность. */
  attackFreq: number
  attackQ: number
  attackDur: number
  /** Три моды: частота, decay, относительный gain (убывающий). */
  modes: Array<{ freq: number; decay: number; gain: number }>
  /** Тело стола: частота, decay, gain. */
  bodyFreq: number
  bodyDecay: number
  bodyGain: number
  /** Пиковый gain (от силы удара). */
  peak: number
  /** Lowpass фетра на весь удар. */
  lpFreq: number
}

/**
 * Чистые параметры модального удара (без DOM/Audio — тестируются).
 * intensity 0..1 (impact velocity из физики), rand инжектится для детерминизма.
 */
export const hitParams = (
  die: string,
  intensity: number,
  rand: () => number = Math.random,
): HitParams => {
  const cls = dieClass(die)
  const k = Math.max(0, Math.min(1, intensity))
  const jitter = (amt: number): number => 1 + (rand() * 2 - 1) * amt
  const base = MODE_BASE[cls]
  const gains = [1, 0.55, 0.3]
  return {
    attackFreq: (2500 + rand() * 1000) * (0.85 + 0.3 * k),
    attackQ: 1 + rand() * 0.5,
    attackDur: 0.008 + rand() * 0.006,
    modes: base.map((f, i) => ({
      freq: f * jitter(0.15),
      decay: 0.035 + rand() * 0.035,
      gain: gains[i] * (0.8 + 0.4 * rand()),
    })),
    bodyFreq: BODY_BASE[cls] * jitter(0.1),
    bodyDecay: 0.06 + rand() * 0.03,
    bodyGain: 0.22,
    peak: 0.05 + 0.5 * k,
    lpFreq: 6000 + rand() * 2000,
  }
}

/** Параметры микроудара рокота (укороченный удар + ладонь-lowpass). */
export interface RattleHit {
  dur: number
  lpFreq: number
  gain: number
  pan: number
  bright: boolean
}

export const rattleHit = (rand: () => number = Math.random): RattleHit => ({
  dur: 0.03 + rand() * 0.03,
  lpFreq: 900 + rand() * 500,
  gain: 0.1 + rand() * 0.25,
  pan: (rand() * 2 - 1) * 0.3,
  bright: rand() < 0.15,
})

/** Один модальный удар кости: щелчок + моды + тело + IR. intensity 0..1. */
const playImpact = (die: string, intensity: number, micro = false): void => {
  if (!ctx || isMuted()) return
  try {
    const ac = ctx
    ensureReverb(ac)
    const t = ac.currentTime
    const p = hitParams(die, intensity)
    const durScale = micro ? 0.6 : 1

    const out = ac.createGain()
    out.gain.value = 1
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = micro ? 900 + Math.random() * 500 : p.lpFreq
    const cleanup: AudioNode[] = [out, lp]
    // Панорама микроударов рокота (рука двигается): out → pan → lp
    let head: AudioNode = out
    if (micro) {
      try {
        const pan = ac.createStereoPanner()
        pan.pan.value = (Math.random() * 2 - 1) * 0.3
        out.connect(pan)
        head = pan
        cleanup.push(pan)
      } catch {
        // ignore — без панорамы тоже живут
      }
    }
    head.connect(lp)
    lp.connect(ac.destination)
    if (convolver) {
      const send = ac.createGain()
      // Финальный тук суше, рокот — чуть мокрее; collide-удары посередине
      send.gain.value = micro ? 0.25 : 0.12
      lp.connect(send)
      send.connect(convolver)
      cleanup.push(send)
    }
    const done = (node: AudioNode): void => {
      try {
        node.disconnect()
      } catch {
        // ignore
      }
    }

    // 1. Щелчок атаки: шум 8–14 мс через bandpass (именно его нет у «электроники»)
    const src = ac.createBufferSource()
    src.buffer = noiseBuffer(ac)
    src.playbackRate.value = 0.9 + Math.random() * 0.4
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = p.attackFreq
    bp.Q.value = p.attackQ
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0011, p.peak), t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0008, t + p.attackDur * durScale + 0.02)
    src.connect(bp)
    bp.connect(g)
    g.connect(out)
    src.start(t, Math.random() * 0.5, 0.1)
    src.stop(t + 0.12)
    cleanup.push(src, bp, g)

    // 2. Моды пластика: негармонический звон вместо одного синуса
    p.modes.forEach((m) => {
      const osc = ac.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = m.freq
      const og = ac.createGain()
      og.gain.setValueAtTime(Math.max(0.0011, p.peak * m.gain * 0.5), t)
      og.gain.exponentialRampToValueAtTime(0.0008, t + m.decay * durScale)
      osc.connect(og)
      og.connect(out)
      osc.start(t)
      osc.stop(t + m.decay * durScale + 0.02)
      cleanup.push(osc, og)
    })

    // 3. Тело стола: низкий глухой компонент
    const body = ac.createOscillator()
    body.type = 'sine'
    body.frequency.setValueAtTime(p.bodyFreq * 1.1, t)
    body.frequency.exponentialRampToValueAtTime(p.bodyFreq * 0.85, t + p.bodyDecay)
    const bg = ac.createGain()
    bg.gain.setValueAtTime(Math.max(0.0011, p.peak * p.bodyGain), t)
    bg.gain.exponentialRampToValueAtTime(0.0008, t + p.bodyDecay * durScale)
    body.connect(bg)
    bg.connect(out)
    body.start(t)
    body.stop(t + p.bodyDecay * durScale + 0.02)
    cleanup.push(body, bg)

    const end = t + 0.4
    window.setTimeout(() => cleanup.forEach(done), Math.max(0, (end - ac.currentTime) * 1000 + 50))
  } catch {
    // ignore
  }
}

/** Старт рокота горсти В РУКЕ (на удержании, только после жеста). */
export const startRattle = (): void => {
  if (isMuted()) return
  const ac = ensureCtx()
  if (!ac || rattleTimer !== null) return
  // Поток микроударов 14–22/с: интервалы и громкости неровные (мозг считывает
  // реализм по нерегулярности). Это контакт с рукой — честный звук.
  // В ПОЛЁТЕ рокота нет: без соприкосновения кость молчит (только collide-удары).
  const loop = (): void => {
    if (rattleTimer === null) return
    const h = rattleHit()
    playImpact('d6', h.gain, true)
    if (h.bright) playImpact('d6', Math.min(1, h.gain + 0.35), true)
    rattleTimer = window.setTimeout(loop, 35 + Math.random() * 55)
  }
  playImpact('d6', 0.8, true)
  rattleTimer = window.setTimeout(loop, 60)
}

/** Стоп рокота (на остановке). */
export const stopRattle = (): void => {
  if (rattleTimer !== null) {
    clearTimeout(rattleTimer)
    rattleTimer = null
  }
}

/**
 * Глухой тук удара/остановки. pitch зависит от размера (d20 ниже d6).
 * intensity 0..1 (из collide — громкость ∝ удару), дефолт — финальный тук.
 */
export const playThock = (die: string, gain = 0.35): void => {
  if (isMuted()) return
  const ac = ensureCtx()
  if (!ac) return
  playImpact(die, gain)
}
