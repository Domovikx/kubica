// Дверь слоя shared. api НАМЕРЕННО мимо: browser.ts выполняет setupWorker(...)
// на верхнем уровне и тянет msw статически — дверь в api только динамическим
// import('@/shared/api') из main.tsx (см. main.tsx, VITE_MOCKS).
export * from './dice'
export * from './three'
export * from './ui'
export * from './arena'
