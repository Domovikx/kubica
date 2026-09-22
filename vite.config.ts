import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  // Базовый путь для GitHub Pages (project site). Локально `npm run dev` — тоже работает.
  base: '/dnd-dice-blender/',
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
