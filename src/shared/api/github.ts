import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export type RepoStars = { stars: number }

/**
 * Первый API-слайс нового стека: звёзды репозитория (GitHub REST).
 * Кэш RTK Query: данные живут keepUnusedDataFor после последнего подписчика,
 * повторные монтирования отдаются из кэша без сети. Тег — на будущие
 * мутации/инвалидацию (star-кнопка на React-этапе будет инвалидировать).
 */
export const githubApi = createApi({
  reducerPath: 'githubApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'https://api.github.com/' }),
  tagTypes: ['RepoStars'],
  endpoints: (build) => ({
    getRepoStars: build.query<RepoStars, void>({
      query: () => 'repos/Domovikx/kubica',
      transformResponse: (response: { stargazers_count: number }): RepoStars => ({
        stars: response.stargazers_count,
      }),
      providesTags: ['RepoStars'],
      keepUnusedDataFor: 60,
    }),
  }),
})

export const { useGetRepoStarsQuery } = githubApi
