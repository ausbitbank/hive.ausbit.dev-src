import { test, expect } from '@playwright/test'
import { loginAs, readQueue, waitForApp } from './helpers'

const POST_ROUTE = '/@ausbitbank/hive-ausbit-dev-an-open-source-hive-block-explorer-post-viewer-and-more'

test.describe('network and data resilience', () => {
  test('home falls back to saved read snapshots when chain reads fail', async ({ page }) => {
    test.setTimeout(120000)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.locator('.home-block__witness')).toBeVisible({ timeout: 30000 })

    await expect.poll(() => page.evaluate(() => {
      return Object.keys(localStorage).some(key => key.startsWith('hive:snapshot:home:block'))
    }), { timeout: 20000 }).toBe(true)

    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue()
      return route.abort()
    })

    await page.reload()
    await waitForApp(page)

    const blockCard = page.locator('.home-block')
    await expect(blockCard.locator('.data-notice')).toBeVisible({ timeout: 30000 })
    await expect(blockCard).toContainText(/saved block/i)
    await expect(blockCard.locator('.home-block__witness')).toBeVisible()

    const telemetry = await page.evaluate(() => window.__hiveTelemetry?.snapshot())
    expect(telemetry.requests.total).toBeGreaterThan(0)
    expect(telemetry.requests.failures).toBeGreaterThan(0)
    expect(telemetry.cache.misses).toBeGreaterThan(0)
  })

  test('offline signing is marked failed and the queue cannot broadcast', async ({ page }) => {
    test.setTimeout(120000)
    await loginAs(page)
    await page.goto(POST_ROUTE)
    await waitForApp(page)
    await expect(page.getByRole('button', { name: 'Reblog this post' })).toBeVisible({ timeout: 30000 })
    await expect.poll(() => page.evaluate(() => {
      return performance.getEntriesByType('resource').some(entry => /\/queue-[^/]+\.js/.test(entry.name))
    }), { timeout: 20000 }).toBe(true)

    await page.context().setOffline(true)
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false)

    await page.getByRole('button', { name: 'Reblog this post' }).click()
    await page.getByRole('button', { name: 'Yes', exact: true }).click()

    await expect.poll(async () => {
      const queue = await readQueue(page)
      const meta = queue?.meta?.[0]
      return Boolean(queue?.items?.length &&
        meta?.status === 'failed' &&
        /offline/i.test(meta?.error || '') &&
        !meta.txId)
    }).toBe(true)
  })
})
