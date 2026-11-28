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
      stores: src('stores'),
      // Outside an SSR app Vitest resolves Quasar's server build; the client
      // build is required for mounting components under a DOM environment.
      quasar: 'quasar/dist/quasar.client.js'
    }
  },
  test: {
    environment: 'jsdom',
    pool: 'vmThreads',
    setupFiles: ['tests/setup.js'],
    globals: true,
    include: ['tests/unit/**/*.spec.js'],
    // Tag deliberately expensive coverage so `test:fast` can skip it while the
    // full `test` run still executes every test.
    tags: [
      {
        name: 'slow',
        description: 'Heavy PBKDF2/KDF work or reconnect backoff; excluded from test:fast'
      }
    ],
    // SmartLock's PBKDF2 (310k iterations) legitimately takes seconds under
    // v8 coverage instrumentation. The default 5s timeout makes
    // `bun run test:coverage` fail on tests that pass in the normal run.
    testTimeout: 15000,
    hookTimeout: 15000,
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
