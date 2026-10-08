// Счётчик звёзд GitHub: кэш в localStorage на сутки + GitHub API без токена
// (rate limit 60/ч на IP — кэш держит расход в ≤1 запроса/сутки на
// посетителя). Деградация тихая: offline/403/429/любая ошибка → счётчик
// остаётся скрытым (или в прежнем значении из кэша), без ретраев.
export const STAR_KEY = 'kubica-stars'
export const STAR_TTL_MS = 24 * 60 * 60 * 1000

export interface StarCache {
  at: number
  n: number
}

/** Кэш по форме: битый JSON / чужие поля (строки, массивы) → null, без throw. */
export const parseStarsCache = (raw: string | null): StarCache | null => {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { at?: unknown }).at === 'number' &&
      typeof (parsed as { n?: unknown }).n === 'number'
    ) {
      return parsed as StarCache
    }
  } catch {
    // битый JSON — живём без кэша
  }
  return null
}

export interface StarCounter {
  /** Лениво: при сборке и при первом открытии меню (см. openDrawer). */
  load: () => void
}

/**
 * Счётчик в двух местах (пилюля в шапке + строка в шторке) — aria-лейблы
 * синхронизируются от одной и той же видимости/числа.
 */
export const createStarCounter = (deps: {
  headLink: HTMLElement
  headCount: HTMLElement
  menuLink: HTMLElement
  menuCount: HTMLElement
}): StarCounter => {
  const syncMenuAria = (): void => {
    deps.menuLink.setAttribute(
      'aria-label',
      deps.menuCount.hidden
        ? 'Оценить репозиторий Kubica звездой на GitHub (откроется в новой вкладке)'
        : `Оценить репозиторий Kubica на GitHub, звёзд: ${deps.menuCount.textContent} (откроется в новой вкладке)`,
    )
  }
  const syncHeadAria = (): void => {
    deps.headLink.setAttribute(
      'aria-label',
      deps.headCount.hidden
        ? 'Оценить репозиторий на GitHub (откроется в новой вкладке)'
        : `Оценить репозиторий Kubica на GitHub, звёзд: ${deps.headCount.textContent} (откроется в новой вкладке)`,
    )
  }
  const show = (n: number): void => {
    // Шторка: 0 звёзд — не социальное доказательство, мету-счётчик прячем
    // (сама строка-ссылка живёт всегда), показываем от 1.
    deps.menuCount.hidden = n < 1
    deps.menuCount.textContent = deps.menuCount.hidden ? '' : String(n)
    // Шапка — ряд как на GitHub: цифра видна всегда, когда она известна
    // (GitHub показывает и 0); без данных/офлайн пилюля скрыта.
    deps.headCount.textContent = String(n)
    deps.headCount.hidden = false
    syncMenuAria()
    syncHeadAria()
  }
  let asked = false
  const load = (): void => {
    if (asked) return
    asked = true
    let raw: string | null
    try {
      raw = localStorage.getItem(STAR_KEY)
    } catch {
      raw = null
    }
    const cached = parseStarsCache(raw)
    if (cached) {
      show(cached.n)
      if (Date.now() - cached.at < STAR_TTL_MS) return
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    void fetch('https://api.github.com/repos/Domovikx/kubica', {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((res): Promise<unknown> =>
        res.ok ? res.json() : Promise.reject(new Error(String(res.status))),
      )
      .then((data: unknown) => {
        const n =
          typeof data === 'object' && data !== null
            ? (data as { stargazers_count?: unknown }).stargazers_count
            : undefined
        if (typeof n !== 'number') return
        show(n)
        try {
          localStorage.setItem(STAR_KEY, JSON.stringify({ at: Date.now(), n }))
        } catch {
          // без хранилища живём — просто будем ходить в API реже
        }
      })
      .catch(() => {
        // тихо: остаёмся на кэше или без счётчика
      })
  }
  syncMenuAria()
  syncHeadAria()
  return { load }
}
