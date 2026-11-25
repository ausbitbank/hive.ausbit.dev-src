// Quasar CLI (Vite) configuration
// https://v2.quasar.dev/quasar-cli-vite/quasar-config-file
import { defineConfig } from '#q-app'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const src = (...parts) => resolve(root, 'src', ...parts)

export default defineConfig(() => ({
  boot: ['theme', 'hivejs', 'hiveStore', 'imageProxy', 'smartlock', 'pwa', 'safetyFloor', 'prefetch'],

  // The Material Icons font is self-hosted and subset to the icons the app
  // uses; see scripts/subset-icons.mjs and src/css/material-icons.scss.
  // Animate.css is vendored too, so @quasar/extras is not a dependency.
  css: ['material-icons.scss', 'animations.css', 'app.scss', 'tokens.scss'],

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
      stores: src('stores'),
      // The app only needs these three Node built-ins. Explicit aliases keep
      // the build off vite-plugin-node-polyfills and its crypto-browserify tree.
      buffer: 'buffer/',
      crypto: src('shims/crypto.js'),
      querystring: src('shims/querystring.js'),
      'remarkable/linkify': src('utils/remarkableLinkify.js')
    }
  },

  extendViteConf () {
    // The browser target already supports modulepreload; the injected
    // polyfill is dead weight in the initial shell. Merging tiny shared
    // chunks also trims the request count on first load.
    return { build: { modulePreload: { polyfill: false } } }
  },

  devServer: {
    port: 8080,
    open: true
  },

  framework: {
    iconSet: 'material-icons',
    lang: 'en-US',
    plugins: ['LocalStorage', 'SessionStorage', 'Meta', 'Notify', 'Dialog'],
    config: {
      dark: true
    }
  }
}))
