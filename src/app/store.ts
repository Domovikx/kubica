import { configureStore } from '@reduxjs/toolkit'
import { githubApi } from '@/shared/api/github'

/**
 * Единый store нового стека. RTK Query (githubApi) — фундамент для кэшируемых
 * запросов; слои FSD подключают свои slice'ы сюда же по мере миграции.
 */
export const store = configureStore({
  reducer: {
    [githubApi.reducerPath]: githubApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(githubApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
