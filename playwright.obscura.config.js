import { defineConfig } from '@playwright/test'

// Fast functional E2E suite backed by Obscura (CDP) instead of Chromium.
//
// Obscura is a lightweight Rust/V8 headless browser with a CDP server that
// Playwright can connect to. It is much faster to start and cheaper to run than
// Chromium, but its independent layout engine and missing Performance API make
// it unsuitable for axe/layout checks, visual polish, LCP/CLS, PWA/service
// worker and offline-network specs. Those stay in the Chromium suite
// (`playwright.config.js`), while the functional flows run here.
//
// Start Obscura with `OBSCURA_BIN=/path/to/obscura` if it is not on PATH.

const APP_PORT = Number(process.env.E2E_PORT) || 4173
const BASE_URL = 'http://127.0.0.1:' + APP_PORT

const CHROMIUM_ONLY = [
  '**/a11y.spec.js',
  '**/lightning-states.spec.js',
  '**/perf.spec.js',
  '**/polish.spec.js',
  '**/pwa.spec.js',
  '**/resilience.spec.js'
]

export default defineConfig({
  testDir: './e2e',
  testIgnore: CHROMIUM_ONLY,
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: process.env.CI ? 1 : 4,
  reporter: process.env.CI ? [['github'], ['line']] : [['list']],
  use: {
    baseURL: BASE_URL,
    // Obscura supports screenshots but trace playback is a Chromium-oriented
    // path; keep the fast run lean and rely on the Chromium suite for traces.
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  webServer: [
    {
      command: 'node scripts/serve-dist.mjs',
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 20000
    }
  ],
  projects: [
    {
      name: 'obscura',
      use: {
        viewport: { width: 1440, height: 1100 }
      }
    }
  ]
})
