// Quasar CLI (Vite) configuration
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-file
import { defineConfig } from '#q-app'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const root = dirname(fileURLToPath(import.meta.url))
const src = (...parts) => resolve(root, 'src', ...parts)

export default defineConfig(() => ({
  boot: ['hivejs', 'hiveStore', 'smartlock', 'pwa', 'prefetch'],

  // The Material Icons font is self-hosted and subset to the icons the app
  // uses; see scripts/subset-icons.mjs and src/css/material-icons.scss.
  // Animate.css is vendored too, so @quasar/extras is not a dependency.
  css: ['material-icons.scss', 'animations.css', 'app.scss'],

  build: {
    vueRouterMode: 'history',
    // Source maps are only generated for explicit bundle analysis builds.
    sourcemap: process.env.PERF_SOURCE_MAP === '1',
    // The app is written with the Vue Options API; Quasar disables it by default in v3.
    vueOptionsAPI: true,
    target: {
      browser: 'baseline-widely-available'
    },
    alias: {
      src: src(),
      assets: src('assets'),
      boot: src('boot'),
      components: src('components'),
      layouts: src('layouts'),
      pages: src('pages'),
      stores: src('stores')
    },
    vitePlugins: [
      [
        nodePolyfills,
        {
          // No Node globals are injected into the initial shell. The signing
          // stack imports and installs Buffer just before it lazily imports
          // hive-tx (the plugin default would inject it everywhere).
          globals: { Buffer: false },
          // sjcl probes Node's `crypto.randomBytes`, which would otherwise pull
          // the entire crypto-browserify tree into the SmartLock chunk. The
          // shim keeps sjcl on the browser's WebCrypto path.
          overrides: {
            crypto: resolve(root, 'src/shims/crypto.js')
          },
          protocolImports: true
        }
      ]
    ]
  },

  devServer: {
    port: 8080,
    open: true
  },

  framework: {
    iconSet: 'material-icons',
    lang: 'en-US',
    plugins: ['LocalStorage', 'SessionStorage', 'Meta', 'Notify', 'LoadingBar', 'Dialog'],
    config: {
      dark: true
    }
  }
}))
