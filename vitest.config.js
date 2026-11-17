// Vitest configuration for unit tests.
// Aliases mirror quasar.config.js so tests can import the same module IDs as
// application code (src/services/..., components/..., etc.).
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const root = dirname(fileURLToPath(import.meta.url))
const src = (...parts) => resolve(root, 'src', ...parts)

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      src: src(),
      assets: src('assets'),
      boot: src('boot'),
      components: src('components'),
      layouts: src('layouts'),
      pages: src('pages'),
      stores: src('stores')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.spec.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{js,vue}'],
      exclude: [
        'src/assets/**',
        'src/css/**',
        'src/statics/**',
        'src/**/*.d.ts',
        'tests/**',
        'dist/**',
        '.quasar/**',
        'node_modules/**'
      ]
    }
  }
})
