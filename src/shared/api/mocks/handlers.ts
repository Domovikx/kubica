import { http, HttpResponse } from 'msw'

/**
 * Моки DEV-среды (VITE_MOCKS=1). Один хендлер работает и для vanilla-fetch
 * (старая шапка), и для RTK Query — перехват на уровне сети, оба потребителя
 * получают одинаковый ответ.
 */
export const handlers = [
  http.get('https://api.github.com/repos/Domovikx/kubica', () =>
    HttpResponse.json({ stargazers_count: 42 }),
  ),
]
