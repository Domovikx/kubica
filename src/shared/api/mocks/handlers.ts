import { http, HttpResponse } from 'msw'

/**
 * Моки DEV-среды (VITE_MOCKS=1). Перехват на уровне сети: счётчик звёзд
 * (сырой fetch в mobile-table) и любой другой потребитель получают ответ.
 */
export const handlers = [
  http.get('https://api.github.com/repos/Domovikx/kubica', () =>
    HttpResponse.json({ stargazers_count: 42 }),
  ),
]
