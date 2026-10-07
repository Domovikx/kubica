// 2.22 «Фоновая музыка для ДНД»: внешний плеер YouTube IFrame API (ресёрч и
// выбор источника — в tasks/mvp-2/2.22-dnd-music.md). Лениво: скрипт API и
// iframe создаются только по первому тапу (PWA-бюджет: в precache ничего).
// Персист — только громкость (dice-music-vol): автостарта после reload нет —
// политика автоплея браузеров, первый тап пользователя и есть жест.
//
// Стейт-машина: off → loading → playing ⇄ paused; error — плеер не смог
// запуститься (ошибка эмбеда/сети). loading, не ставший playing за ~2.5 с,
// означает «браузер съел автоплей» → paused + notice('blocked') — UI просит
// тапнуть ещё раз (второй тап зовёт playVideo синхронно в жесте).

/** Состояние фоновой музыки для UI (шапка + секция меню). */
export type MusicState = 'off' | 'loading' | 'playing' | 'paused' | 'error'

/** Разовые сообщения UI (тосты): нет сети / нужен повторный тап / ошибка. */
export type MusicNotice = 'offline' | 'blocked' | 'error'

/** Доступность YouTube: unknown — проверка ещё идёт, ok/unavailable — её итог. */
export type MusicAvail = 'unknown' | 'ok' | 'unavailable'

// Дефолт — один проверенный hours-микс: 3-часовой DnD-фон (Everrune),
// embeddable (oEmbed 2026-10-07), loop = loop=1&playlist=<id> (доки YouTube:
// в IFrame loop работает только вместе с playlist — для одного видео).
const VIDEO_ID = 'sHA_4wfQhE8'
const VOL_KEY = 'dice-music-vol'
const DEFAULT_VOL = 40
// Сколько ждём PLAYING после onReady: дольше — считаем, что автоплей блокирован.
const BLOCKED_MS = 2500
const BUFFERING_EXTRA_MS = 3000
// Сколько ждём onReady после тапа: эмбед может молча не загрузиться (сеть/DNS
// до youtube отвалилась, onerror не приходит) — без этого сторожа спиннер
// висел бы вечно.
const LOAD_MS = 8000
// Проба доступа (probeMusic): подвешенная сеть не должна держать кнопку
// в «неизвестной» дольше этого.
const PROBE_MS = 4000

/** YouTube PlayerState (литералы, чтобы не тянуть типы YouTube в проект). */
const ST_ENDED = 0
const ST_PLAYING = 1
const ST_PAUSED = 2
const ST_BUFFERING = 3

interface YTPlayerLike {
  playVideo(): void
  pauseVideo(): void
  setVolume(v: number): void
  getPlayerState(): number
  destroy(): void
}

interface YTApi {
  Player: new (
    target: unknown,
    options: {
      videoId?: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (e: { target: YTPlayerLike }) => void
        onStateChange?: (e: { data: number; target: YTPlayerLike }) => void
        onError?: (e: { data: number }) => void
      }
    },
  ) => YTPlayerLike
}

declare global {
  interface Window {
    YT?: YTApi
    onYouTubeIframeAPIReady?: () => void
  }
}

// Глобали читаем через globalThis — в node-тестах window нет, а YT стабим.
const g = globalThis as typeof globalThis & {
  YT?: YTApi
  onYouTubeIframeAPIReady?: () => void
}

let state: MusicState = 'off'
let avail: MusicAvail = 'unknown'
let player: YTPlayerLike | null = null
let apiPromise: Promise<void> | null = null
let blockTimer = 0
let loadTimer = 0
const listeners = new Set<() => void>()
const noticeListeners = new Set<(n: MusicNotice) => void>()

const clearBlockTimer = (): void => {
  if (blockTimer !== 0) {
    window.clearTimeout(blockTimer)
    blockTimer = 0
  }
}

const clearLoadTimer = (): void => {
  if (loadTimer !== 0) {
    window.clearTimeout(loadTimer)
    loadTimer = 0
  }
}

/** Текущее состояние (для рендера UI). */
export const musicState = (): MusicState => state

/** Доступность YouTube для UI (кнопка aria-disabled, пока недоступен). */
export const musicAvail = (): MusicAvail => avail

/** Подписка на смену состояния; возвращает отписку. */
export const onMusicChange = (fn: () => void): (() => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** Подписка на разовые сообщения (тосты); возвращает отписку. */
export const onMusicNotice = (fn: (n: MusicNotice) => void): (() => void) => {
  noticeListeners.add(fn)
  return () => void noticeListeners.delete(fn)
}

const setState = (next: MusicState): void => {
  if (state === next) return
  state = next
  // Любой выход из loading гасит сторож тапа (playing/paused/error/off).
  if (next !== 'loading') clearLoadTimer()
  for (const fn of listeners) fn()
}

const setAvail = (next: MusicAvail): void => {
  if (avail === next) return
  avail = next
  // Те же слушатели, что и у стейта: виджет перерисовывает оба тоггла.
  for (const fn of listeners) fn()
}

const notify = (n: MusicNotice): void => {
  for (const fn of noticeListeners) fn(n)
}

/** Громкость фона 0–100; битое/чужое значение — дефолт 40. */
export const musicVolume = (): number => {
  try {
    const raw = localStorage.getItem(VOL_KEY)
    if (raw === null) return DEFAULT_VOL // Number(null) === 0 — не ловушка
    const v = Number(raw)
    return Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v) : DEFAULT_VOL
  } catch {
    return DEFAULT_VOL
  }
}

/** Пишет громкость и (если плеер жив) применяет её сразу. */
export const setMusicVolume = (v: number): void => {
  const vol = Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : DEFAULT_VOL
  try {
    localStorage.setItem(VOL_KEY, String(vol))
  } catch {
    // приватный режим — громкость живёт только в сессии
  }
  player?.setVolume(vol)
}

/** Ленивая загрузка youtube.com/iframe_api (один раз за жизнь страницы). */
const loadApi = (): Promise<void> => {
  if (g.YT && typeof g.YT.Player === 'function') return Promise.resolve()
  if (apiPromise) return apiPromise
  apiPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('no-document'))
      return
    }
    const prev = g.onYouTubeIframeAPIReady
    g.onYouTubeIframeAPIReady = () => {
      prev?.()
      setAvail('ok') // запоздавший успех после таймаута проба — кнопка оживает
      resolve()
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => {
      g.onYouTubeIframeAPIReady = prev
      apiPromise = null // сбой не кэшируем — следующий тап имеет право на retry
      reject(new Error('yt-api-load'))
    }
    document.head.appendChild(s)
  })
  return apiPromise
}

/**
 * Ранняя проба доступа (зовёт виджет при монтировании): тянем ТОТ ЖЕ ленивый
 * скрипт API, что пойдёт в плеер — успех = ok, отказ/таймаут = unavailable
 * (кнопки aria-disabled до повтора по событию `online`). Один запрос, без
 * отдельного пинга.
 */
export const probeMusic = async (): Promise<MusicAvail> => {
  if (g.YT && typeof g.YT.Player === 'function') {
    setAvail('ok')
    return 'ok'
  }
  let timer = 0
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('probe-timeout')), PROBE_MS)
  })
  try {
    await Promise.race([loadApi(), timeout])
    setAvail('ok')
    return 'ok'
  } catch {
    setAvail('unavailable')
    return 'unavailable'
  } finally {
    clearTimeout(timer)
  }
}

/** onReady → ставим громкость и playVideo; если PLAYING не пришёл — blocked. */
const armBlockWatchdog = (p: YTPlayerLike): void => {
  clearBlockTimer()
  const check = (extraMs: number, allowBuffering: boolean): void => {
    blockTimer = window.setTimeout(() => {
      blockTimer = 0
      if (state !== 'loading') return
      if (allowBuffering && p.getPlayerState() === ST_BUFFERING) {
        check(BUFFERING_EXTRA_MS, false) // сеть тормозит — ещё одна оттяжка
        return
      }
      // Автоплей съели (iOS/Safari вне жестовой цепочки) — просим тапнуть ещё раз.
      setState('paused')
      notify('blocked')
    }, extraMs)
  }
  check(BLOCKED_MS, true)
}

const ensurePlayer = (host: HTMLElement): YTPlayerLike => {
  if (player) return player
  const api = g.YT
  if (!api) throw new Error('yt-api-missing')
  // YT.Player ЗАМЕНЯЕТ целевой элемент своим iframe'ом — внутри wrapper'а
  // всегда держим свежий target (иначе рестарт после error шёл бы в узел,
  // откреплённый от документа). В браузере host — реальный элемент; в
  // node-тестах document нет (хост-заглушка), таргетом идёт сам host.
  let target: HTMLElement | null = null
  if (typeof document !== 'undefined') {
    target = host.querySelector('[data-mt-target]')
    if (!target) {
      target = document.createElement('div')
      target.dataset.mtTarget = ''
      host.append(target)
    }
  }
  player = new api.Player(target ?? host, {
    videoId: VIDEO_ID,
    playerVars: {
      // loop в IFrame работает только с playlist — так и документировано.
      loop: 1,
      playlist: VIDEO_ID,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      ...(typeof location !== 'undefined' && location.origin ? { origin: location.origin } : {}),
    },
    events: {
      onReady: (e) => {
        if (state !== 'loading') return
        clearLoadTimer() // дальше сторожит blocked-таймер
        e.target.setVolume(musicVolume())
        e.target.playVideo()
        armBlockWatchdog(e.target)
      },
      onStateChange: (e) => {
        if (e.data === ST_PLAYING) {
          clearBlockTimer()
          setState('playing')
        } else if (e.data === ST_PAUSED && state === 'playing') {
          setState('paused')
        } else if (e.data === ST_PAUSED && state === 'loading') {
          // Браузер сам встал на паузу вместо автоплея — это и есть блок.
          setState('paused')
          notify('blocked')
        } else if (e.data === ST_ENDED && (state === 'playing' || state === 'paused')) {
          // На случай если loop-параметр не отработал — форсируем повтор.
          e.target.playVideo()
        }
      },
      onError: () => {
        clearBlockTimer()
        setState('error')
        notify('error')
      },
    },
  })
  return player
}

/**
 * Тап по тогглу (шапка или секция меню): playing → пауза, paused/off/error →
 * старт, loading → игнор. `host` — элемент-контейнер для iframe (живёт в
 * секции меню; iframe в display:none продолжает играть — это наш контракт).
 */
export const musicToggle = (host: HTMLElement): void => {
  if (avail === 'unavailable') return // кнопка aria-disabled; страховка от тапа
  if (state === 'loading') return
  if (state === 'playing') {
    player?.pauseVideo()
    // Состояние дождётся onStateChange(PAUSED); если плеера почему-то нет —
    // сами уводим в paused, чтобы UI не завис.
    if (!player) setState('paused')
    return
  }
  if (state === 'paused') {
    // Синхронно внутри жеста — сюда iOS пропускает playVideo без ругани.
    player?.playVideo()
    return
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    notify('offline')
    return
  }
  // После error плеер мог умереть — убираем и создаём заново на старте.
  if (state === 'error') {
    player?.destroy()
    player = null
  }
  setState('loading')
  // Сторож до onReady: эмбед молча не загрузился (DNS/сеть до youtube умерла,
  // onerror у скрипта не бывает для зависшего iframe) — без таймера спиннер
  // висел бы вечно. onReady сменяет этот сторож на blocked-таймер.
  loadTimer = window.setTimeout(() => {
    loadTimer = 0
    if (state !== 'loading') return
    clearBlockTimer()
    setState('error')
    notify('error')
  }, LOAD_MS)
  loadApi()
    .then(() => {
      if (state !== 'loading') return // пока грузили API, тоггл выключили
      ensurePlayer(host)
      // onReady запустит playVideo; если API уже был загружен, а плеер
      // создан только что — ready придёт в следующем тике YouTube.
    })
    .catch(() => {
      clearBlockTimer()
      apiPromise = null // сбой загрузки не кэшируем — retry следующим тапом
      setAvail('unavailable') // скрипт не доехал — YouTube недоступен и для пробы
      setState('error')
      notify('error')
    })
}

/** Полный сброс (unmount виджета, тесты): плеер убивается, стейт и доступность — с нуля. */
export const disposeMusic = (): void => {
  clearBlockTimer()
  clearLoadTimer()
  player?.destroy()
  player = null
  // apiPromise НЕ сбрасываем: скрипт уже в документе, перезагружать не надо.
  setAvail('unknown') // remount снова проходит пробу (мгновенно, скрипт есть)
  setState('off') // no-op, если уже off — подписчики не дёргаем
}
