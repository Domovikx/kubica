import { useEffect, useState } from 'react'
import { parseStarsCache, STAR_KEY, STAR_TTL_MS } from '../stars'

let asked = false
let cachedN: number | null = null
const subs = new Set<(n: number | null) => void>()

const show = (n: number | null): void => {
  cachedN = n
  for (const s of subs) s(n)
}

/** Ленивая проба GitHub API (кэш на сутки, тихая деградация — см. stars.ts). */
export const loadStars = (): void => {
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

/** Счётчик звёзд: null — данных нет (пилюля в шапке скрыта). */
export const useStarCount = (): number | null => {
  const [n, setN] = useState<number | null>(cachedN)
  useEffect(() => {
    subs.add(setN)
    return () => {
      subs.delete(setN)
    }
  }, [])
  return n
}
