import { resolve } from 'node:path'
import stylex from '@stylexjs/unplugin'
import { defineConfig } from 'vite'

export default defineConfig({
  // Базовый путь для GitHub Pages (project site). Локально `npm run dev` — тоже работает.
  base: '/kubica/',
  // useCSSLayers: правила stylex — в @layer stylex (последний слой объявления
  // в styles.css): без слоёв stylex поднимает специфику :not(#\#) до (2,1,0)
  // и перебивает наши state-правила (.X.on/глобалы — вне слоёв, должны бить).
  // Tailwind выпилен (волна Wlast, 2026-10-10) — стили на stylex, см.
  // tasks/mvp-2/2026-10-10-stylex-migration.md.
  plugins: [stylex.vite({ useCSSLayers: true })],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
})
