import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  {
    ignores: [
      'dist/**',
      '.quasar/**',
      'node_modules/**',
      'public/**',
      'src/statics/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
      '.devlog/**',
      '.tools/**',
      '.rp1/**'
    ]
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ga: 'readonly',
        __statics: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/attributes-order': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-unused-components': 'warn',
      'vue/no-unused-vars': 'warn',
      'vue/prop-name-casing': 'off'
    }
  }
]
