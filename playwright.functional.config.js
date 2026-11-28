import { defineConfig, devices } from '@playwright/test'

// Fast functional Chromium suite.
//
// This is the local iteration lane: it skips the heavy a11y/layout/perf/PWA/
// offline/Vault specs but keeps the functional flows, route mocks and queueing
// checks. Chromium is required because Obscura does not expose request bodies,
// so specs that rewrite mocked JSON-RPC responses cannot work there.
//
// The static server is started by scripts/e2e-run.mjs before Playwright starts,
// which keeps it alive for the whole run (Playwright-managed servers have
// dropped mid-run under parallel load).
const APP_PORT = Number(process.env.E2E_PORT) || 4173
const BASE_URL = 'http://127.0.0.1:' + APP_PORT

const CHROMIUM_ONLY = [
  '**/a11y.spec.js',
  '**/peek-layout.spec.js',
  '**/wallet-csv.spec.js',
  '**/lightning-states.spec.js',
  '**/perf.spec.js',
  '**/polish.spec.js',
  '**/pwa.spec.js',
  '**/resilience.spec.js',
  // Vault needs axe, real IndexedDB CryptoKey storage and deterministic
  // network mocking; it remains in the full suite.
  '**/vault.spec.js'
]

export default defineConfig({
  testDir: './e2e',
  testIgnore: CHROMIUM_ONLY,
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: true,
  workers: Number(process.env.PLAYWRIGHT_WORKERS) || 4,
  reporter: process.env.CI ? [['github'], ['line']] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  webServer: {
    command: 'node scripts/serve-dist.mjs',
    url: BASE_URL,
    // scripts/e2e-run.mjs owns the server lifecycle. Never let Playwright
    // replace or kill a server that is already serving the build.
    reuseExistingServer: true,
    timeout: 20000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1100 } }
    }
  ]
})
