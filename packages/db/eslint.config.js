import baseConfig from '@cared/eslint-config/base'

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: ['dist/**', 'src/schema/auth-generated.ts'],
  },
  ...baseConfig,
]
