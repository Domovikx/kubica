// ESLint 9 flat config — топ-2026 для TS-проектов.
// Стиль кода отдаём Prettier (через lint-staged), здесь только correctness.
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'debug/**',
      'tmp/**',
      'tools/*venv*/**',
      'tools/openscad/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
)
