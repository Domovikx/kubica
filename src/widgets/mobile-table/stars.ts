// Кэш счётчика звёзд GitHub в localStorage на сутки (ключ + TTL + парсер).
// Проба API без токена (rate limit 60/ч на IP — кэш держит расход в ≤1
// запроса/сутки) и тихая деградация — в hooks/use-stars.ts (loadStars).
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
