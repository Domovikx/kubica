import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  disposeMusic,
  musicAvail,
  musicState,
  musicToggle,
  musicVolume,
  onMusicChange,
  onMusicNotice,
  probeMusic,
  setMusicVolume,
} from './music'

// vitest-окружение — node: хранилище/окно стабим свои (in-memory), YT —
// заглушка плеера, управляющая onReady/onStateChange вручную.
type ReadyFn = (e: { target: unknown }) => void
type StateFn = (e: { data: number; target: unknown }) => void

interface PlayerOpts {
  videoId?: string
  playerVars?: Record<string, string | number>
  events?: { onReady?: ReadyFn; onStateChange?: StateFn; onError?: (e: { data: number }) => void }
}

class FakePlayer {
  static last: FakePlayer | null = null
  static instances = 0
  opts: PlayerOpts
  played = 0
  paused = 0
  destroyed = 0
  volume = -1
  constructor(_target: unknown, opts: PlayerOpts) {
    this.opts = opts
    FakePlayer.last = this
    FakePlayer.instances += 1
  }
  playVideo(): void {
    this.played += 1
  }
  pauseVideo(): void {
    this.paused += 1
  }
  setVolume(v: number): void {
    this.volume = v
  }
  getPlayerState(): number {
    return -1
  }
  destroy(): void {
    this.destroyed += 1
  }
}

const store = new Map<string, string>()
const unsubs: Array<() => void> = []

beforeEach(() => {
  store.clear()
  FakePlayer.last = null
  FakePlayer.instances = 0
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  // Таймеры блокировки — через window (браузер); в node отдаём глобальные.
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  })
  vi.stubGlobal('YT', { Player: FakePlayer })
})

afterEach(() => {
  for (const u of unsubs.splice(0)) u()
  disposeMusic()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** Тап + слив микрозадач (loadApi → then → ensurePlayer). */
const tap = async (host: object): Promise<void> => {
  musicToggle(host as HTMLElement)
  await Promise.resolve()
  await Promise.resolve()
}

describe('dnd-music: громкость (персист dice-music-vol)', () => {
  it('дефолт — 40 (пустое хранилище)', () => {
    expect(musicVolume()).toBe(40)
  })

  it('roundtrip: значение переживает перечитывание', () => {
    setMusicVolume(70)
    expect(musicVolume()).toBe(70)
    expect(store.get('dice-music-vol')).toBe('70')
  })

  it('битое значение падает на дефолт, set клампится в 0–100', () => {
    store.set('dice-music-vol', 'loud')
    expect(musicVolume()).toBe(40)
    store.set('dice-music-vol', '250')
    expect(musicVolume()).toBe(40)
    setMusicVolume(150)
    expect(musicVolume()).toBe(100)
    setMusicVolume(-5)
    expect(musicVolume()).toBe(0)
  })

  it('localStorage бросает — громкость дефолтная, set не падает', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(musicVolume()).toBe(40)
    expect(() => setMusicVolume(60)).not.toThrow()
  })
})

describe('dnd-music: стейт-машина (тап по тогглу)', () => {
  it('старт: off → loading → (onReady) playVideo + громкость из персиста', async () => {
    setMusicVolume(65)
    const seen: string[] = []
    unsubs.push(onMusicChange(() => seen.push(musicState())))
    await tap({})
    expect(musicState()).toBe('loading')
    const p = FakePlayer.last
    expect(p).not.toBeNull()
    expect(p?.opts.videoId).toBe('sHA_4wfQhE8') // проверенный embeddable-микс
    expect(p?.opts.playerVars?.loop).toBe(1)
    expect(p?.opts.playerVars?.playlist).toBe('sHA_4wfQhE8')
    p?.opts.events?.onReady?.({ target: p })
    expect(p?.played).toBe(1)
    expect(p?.volume).toBe(65)
    p?.opts.events?.onStateChange?.({ data: 1, target: p })
    expect(musicState()).toBe('playing')
    expect(seen).toEqual(['loading', 'playing'])
  })

  it('playing → тап → pauseVideo → onStateChange(PAUSED) → paused; тап → playVideo', async () => {
    await tap({})
    const p = FakePlayer.last as FakePlayer
    p.opts.events?.onReady?.({ target: p })
    p.opts.events?.onStateChange?.({ data: 1, target: p })
    await tap({}) // выключить
    expect(p.paused).toBe(1)
    p.opts.events?.onStateChange?.({ data: 2, target: p })
    expect(musicState()).toBe('paused')
    await tap({}) // включить снова — синхронный playVideo в жесте
    expect(p.played).toBe(2)
    expect(musicState()).toBe('paused') // resume без промежуточного loading
    p.opts.events?.onStateChange?.({ data: 1, target: p })
    expect(musicState()).toBe('playing')
  })

  it('loading не реагирует на повторный тап (двойной тап в момент загрузки)', async () => {
    await tap({})
    expect(FakePlayer.instances).toBe(1)
    await tap({})
    expect(FakePlayer.instances).toBe(1)
    expect(musicState()).toBe('loading')
  })

  it('onError → error + notice; следующий тап пересоздаёт плеер', async () => {
    const notices: string[] = []
    unsubs.push(onMusicNotice((n) => notices.push(n)))
    await tap({})
    const p1 = FakePlayer.last as FakePlayer
    p1.opts.events?.onError?.({ data: 101 })
    expect(musicState()).toBe('error')
    expect(notices).toEqual(['error'])
    await tap({})
    expect(p1.destroyed).toBe(1)
    expect(FakePlayer.instances).toBe(2)
    expect(musicState()).toBe('loading')
  })

  it('onReady не пришёл (эмбед завис) → через LOAD_MS loading падает в error', async () => {
    vi.useFakeTimers()
    // Перестаб окна уже поверх фейковых таймеров — иначе сторож ждал бы 8 с
    // настоящего времени.
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    })
    const notices: string[] = []
    unsubs.push(onMusicNotice((n) => notices.push(n)))
    await tap({})
    expect(musicState()).toBe('loading')
    vi.advanceTimersByTime(8000)
    expect(musicState()).toBe('error')
    expect(notices).toEqual(['error'])
    expect(FakePlayer.last?.destroyed).toBe(0) // плеер не трогаем — доживёт retry
    // Retry после error пересоздаёт плеер (сеть вернулась).
    await tap({})
    expect(FakePlayer.instances).toBe(2)
    expect(musicState()).toBe('loading')
  })

  it('onReady есть, PLAYING не пришёл → через BLOCKED_MS paused + notice blocked', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    })
    const notices: string[] = []
    unsubs.push(onMusicNotice((n) => notices.push(n)))
    await tap({})
    const p = FakePlayer.last as FakePlayer
    p.opts.events?.onReady?.({ target: p }) // playVideo вызван, но PLAYING не придёт
    expect(musicState()).toBe('loading')
    vi.advanceTimersByTime(2500)
    expect(musicState()).toBe('paused')
    expect(notices).toEqual(['blocked'])
    // Повторный тап — синхронный resume внутри жеста.
    await tap({})
    expect(p.played).toBe(2)
    expect(musicState()).toBe('paused') // дождётся onStateChange
    p.opts.events?.onStateChange?.({ data: 1, target: p })
    expect(musicState()).toBe('playing')
  })

  it('буферизация держит loading — сторож даёт +3с, потом всё равно blocked', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    })
    const notices: string[] = []
    unsubs.push(onMusicNotice((n) => notices.push(n)))
    await tap({})
    const p = FakePlayer.last as FakePlayer
    p.getPlayerState = () => 3 // ST_BUFFERING — сеть тормозит
    p.opts.events?.onReady?.({ target: p })
    vi.advanceTimersByTime(2500)
    expect(musicState()).toBe('loading') // оттяжка из-за буфера
    vi.advanceTimersByTime(3000)
    expect(musicState()).toBe('paused')
    expect(notices).toEqual(['blocked'])
  })

  it('disposeMusic: плеер убит, стейт off, доступность сброшена', async () => {
    await tap({})
    const p = FakePlayer.last as FakePlayer
    p.opts.events?.onReady?.({ target: p })
    p.opts.events?.onStateChange?.({ data: 1, target: p })
    disposeMusic()
    expect(p.destroyed).toBe(1)
    expect(musicState()).toBe('off')
    expect(musicAvail()).toBe('unknown')
  })
})

describe('dnd-music: доступность YouTube (probeMusic)', () => {
  it('скрипт доступен → ok, слушатели перерисованы', async () => {
    const seen: string[] = []
    unsubs.push(onMusicChange(() => seen.push(musicAvail())))
    await expect(probeMusic()).resolves.toBe('ok')
    expect(musicAvail()).toBe('ok')
    expect(seen).toEqual(['ok'])
  })

  it('скрипт не доехал → unavailable, тап гасится guard’ом', async () => {
    vi.stubGlobal('YT', undefined) // нет YT и нет document (node) → мгновенный reject
    await expect(probeMusic()).resolves.toBe('unavailable')
    expect(musicAvail()).toBe('unavailable')
    await tap({})
    expect(musicState()).toBe('off')
    expect(FakePlayer.instances).toBe(0)
    expect(FakePlayer.last).toBeNull()
  })

  it('после недоступности успешный проб возвращает ok', async () => {
    vi.stubGlobal('YT', undefined)
    await probeMusic()
    expect(musicAvail()).toBe('unavailable')
    vi.stubGlobal('YT', { Player: FakePlayer })
    await expect(probeMusic()).resolves.toBe('ok')
    expect(musicAvail()).toBe('ok')
  })
})
