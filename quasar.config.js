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

  css: ['app.scss'],

  extras: ['material-icons'],

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
          globals: {
            // SmartLock (sjcl), the block size helper and dashboard layout
            // helpers still expect a global Buffer in the browser.
            Buffer: true
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
  },

  // Only the Animate.css classes used by <transition> in src are bundled.
  animations: [
    'bounceInDown',
    'bounceInUp',
    'bounceOutDown',
    'bounceOutUp',
    'fadeIn',
    'fadeInDown',
    'fadeOut',
    'fadeOutUp',
    'zoomInDown'
  ]
}))
