import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: true,
  workers: Number(process.env.PLAYWRIGHT_WORKERS) || 4,
  // A few release checks still read live public Hive APIs. Retry them instead
  // of failing the gate on a transient node/rate limit.
  retries: Number(process.env.PLAYWRIGHT_RETRIES) || (process.env.CI ? 2 : 1),
  reporter: process.env.CI ? [['github'], ['line'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  webServer: {
    command: 'node scripts/serve-dist.mjs',
    url: 'http://127.0.0.1:4173',
    // scripts/e2e-run.mjs owns the server lifecycle.
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
